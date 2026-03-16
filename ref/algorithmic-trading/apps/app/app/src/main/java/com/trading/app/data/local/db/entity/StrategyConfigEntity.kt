package com.trading.app.data.local.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "strategy_config")
data class StrategyConfigEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val enabled: Int = 0,
    val params: String = "{}",
    @ColumnInfo(name = "risk_params") val riskParams: String = "{}",
    @ColumnInfo(name = "screening_params") val screeningParams: String = "{}",
    val version: Int = 1,
    @ColumnInfo(name = "effective_from") val effectiveFrom: String,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
)
