package com.trading.app.di

import android.content.Context
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.trading.app.data.local.db.TradingDatabase
import com.trading.app.data.local.db.dao.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    private val MIGRATION_4_5 = object : Migration(4, 5) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL("ALTER TABLE positions ADD COLUMN source TEXT NOT NULL DEFAULT 'engine'")
        }
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): TradingDatabase =
        Room.databaseBuilder(context, TradingDatabase::class.java, "trading.db")
            .addMigrations(MIGRATION_4_5)
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    fun provideAppScope(): CoroutineScope =
        CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Provides fun provideOrderDao(db: TradingDatabase): OrderDao = db.orderDao()
    @Provides fun provideExecutionDao(db: TradingDatabase): ExecutionDao = db.executionDao()
    @Provides fun provideTradeDao(db: TradingDatabase): TradeDao = db.tradeDao()
    @Provides fun providePositionDao(db: TradingDatabase): PositionDao = db.positionDao()
    @Provides fun providePortfolioSnapshotDao(db: TradingDatabase): PortfolioSnapshotDao = db.portfolioSnapshotDao()
    @Provides fun provideDailyCandleDao(db: TradingDatabase): DailyCandleDao = db.dailyCandleDao()
    @Provides fun provideStrategyConfigDao(db: TradingDatabase): StrategyConfigDao = db.strategyConfigDao()
    @Provides fun provideMarketCalendarDao(db: TradingDatabase): MarketCalendarDao = db.marketCalendarDao()
    @Provides fun provideEventLogDao(db: TradingDatabase): EventLogDao = db.eventLogDao()
    @Provides fun provideStockDao(db: TradingDatabase): StockDao = db.stockDao()
}
