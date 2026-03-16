package com.trading.app.data.repository

import android.util.Log
import androidx.room.withTransaction
import com.trading.app.data.local.db.TradingDatabase
import com.trading.app.data.local.db.dao.*
import com.trading.app.data.local.db.entity.*
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.remote.kis.KisApi
import com.trading.app.data.remote.kis.KisConfig
import com.trading.app.data.remote.kis.KisEnv
import com.trading.app.data.remote.kis.dto.*
import com.trading.app.domain.market.FeeCalculator
import com.trading.app.domain.model.*
import com.trading.app.domain.order.TickSizeUtil
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrderRepository @Inject constructor(
    private val db: TradingDatabase,
    private val kisApi: KisApi,
    private val orderDao: OrderDao,
    private val executionDao: ExecutionDao,
    private val tradeDao: TradeDao,
    private val positionDao: PositionDao,
    private val eventLogDao: EventLogDao,
    private val prefs: AppPreferences,
) {
    private val kisEnv get() = KisEnv.fromString(prefs.kisEnv)
    private val dbEnv get() = prefs.environment
    private val now get() = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))

    companion object {
        private const val TAG = "OrderRepo"
    }

    suspend fun placeOrder(signal: Signal): String {
        val orderId = UUID.randomUUID().toString()
        val orderType = if (signal.price > 0) "LIMIT" else "MARKET"

        // Apply tick size adjustment for LIMIT orders
        val adjustedPrice = if (orderType == "LIMIT") {
            val adjusted = if (signal.side == OrderSide.BUY) {
                TickSizeUtil.adjustBuyPrice(signal.price)
            } else {
                TickSizeUtil.adjustSellPrice(signal.price)
            }
            adjusted.toDouble()
        } else {
            signal.price
        }

        // Save to DB
        orderDao.insert(OrderEntity(
            orderId = orderId,
            stockCode = signal.stockCode,
            stockName = signal.stockName,
            side = signal.side.value,
            orderType = orderType,
            quantity = signal.quantity,
            price = adjustedPrice,
            strategy = signal.strategyId,
            signal = signal.reason,
            createdAt = now,
            updatedAt = now,
            environment = dbEnv,
        ))

        try {
            val trId = if (signal.side == OrderSide.BUY) {
                KisConfig.getTrId(kisEnv, "cashBuy")
            } else {
                KisConfig.getTrId(kisEnv, "cashSell")
            }

            val cano = prefs.accountNo.take(8)
            val acntPrdtCd = prefs.accountProductCode

            val response = kisApi.placeOrder(
                trId = trId,
                request = KisOrderRequest(
                    cano = cano,
                    acntPrdtCd = acntPrdtCd,
                    pdno = signal.stockCode,
                    ordDvsn = if (orderType == "MARKET") "01" else "00",
                    ordQty = signal.quantity.toString(),
                    ordUnpr = if (orderType == "MARKET") "0" else adjustedPrice.toInt().toString(),
                )
            )

            if (response.rtCd != "0") {
                orderDao.updateStatus(orderId, OrderStatus.REJECTED.value, now)
                logEvent("ORDER", "REJECTED", "KIS error: ${response.msg1}")
                throw RuntimeException("Order rejected: ${response.msg1}")
            }

            val kisOrderNo = response.output?.odno ?: ""
            orderDao.updateSubmitted(orderId, kisOrderNo, OrderStatus.PENDING.value, now)
            logEvent("ORDER", "SUBMITTED", "${signal.side.value} ${signal.stockCode} qty=${signal.quantity} @ ${adjustedPrice.toInt()}")

            return orderId
        } catch (e: Exception) {
            if (e.message?.contains("rejected") != true) {
                // Network error: mark as ERROR (not REJECTED) — needs reconciliation
                val detail = if (e is retrofit2.HttpException) {
                    val body = try { e.response()?.errorBody()?.string() } catch (_: Exception) { null }
                    "HTTP ${e.code()}: $body"
                } else {
                    e.message ?: "Unknown"
                }
                orderDao.updateStatus(orderId, OrderStatus.ERROR.value, now)
                logEvent("ORDER", "ERROR", "needs reconciliation: $detail")
            }
            throw e
        }
    }

    suspend fun cancelOrder(orderId: String) {
        val order = orderDao.getByOrderId(orderId) ?: return
        val kisOrderNo = order.kisOrderNo ?: return

        val trId = KisConfig.getTrId(kisEnv, "cancel")
        val cano = prefs.accountNo.take(8)

        kisApi.cancelOrder(
            trId = trId,
            request = KisCancelRequest(
                cano = cano,
                acntPrdtCd = prefs.accountProductCode,
                orgnOdno = kisOrderNo,
                ordQty = (order.quantity - order.filledQuantity).toString(),
            )
        )

        orderDao.updateStatus(orderId, OrderStatus.CANCEL_REQUESTED.value, now)
    }

    suspend fun pollExecutions() {
        val activeOrders = orderDao.getActiveOrders(dbEnv)
        val errorOrders = orderDao.getByStatus(OrderStatus.ERROR.value, dbEnv)
        if (activeOrders.isEmpty() && errorOrders.isEmpty()) return

        val trId = KisConfig.getTrId(kisEnv, "executions")
        val today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
        val cano = prefs.accountNo.take(8)

        val response = kisApi.getExecutions(
            trId = trId,
            cano = cano,
            acntPrdtCd = prefs.accountProductCode,
            startDate = today,
            endDate = today,
        )

        if (response.rtCd != "0") {
            Log.w(TAG, "Execution poll failed: ${response.msg1}")
            return
        }

        val executions = response.output1 ?: return
        Log.d(TAG, "pollExecutions: activeOrders=${activeOrders.size}, errorOrders=${errorOrders.size}, executions=${executions.size}")
        for (exec in executions) {
            Log.d(TAG, "  KIS exec: odno=${exec.odno}, pdno=${exec.pdno}, side=${exec.sllBuyDvsnCd}, qty=${exec.totCcldQty}, avgPrvs=${exec.avgPrvs}")
        }
        for (order in activeOrders) {
            Log.d(TAG, "  DB order: orderId=${order.orderId.take(8)}, kisOrderNo=${order.kisOrderNo}, stock=${order.stockCode}, status=${order.status}, filled=${order.filledQuantity}/${order.quantity}")
        }

        // Reconcile ERROR orders: check if KIS actually accepted them
        for (errorOrder in errorOrders) {
            val expectedDvsnCd = if (errorOrder.side == "buy") "02" else "01"
            val matchingExec = executions.find { exec ->
                exec.pdno == errorOrder.stockCode && exec.sllBuyDvsnCd == expectedDvsnCd
            }
            if (matchingExec != null) {
                orderDao.updateSubmitted(errorOrder.orderId, matchingExec.odno, OrderStatus.PENDING.value, now)
                logEvent("ORDER", "RECONCILED", "ERROR order ${errorOrder.orderId} found in KIS")
            }
        }

        // Process execution updates
        val refreshedOrders = orderDao.getActiveOrders(dbEnv)
        for (exec in executions) {
            val order = refreshedOrders.find { it.kisOrderNo == exec.odno }
            if (order == null) {
                Log.d(TAG, "  No matching order for KIS odno=${exec.odno}")
                continue
            }
            val filledQty = exec.totCcldQty.toIntOrNull() ?: 0
            if (filledQty <= order.filledQuantity) {
                Log.d(TAG, "  Already processed: ${exec.odno} filledQty=$filledQty <= ${order.filledQuantity}")
                continue
            }

            val filledPrice = exec.avgPrvs?.toDoubleOrNull()
            if (filledPrice == null) {
                Log.w(TAG, "  avgPrvs is null/invalid for ${exec.odno}: '${exec.avgPrvs}' — skipping")
                continue
            }
            val newStatus = if (filledQty >= order.quantity) OrderStatus.FILLED.value else OrderStatus.PARTIAL_FILLED.value
            Log.d(TAG, "  FILL detected: ${order.stockCode} qty=$filledQty @ $filledPrice → $newStatus")

            orderDao.updateFilled(order.orderId, filledQty, filledPrice, newStatus, now)

            if (newStatus == OrderStatus.FILLED.value) {
                handleFill(order, filledQty, filledPrice)
            }
        }
    }

    private suspend fun handleFill(order: OrderEntity, filledQty: Int, filledPrice: Double) {
        val amount = filledPrice * filledQty
        val side = if (order.side == "buy") OrderSide.BUY else OrderSide.SELL
        val fees = FeeCalculator.calculate(side, amount)

        // Atomic transaction: execution + position/trade updates
        db.withTransaction {
            executionDao.insert(ExecutionEntity(
                orderId = order.orderId,
                stockCode = order.stockCode,
                side = order.side,
                quantity = filledQty,
                price = filledPrice,
                amount = amount,
                fee = fees.total,
                executedAt = now,
            ))

            val strategyId = order.strategy // stores strategyId ("A" or "B")

            if (order.side == "buy") {
                val existing = positionDao.getByStockCodeAndStrategy(order.stockCode, strategyId, dbEnv)
                if (existing != null) {
                    val newQty = existing.quantity + filledQty
                    val newAvgPrice = (existing.avgPrice * existing.quantity + filledPrice * filledQty) / newQty
                    positionDao.upsert(existing.copy(
                        quantity = newQty,
                        avgPrice = newAvgPrice,
                        updatedAt = now,
                    ))
                } else {
                    positionDao.upsert(PositionEntity(
                        stockCode = order.stockCode,
                        stockName = order.stockName,
                        quantity = filledQty,
                        avgPrice = filledPrice,
                        currentPrice = filledPrice,
                        boughtAt = now,
                        updatedAt = now,
                        strategyId = strategyId,
                        environment = dbEnv,
                    ))
                }
            } else {
                val position = positionDao.getByStockCodeAndStrategy(order.stockCode, strategyId, dbEnv)
                if (position != null) {
                    val buyFees = FeeCalculator.calculate(OrderSide.BUY, position.avgPrice * filledQty)
                    val pnl = (filledPrice - position.avgPrice) * filledQty - fees.total - buyFees.total
                    val pnlRate = (filledPrice - position.avgPrice) / position.avgPrice

                    tradeDao.insert(TradeEntity(
                        stockCode = order.stockCode,
                        stockName = order.stockName,
                        buyOrderId = "",
                        sellOrderId = order.orderId,
                        quantity = filledQty,
                        buyPrice = position.avgPrice,
                        sellPrice = filledPrice,
                        pnl = pnl,
                        pnlRate = pnlRate,
                        feeTotal = fees.total + buyFees.total,
                        strategy = order.strategy,
                        signal = order.signal,
                        boughtAt = position.boughtAt,
                        soldAt = now,
                        environment = dbEnv,
                    ))

                    val remainingQty = position.quantity - filledQty
                    if (remainingQty <= 0) {
                        positionDao.deleteByStrategy(order.stockCode, strategyId, dbEnv)
                    } else {
                        positionDao.upsert(position.copy(
                            quantity = remainingQty,
                            updatedAt = now,
                        ))
                    }
                }
            }
        }

        val logAction = if (order.side == "buy") "BUY" else "SELL"
        logEvent("FILL", logAction, "${order.stockCode} qty=$filledQty @ $filledPrice fee=${String.format("%.0f", fees.total)}")
    }

    /** 해당 종목에 활성 매도 주문이 있는지 확인 */
    suspend fun hasActiveSellOrder(stockCode: String): Boolean {
        return orderDao.getActiveOrdersForStock(stockCode, "sell", dbEnv).isNotEmpty()
    }

    /** 종목의 최근 매수 주문에서 전략 ID를 조회 */
    suspend fun getLatestBuyStrategy(stockCode: String): String? {
        val orders = orderDao.getByStockCodeAndSide(stockCode, "buy", dbEnv)
        return orders.firstOrNull()?.strategy
    }

    private suspend fun logEvent(type: String, action: String, detail: String) {
        eventLogDao.insert(EventLogEntity(
            type = type,
            action = action,
            detail = detail,
            createdAt = now,
        ))
    }
}
