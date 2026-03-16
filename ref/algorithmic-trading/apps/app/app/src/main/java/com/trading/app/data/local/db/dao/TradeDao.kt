package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.TradeEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface TradeDao {
    @Insert
    suspend fun insert(trade: TradeEntity): Long

    @Query("SELECT * FROM trades WHERE environment = :env ORDER BY sold_at DESC LIMIT :limit OFFSET :offset")
    suspend fun getRecent(env: String, limit: Int = 50, offset: Int = 0): List<TradeEntity>

    @Query("SELECT * FROM trades WHERE environment = :env ORDER BY sold_at DESC")
    fun observeAll(env: String): Flow<List<TradeEntity>>

    @Query("SELECT * FROM trades WHERE date(sold_at) >= :fromDate AND date(sold_at) <= :toDate AND environment = :env ORDER BY sold_at DESC")
    suspend fun getByDateRange(fromDate: String, toDate: String, env: String): List<TradeEntity>

    @Query("SELECT SUM(pnl) FROM trades WHERE date(sold_at) = :date AND environment = :env")
    suspend fun getDailyPnl(date: String, env: String): Double?

    @Query("SELECT COUNT(*) FROM trades WHERE environment = :env")
    suspend fun count(env: String): Int

    @Query("SELECT * FROM trades WHERE id = :id")
    suspend fun getById(id: Long): TradeEntity?
}
