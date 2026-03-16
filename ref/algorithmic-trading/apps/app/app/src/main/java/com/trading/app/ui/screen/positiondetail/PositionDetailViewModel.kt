package com.trading.app.ui.screen.positiondetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.data.local.db.dao.OrderDao
import com.trading.app.data.local.db.dao.PositionDao
import com.trading.app.data.local.db.entity.DailyCandleEntity
import com.trading.app.data.local.db.entity.OrderEntity
import com.trading.app.data.local.db.entity.PositionEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

data class PositionDetailUiState(
    val position: PositionEntity? = null,
    val buyOrders: List<OrderEntity> = emptyList(),
    val dailyCandles: List<DailyCandleEntity> = emptyList(),
    val holdingDays: Int = 0,
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class PositionDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val positionDao: PositionDao,
    private val orderDao: OrderDao,
    private val candleDao: DailyCandleDao,
    private val prefs: com.trading.app.data.local.prefs.AppPreferences,
) : ViewModel() {

    private val stockCode: String = checkNotNull(savedStateHandle["stockCode"])

    private val _state = MutableStateFlow(PositionDetailUiState())
    val state: StateFlow<PositionDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            val position = positionDao.getByStockCode(stockCode, prefs.environment)
            if (position == null) {
                _state.update { it.copy(isLoading = false, error = "포지션을 찾을 수 없습니다") }
                return@launch
            }

            val buyOrders = orderDao.getByStockCodeAndSide(stockCode, "BUY", prefs.environment)

            val fromDate = position.boughtAt.take(10)
            val toDate = LocalDate.now().toString()
            val candles = candleDao.getByDateRange(stockCode, fromDate, toDate)

            val holdingDays = if (candles.size >= 2) {
                candles.size
            } else {
                try {
                    ChronoUnit.DAYS.between(
                        LocalDate.parse(fromDate),
                        LocalDate.now(),
                    ).toInt().coerceAtLeast(1)
                } catch (_: Exception) { 1 }
            }

            _state.update {
                it.copy(
                    position = position,
                    buyOrders = buyOrders,
                    dailyCandles = candles,
                    holdingDays = holdingDays,
                    isLoading = false,
                )
            }
        }
    }
}
