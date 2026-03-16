package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.OrderEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface OrderDao {
    @Insert
    suspend fun insert(order: OrderEntity): Long

    @Update
    suspend fun update(order: OrderEntity)

    @Query("SELECT * FROM orders WHERE order_id = :orderId")
    suspend fun getByOrderId(orderId: String): OrderEntity?

    @Query("SELECT * FROM orders WHERE kis_order_no = :kisOrderNo")
    suspend fun getByKisOrderNo(kisOrderNo: String): OrderEntity?

    @Query("SELECT * FROM orders WHERE status NOT IN ('FILLED', 'REJECTED', 'CANCELLED', 'ERROR') AND environment = :env ORDER BY created_at DESC")
    suspend fun getActiveOrders(env: String): List<OrderEntity>

    @Query("SELECT * FROM orders WHERE status = :status AND environment = :env ORDER BY created_at DESC")
    suspend fun getByStatus(status: String, env: String): List<OrderEntity>

    @Query("SELECT * FROM orders WHERE stock_code = :stockCode AND side = :side AND status NOT IN ('FILLED', 'REJECTED', 'CANCELLED', 'ERROR', 'CREATED') AND environment = :env")
    suspend fun getActiveOrdersForStock(stockCode: String, side: String, env: String): List<OrderEntity>

    @Query("SELECT * FROM orders WHERE environment = :env ORDER BY created_at DESC LIMIT :limit")
    fun observeRecentOrders(env: String, limit: Int = 50): Flow<List<OrderEntity>>

    @Query("SELECT * FROM orders WHERE date(created_at) = :date AND environment = :env ORDER BY created_at DESC")
    suspend fun getOrdersByDate(date: String, env: String): List<OrderEntity>

    @Query("UPDATE orders SET status = :status, updated_at = :updatedAt WHERE order_id = :orderId")
    suspend fun updateStatus(orderId: String, status: String, updatedAt: String)

    @Query("UPDATE orders SET kis_order_no = :kisOrderNo, status = :status, updated_at = :updatedAt WHERE order_id = :orderId")
    suspend fun updateSubmitted(orderId: String, kisOrderNo: String, status: String, updatedAt: String)

    @Query("UPDATE orders SET filled_quantity = :filledQty, filled_price = :filledPrice, status = :status, updated_at = :updatedAt WHERE order_id = :orderId")
    suspend fun updateFilled(orderId: String, filledQty: Int, filledPrice: Double, status: String, updatedAt: String)

    @Query("SELECT strategy FROM orders WHERE order_id = :orderId")
    suspend fun getStrategy(orderId: String): String?

    @Query("SELECT * FROM orders WHERE stock_code = :stockCode AND side = :side AND environment = :env ORDER BY created_at DESC")
    suspend fun getByStockCodeAndSide(stockCode: String, side: String, env: String): List<OrderEntity>
}
