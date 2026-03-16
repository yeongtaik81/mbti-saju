package com.trading.app.worker

import android.content.Context
import android.util.Log
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.trading.app.data.local.db.dao.PositionDao
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.repository.MarketDataRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@HiltWorker
class PostMarketWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val marketDataRepo: MarketDataRepository,
    private val positionDao: PositionDao,
    private val prefs: AppPreferences,
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "PostMarketWorker"
    }

    override suspend fun doWork(): Result {
        if (!prefs.hasApiKeys()) return Result.success()

        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val startDate = LocalDate.now().minusDays(5).format(DateTimeFormatter.ISO_LOCAL_DATE)

        // Fetch latest candles for all held positions
        val positions = positionDao.getAll(prefs.environment)
        for (pos in positions) {
            try {
                marketDataRepo.fetchAndSaveDailyCandles(pos.stockCode, startDate, today)
                delay(200) // rate limit
            } catch (e: Exception) {
                Log.w(TAG, "Failed to update candles for ${pos.stockCode}: ${e.message}")
            }
        }

        return Result.success()
    }
}
