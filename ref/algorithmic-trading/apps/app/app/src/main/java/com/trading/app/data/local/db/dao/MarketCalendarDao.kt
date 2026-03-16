package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.MarketCalendarEntity

@Dao
interface MarketCalendarDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: MarketCalendarEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entries: List<MarketCalendarEntity>)

    @Query("SELECT * FROM market_calendar WHERE date = :date")
    suspend fun getByDate(date: String): MarketCalendarEntity?

    @Query("SELECT EXISTS(SELECT 1 FROM market_calendar WHERE date = :date AND type = 'HOLIDAY')")
    suspend fun isHoliday(date: String): Boolean
}
