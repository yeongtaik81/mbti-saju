package com.trading.app.data.local.db.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import com.trading.app.data.local.db.entity.StockEntity

@Dao
interface StockDao {

    @Query("SELECT stock_name FROM stocks WHERE stock_code = :stockCode LIMIT 1")
    suspend fun getStockName(stockCode: String): String?

    @Query("SELECT * FROM stocks WHERE stock_code IN (:codes)")
    suspend fun getByStockCodes(codes: List<String>): List<StockEntity>

    @Query("SELECT COUNT(*) FROM stocks")
    suspend fun count(): Int

    @Upsert
    suspend fun upsertAll(stocks: List<StockEntity>)
}
