package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.StrategyConfigEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StrategyConfigDao {
    @Insert
    suspend fun insert(config: StrategyConfigEntity): Long

    @Update
    suspend fun update(config: StrategyConfigEntity)

    @Query("SELECT * FROM strategy_config WHERE enabled = 1 ORDER BY id DESC LIMIT 1")
    suspend fun getLatestEnabled(): StrategyConfigEntity?

    @Query("SELECT * FROM strategy_config ORDER BY id DESC")
    fun observeAll(): Flow<List<StrategyConfigEntity>>

    @Query("UPDATE strategy_config SET enabled = 0 WHERE id != :id")
    suspend fun disableAllExcept(id: Long)
}
