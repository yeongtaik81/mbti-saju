package com.trading.app.data.local.db.dao

import androidx.room.*
import com.trading.app.data.local.db.entity.PortfolioSnapshotEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PortfolioSnapshotDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(snapshot: PortfolioSnapshotEntity)

    @Query("SELECT * FROM portfolio_snapshots WHERE date = :date")
    suspend fun getByDate(date: String): PortfolioSnapshotEntity?

    @Query("SELECT * FROM portfolio_snapshots ORDER BY date DESC LIMIT 1")
    suspend fun getLatest(): PortfolioSnapshotEntity?

    @Query("SELECT * FROM portfolio_snapshots ORDER BY date DESC LIMIT :limit")
    fun observeRecent(limit: Int = 30): Flow<List<PortfolioSnapshotEntity>>
}
