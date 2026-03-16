package com.trading.app.ui.screen.trades

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trading.app.data.local.db.dao.TradeDao
import com.trading.app.data.local.db.entity.TradeEntity
import com.trading.app.data.local.prefs.AppPreferences
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TradesUiState(
    val trades: List<TradeEntity> = emptyList(),
    val isLoading: Boolean = false,
    val hasMore: Boolean = true,
)

@HiltViewModel
class TradesViewModel @Inject constructor(
    private val tradeDao: TradeDao,
    private val prefs: AppPreferences,
) : ViewModel() {

    private val _state = MutableStateFlow(TradesUiState())
    val state: StateFlow<TradesUiState> = _state.asStateFlow()

    init {
        loadPage()
    }

    fun loadMore() {
        val current = _state.value
        if (current.isLoading || !current.hasMore) return
        loadPage()
    }

    private fun loadPage() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true) }
            val offset = _state.value.trades.size
            val env = prefs.environment
            val page = tradeDao.getRecent(env, PAGE_SIZE, offset)
            val total = tradeDao.count(env)
            _state.update { prev ->
                val newList = prev.trades + page
                prev.copy(
                    trades = newList,
                    isLoading = false,
                    hasMore = newList.size < total,
                )
            }
        }
    }

    companion object {
        private const val PAGE_SIZE = 20
    }
}
