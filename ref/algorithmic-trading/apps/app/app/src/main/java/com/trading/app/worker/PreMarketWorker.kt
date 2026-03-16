package com.trading.app.worker

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.trading.app.data.local.db.dao.MarketCalendarDao
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.service.TradingService
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@HiltWorker
class PreMarketWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val calendarDao: MarketCalendarDao,
    private val prefs: AppPreferences,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (!prefs.hasApiKeys()) return Result.success()
        if (!prefs.autoStartEnabled) return Result.success()

        val today = LocalDate.now()

        // 주말 체크
        if (today.dayOfWeek == DayOfWeek.SATURDAY || today.dayOfWeek == DayOfWeek.SUNDAY) {
            return Result.success()
        }

        // 휴장일 체크
        val dateStr = today.format(DateTimeFormatter.ISO_LOCAL_DATE)
        if (calendarDao.isHoliday(dateStr)) {
            return Result.success()
        }

        // Start TradingService
        val intent = Intent(applicationContext, TradingService::class.java).apply {
            action = TradingService.ACTION_START
        }
        ContextCompat.startForegroundService(applicationContext, intent)

        return Result.success()
    }
}
