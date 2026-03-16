package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.ExecutionEntity

@Dao
interface ExecutionDao {
    @Insert
    suspend fun insert(execution: ExecutionEntity): Long

    @Query("SELECT * FROM executions WHERE order_id = :orderId")
    suspend fun getByOrderId(orderId: String): List<ExecutionEntity>

    @Query("SELECT * FROM executions WHERE date(executed_at) = :date ORDER BY executed_at DESC")
    suspend fun getByDate(date: String): List<ExecutionEntity>
}
