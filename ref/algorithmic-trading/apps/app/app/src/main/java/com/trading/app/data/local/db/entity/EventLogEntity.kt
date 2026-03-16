package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "event_log",
    indices = [Index("type"), Index("created_at")]
)
data class EventLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: String,
    val action: String,
    val detail: String = "{}",
    @ColumnInfo(name = "created_at") val createdAt: String,
)
