package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "market_calendar")
data class MarketCalendarEntity(
    @PrimaryKey val date: String,
    val type: String,
    @ColumnInfo(name = "open_time") val openTime: String = "09:00",
    @ColumnInfo(name = "close_time") val closeTime: String = "15:30",
    val description: String = "",
)
