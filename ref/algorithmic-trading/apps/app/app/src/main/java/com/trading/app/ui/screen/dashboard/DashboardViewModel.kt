package com.trading.app.ui.screen.dashboard

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.domain.model.SessionState
import com.trading.app.engine.EngineState
import com.trading.app.engine.TradingEngine
import com.trading.app.service.TradingService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val engine: TradingEngine,
    private val prefs: AppPreferences,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    val engineState: StateFlow<EngineState> = engine.state
    val isProduction: Boolean get() = prefs.isProduction

    init {
        // 앱 구동시 자동 시작 설정이 켜져 있고 엔진이 IDLE이면 자동 시작
        if (prefs.autoStartEnabled && engine.state.value.sessionState == SessionState.IDLE) {
            startEngine()
        }
    }

    fun startEngine() {
        val intent = Intent(context, TradingService::class.java).apply {
            action = TradingService.ACTION_START
        }
        ContextCompat.startForegroundService(context, intent)
    }

    fun stopEngine() {
        val intent = Intent(context, TradingService::class.java).apply {
            action = TradingService.ACTION_STOP
        }
        context.startService(intent)
    }
}
