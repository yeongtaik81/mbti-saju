package com.trading.app.service

import android.app.NotificationManager
import android.content.Intent
import android.os.IBinder
import android.util.Log
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.trading.app.engine.TradingEngine
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest
import javax.inject.Inject

@AndroidEntryPoint
class TradingService : LifecycleService() {

    @Inject lateinit var engine: TradingEngine

    private var engineJob: Job? = null

    companion object {
        private const val TAG = "TradingService"
        const val ACTION_START = "com.trading.app.START_TRADING"
        const val ACTION_STOP = "com.trading.app.STOP_TRADING"
    }

    override fun onCreate() {
        super.onCreate()
        TradingNotification.createChannel(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        when (intent?.action) {
            ACTION_STOP -> {
                stopTradingEngine()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
        }

        startForeground(
            TradingNotification.NOTIFICATION_ID,
            TradingNotification.build(this, "1조 프로젝트", "엔진 시작 중...")
        )

        startTradingEngine()

        return START_STICKY
    }

    private fun startTradingEngine() {
        if (engineJob?.isActive == true) return

        // Observe state for notification updates
        lifecycleScope.launch {
            engine.state.collectLatest { state ->
                val notification = TradingNotification.build(
                    this@TradingService,
                    "1조 프로젝트 - ${state.sessionState.label}",
                    "${state.regime} | 자산: ${String.format("%,.0f", state.totalEquity)}원 | ${state.message}"
                )
                val manager = getSystemService(NotificationManager::class.java)
                manager.notify(TradingNotification.NOTIFICATION_ID, notification)
            }
        }

        engineJob = lifecycleScope.launch(Dispatchers.Default) {
            try {
                while (isActive) {
                    engine.prepare(this)
                    engine.operate(this)
                }
            } catch (e: CancellationException) {
                Log.i(TAG, "Engine cancelled")
                engine.onManualStop()
            } catch (e: Exception) {
                Log.e(TAG, "Engine error: ${e.message}", e)
            } finally {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
    }

    private fun stopTradingEngine() {
        engineJob?.cancel()
        engineJob = null
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    override fun onDestroy() {
        stopTradingEngine()
        super.onDestroy()
    }
}
