package com.trading.app.ui.screen.tradedetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.data.local.db.dao.ExecutionDao
import com.trading.app.data.local.db.dao.TradeDao
import com.trading.app.data.local.db.entity.DailyCandleEntity
import com.trading.app.data.local.db.entity.ExecutionEntity
import com.trading.app.data.local.db.entity.TradeEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

data class TradeDetailUiState(
    val trade: TradeEntity? = null,
    val buyExecutions: List<ExecutionEntity> = emptyList(),
    val sellExecutions: List<ExecutionEntity> = emptyList(),
    val dailyCandles: List<DailyCandleEntity> = emptyList(),
    val holdingDays: Int = 0,
    val isLoading: Boolean = true,
    val error: String? = null,
)

@HiltViewModel
class TradeDetailViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val tradeDao: TradeDao,
    private val executionDao: ExecutionDao,
    private val candleDao: DailyCandleDao,
) : ViewModel() {

    private val tradeId: Long = checkNotNull(savedStateHandle["tradeId"])

    private val _state = MutableStateFlow(TradeDetailUiState())
    val state: StateFlow<TradeDetailUiState> = _state.asStateFlow()

    init {
        load()
    }

    private fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            val trade = tradeDao.getById(tradeId)
            if (trade == null) {
                _state.update { it.copy(isLoading = false, error = "매매 내역을 찾을 수 없습니다") }
                return@launch
            }

            val buyExecs = executionDao.getByOrderId(trade.buyOrderId)
            val sellExecs = executionDao.getByOrderId(trade.sellOrderId)

            val fromDate = trade.boughtAt.take(10)
            val toDate = trade.soldAt.take(10)
            val candles = candleDao.getByDateRange(trade.stockCode, fromDate, toDate)

            val holdingDays = if (candles.size >= 2) {
                candles.size
            } else {
                try {
                    ChronoUnit.DAYS.between(
                        LocalDate.parse(fromDate),
                        LocalDate.parse(toDate),
                    ).toInt().coerceAtLeast(1)
                } catch (_: Exception) { 1 }
            }

            _state.update {
                it.copy(
                    trade = trade,
                    buyExecutions = buyExecs,
                    sellExecutions = sellExecs,
                    dailyCandles = candles,
                    holdingDays = holdingDays,
                    isLoading = false,
                )
            }
        }
    }
}
