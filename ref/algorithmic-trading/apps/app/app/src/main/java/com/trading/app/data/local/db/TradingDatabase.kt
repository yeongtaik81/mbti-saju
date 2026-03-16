package com.trading.app.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.trading.app.data.local.db.dao.*
import com.trading.app.data.local.db.entity.*

@Database(
    entities = [
        OrderEntity::class,
        ExecutionEntity::class,
        TradeEntity::class,
        PositionEntity::class,
        PortfolioSnapshotEntity::class,
        DailyCandleEntity::class,
        StrategyConfigEntity::class,
        MarketCalendarEntity::class,
        EventLogEntity::class,
        StockEntity::class,
    ],
    version = 5,
    exportSchema = false,
)
abstract class TradingDatabase : RoomDatabase() {
    abstract fun orderDao(): OrderDao
    abstract fun executionDao(): ExecutionDao
    abstract fun tradeDao(): TradeDao
    abstract fun positionDao(): PositionDao
    abstract fun portfolioSnapshotDao(): PortfolioSnapshotDao
    abstract fun dailyCandleDao(): DailyCandleDao
    abstract fun strategyConfigDao(): StrategyConfigDao
    abstract fun marketCalendarDao(): MarketCalendarDao
    abstract fun eventLogDao(): EventLogDao
    abstract fun stockDao(): StockDao
}
