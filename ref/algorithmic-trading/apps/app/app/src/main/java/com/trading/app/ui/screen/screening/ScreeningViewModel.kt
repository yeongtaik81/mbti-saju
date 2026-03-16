package com.trading.app.ui.screen.screening

import androidx.lifecycle.ViewModel
import com.trading.app.engine.EngineState
import com.trading.app.engine.TradingEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class ScreeningViewModel @Inject constructor(
    engine: TradingEngine,
) : ViewModel() {
    val engineState: StateFlow<EngineState> = engine.state
}
