package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.PositionEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PositionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(position: PositionEntity)

    @Query("SELECT * FROM positions WHERE stock_code = :stockCode AND strategy_id = :strategyId AND environment = :env")
    suspend fun getByStockCodeAndStrategy(stockCode: String, strategyId: String, env: String): PositionEntity?

    @Query("SELECT * FROM positions WHERE stock_code = :stockCode AND environment = :env")
    suspend fun getByStockCode(stockCode: String, env: String): PositionEntity?

    @Query("SELECT * FROM positions WHERE environment = :env ORDER BY pnl_rate DESC")
    suspend fun getAll(env: String): List<PositionEntity>

    @Query("SELECT * FROM positions WHERE environment = :env ORDER BY pnl_rate DESC")
    fun observeAll(env: String): Flow<List<PositionEntity>>

    @Query("SELECT COUNT(*) FROM positions WHERE environment = :env")
    suspend fun count(env: String): Int

    @Query("SELECT COUNT(*) FROM positions WHERE strategy_id = :strategyId AND environment = :env")
    suspend fun countByStrategy(strategyId: String, env: String): Int

    @Query("DELETE FROM positions WHERE stock_code = :stockCode AND strategy_id = :strategyId AND environment = :env")
    suspend fun deleteByStrategy(stockCode: String, strategyId: String, env: String)

    @Query("DELETE FROM positions WHERE stock_code = :stockCode AND environment = :env")
    suspend fun delete(stockCode: String, env: String)

    @Query("UPDATE positions SET current_price = :price, pnl = :pnl, pnl_rate = :pnlRate, updated_at = :updatedAt WHERE stock_code = :stockCode AND strategy_id = :strategyId AND environment = :env")
    suspend fun updatePriceByStrategy(stockCode: String, strategyId: String, env: String, price: Double, pnl: Double, pnlRate: Double, updatedAt: String)

    @Query("UPDATE positions SET current_price = :price, pnl = :pnl, pnl_rate = :pnlRate, updated_at = :updatedAt WHERE stock_code = :stockCode AND environment = :env")
    suspend fun updatePrice(stockCode: String, env: String, price: Double, pnl: Double, pnlRate: Double, updatedAt: String)
}
