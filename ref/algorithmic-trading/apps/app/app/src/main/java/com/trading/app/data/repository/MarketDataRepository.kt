package com.trading.app.data.repository

import android.util.Log
import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.data.local.db.dao.PositionDao
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.remote.kis.KisApi
import com.trading.app.data.remote.kis.KisConfig
import com.trading.app.data.remote.kis.KisEnv
import com.trading.app.data.remote.mapper.KisMapper
import com.trading.app.domain.model.Candle
import com.trading.app.domain.model.PortfolioContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MarketDataRepository @Inject constructor(
    private val kisApi: KisApi,
    private val candleDao: DailyCandleDao,
    private val positionDao: PositionDao,
    private val prefs: AppPreferences,
) {
    private val env get() = KisEnv.fromString(prefs.kisEnv)

    companion object {
        private const val TAG = "MarketDataRepo"
    }

    suspend fun getCurrentPrice(stockCode: String): KisMapper.CurrentPrice {
        val trId = KisConfig.getTrId(env, "currentPrice")
        val response = kisApi.getCurrentPrice(trId = trId, stockCode = stockCode)
        if (response.rtCd != "0") throw RuntimeException("KIS error: ${response.msg1}")
        return KisMapper.toCurrentPrice(response.output!!)
    }

    suspend fun fetchAndSaveDailyCandles(stockCode: String, startDate: String, endDate: String): List<Candle> {
        val trId = KisConfig.getTrId(env, "dailyCandle")
        val response = kisApi.getDailyCandles(
            trId = trId,
            stockCode = stockCode,
            startDate = startDate.replace("-", ""),
            endDate = endDate.replace("-", ""),
        )
        if (response.rtCd != "0") throw RuntimeException("KIS error: ${response.msg1}")

        val items = response.output2 ?: emptyList()
        val entities = items.map { KisMapper.toDailyCandleEntity(it, stockCode) }
        if (entities.isNotEmpty()) {
            candleDao.upsertAll(entities)
        }

        return items.map { KisMapper.toCandle(it, stockCode) }
    }

    suspend fun getCandlesFromDb(stockCode: String, limit: Int = 60): List<Candle> {
        return candleDao.getRecent(stockCode, limit)
            .sortedBy { it.date }
            .map { entity ->
                Candle(
                    stockCode = entity.stockCode,
                    date = entity.date,
                    open = entity.open,
                    high = entity.high,
                    low = entity.low,
                    close = entity.close,
                    adjClose = entity.adjClose,
                    volume = entity.volume,
                    amount = entity.amount.toLong(),
                )
            }
    }

    suspend fun getBalance(): BalanceResult {
        val trId = KisConfig.getTrId(env, "balance")
        val cano = prefs.accountNo.take(8)
        val acntPrdtCd = prefs.accountProductCode

        val response = kisApi.getBalance(trId = trId, cano = cano, acntPrdtCd = acntPrdtCd)
        if (response.rtCd != "0") throw RuntimeException("KIS error: ${response.msg1}")

        val summary = response.output2?.firstOrNull()
        return BalanceResult(
            cash = summary?.dncaTotAmt?.toDoubleOrNull() ?: 0.0,
            totalValue = summary?.totEvluAmt?.toDoubleOrNull() ?: 0.0,
            items = response.output1 ?: emptyList(),
        )
    }

    /**
     * 매수가능현금 조회 (inquire-psbl-order API)
     * dncaTotAmt(예수금)과 달리 미체결/미수 등을 반영한 실제 주문가능금액
     */
    suspend fun getOrderableCash(): Double {
        val trId = KisConfig.getTrId(env, "orderableCash")
        val cano = prefs.accountNo.take(8)
        val acntPrdtCd = prefs.accountProductCode
        val response = kisApi.getOrderableCash(trId = trId, cano = cano, acntPrdtCd = acntPrdtCd)
        if (response.rtCd != "0") throw RuntimeException("KIS error: ${response.msg1}")
        return response.output?.ordPsblCash?.toDoubleOrNull() ?: 0.0
    }

    suspend fun getPortfolioContext(): PortfolioContext {
        val balance = getBalance()
        val positionCount = positionDao.count(prefs.environment)
        return PortfolioContext(
            cash = balance.cash,
            totalEquity = balance.totalValue,
            currentPositionCount = positionCount,
        )
    }

    data class BalanceResult(
        val cash: Double,
        val totalValue: Double,
        val items: List<com.trading.app.data.remote.kis.dto.KisBalanceItem>,
    )
}
