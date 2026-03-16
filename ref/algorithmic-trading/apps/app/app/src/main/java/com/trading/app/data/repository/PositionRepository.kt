package com.trading.app.data.repository

import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.data.local.db.dao.PortfolioSnapshotDao
import com.trading.app.data.local.db.dao.PositionDao
import com.trading.app.data.local.db.entity.PortfolioSnapshotEntity
import com.trading.app.data.local.db.entity.PositionEntity
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.domain.model.Position
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PositionRepository @Inject constructor(
    private val positionDao: PositionDao,
    private val candleDao: DailyCandleDao,
    private val snapshotDao: PortfolioSnapshotDao,
    private val prefs: AppPreferences,
) {
    private val env get() = prefs.environment

    fun observePositions(): Flow<List<Position>> =
        positionDao.observeAll(env).map { entities ->
            entities.map { it.toDomain() }
        }

    suspend fun getOpenPositions(): List<Position> =
        positionDao.getAll(env).map { it.toDomain() }

    suspend fun getPositionCount(): Int = positionDao.count(env)

    suspend fun updatePrice(stockCode: String, price: Double) {
        val position = positionDao.getByStockCode(stockCode, env) ?: return
        val pnl = (price - position.avgPrice) * position.quantity
        val pnlRate = if (position.avgPrice > 0) (price - position.avgPrice) / position.avgPrice else 0.0
        val now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
        positionDao.updatePrice(stockCode, env, price, pnl, pnlRate, now)
    }

    /** 보유 거래일 수 계산 */
    suspend fun getHoldingDays(stockCode: String, today: String): Int {
        val position = positionDao.getByStockCode(stockCode, env) ?: return 0
        val boughtDate = position.boughtAt.take(10) // YYYY-MM-DD
        val tradingDays = candleDao.countTradingDaysSince(boughtDate, today)
        return tradingDays + 1 // +1: 오늘도 거래일
    }

    suspend fun saveSnapshot(date: String, totalValue: Double, cash: Double, stockValue: Double) {
        val prev = snapshotDao.getLatest()
        val dailyPnl = if (prev != null) totalValue - prev.totalValue else 0.0
        val dailyPnlRate = if (prev != null && prev.totalValue > 0) dailyPnl / prev.totalValue else 0.0

        val initialValue = snapshotDao.getByDate("initial")?.totalValue ?: totalValue
        val cumPnlRate = if (initialValue > 0) (totalValue - initialValue) / initialValue else 0.0

        val now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
        snapshotDao.upsert(PortfolioSnapshotEntity(
            date = date,
            totalValue = totalValue,
            cash = cash,
            stockValue = stockValue,
            dailyPnl = dailyPnl,
            dailyPnlRate = dailyPnlRate,
            cumulativePnlRate = cumPnlRate,
            createdAt = now,
        ))
    }

    private fun PositionEntity.toDomain() = Position(
        id = id,
        stockCode = stockCode,
        stockName = stockName,
        quantity = quantity,
        avgPrice = avgPrice,
        currentPrice = currentPrice,
        pnl = pnl,
        pnlRate = pnlRate,
        boughtAt = boughtAt,
        updatedAt = updatedAt,
        strategyId = strategyId,
        source = source,
    )
}
