package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.EventLogEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface EventLogDao {
    @Insert
    suspend fun insert(event: EventLogEntity): Long

    @Query("SELECT * FROM event_log ORDER BY created_at DESC LIMIT :limit")
    fun observeRecent(limit: Int = 100): Flow<List<EventLogEntity>>

    @Query("SELECT * FROM event_log WHERE type = :type ORDER BY created_at DESC LIMIT :limit")
    suspend fun getByType(type: String, limit: Int = 50): List<EventLogEntity>

    @Query("SELECT * FROM event_log WHERE type = :type ORDER BY created_at DESC LIMIT :limit")
    fun observeByType(type: String, limit: Int = 200): Flow<List<EventLogEntity>>

    @Query("SELECT DISTINCT type FROM event_log ORDER BY type")
    fun observeTypes(): Flow<List<String>>

    @Query("DELETE FROM event_log WHERE created_at < :cutoffDate")
    suspend fun deleteOlderThan(cutoffDate: String)
}
