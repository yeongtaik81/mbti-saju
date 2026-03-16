package com.trading.app.ui.screen.positions

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trading.app.data.remote.kis.KisConfig
import com.trading.app.data.remote.kis.KisEnv
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.repository.MarketDataRepository
import com.trading.app.data.repository.OrderRepository
import com.trading.app.data.repository.PositionRepository
import com.trading.app.domain.model.OrderSide
import com.trading.app.domain.model.Position
import com.trading.app.domain.model.Signal
import com.trading.app.domain.model.StrategySpec
import com.trading.app.engine.TradingEngine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class SellResult(val success: Boolean, val message: String)

data class PositionDisplayInfo(
    val position: Position,
    val holdingDays: Int,
    val maxHoldDays: Int,
)

@HiltViewModel
class PositionsViewModel @Inject constructor(
    positionRepo: PositionRepository,
    private val engine: TradingEngine,
    private val marketDataRepo: MarketDataRepository,
    private val orderRepo: OrderRepository,
    private val positionRepository: PositionRepository,
    private val prefs: AppPreferences,
) : ViewModel() {
    @OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
    val positionsWithInfo: Flow<List<PositionDisplayInfo>> = positionRepo.observePositions()
        .mapLatest { positions ->
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val maxHoldDays = StrategySpec.active().maxHoldDays
            positions.map { pos ->
                val holdingDays = positionRepository.getHoldingDays(pos.stockCode, today)
                PositionDisplayInfo(pos, holdingDays, maxHoldDays)
            }
        }

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing = _isRefreshing.asStateFlow()

    private val _isSelling = MutableStateFlow(false)
    val isSelling = _isSelling.asStateFlow()

    private val _sellResult = MutableSharedFlow<SellResult>()
    val sellResult = _sellResult.asSharedFlow()

    companion object {
        private const val TAG = "PositionsVM"
    }

    /** 탭 진입 시 또는 pull-to-refresh 시 KIS 잔고 동기화 */
    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                engine.syncPositions()
            } catch (e: Exception) {
                Log.w(TAG, "refresh failed: ${e.message}")
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    /** 전 종목 현재가 갱신 */
    fun refreshPrices() {
        viewModelScope.launch {
            _isRefreshing.value = true
            try {
                val positions = positionRepository.getOpenPositions()
                val apiDelay = KisConfig.getApiDelayMs(KisEnv.fromString(prefs.kisEnv))
                for (pos in positions) {
                    try {
                        val price = marketDataRepo.getCurrentPrice(pos.stockCode)
                        positionRepository.updatePrice(pos.stockCode, price.price)
                        delay(apiDelay)
                    } catch (e: Exception) {
                        Log.w(TAG, "Price update failed for ${pos.stockCode}: ${e.message}")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "refreshPrices failed: ${e.message}")
            } finally {
                _isRefreshing.value = false
            }
        }
    }

    /** 수동 시장가 매도 */
    fun sellPosition(position: Position) {
        viewModelScope.launch {
            _isSelling.value = true
            try {
                val now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                val signal = Signal(
                    stockCode = position.stockCode,
                    stockName = position.stockName,
                    side = OrderSide.SELL,
                    reason = "manual_sell",
                    confidence = 1.0,
                    price = 0.0, // 시장가
                    quantity = position.quantity,
                    strategyId = position.strategyId,
                    timestamp = now,
                )
                orderRepo.placeOrder(signal)
                _sellResult.emit(SellResult(true, "${position.stockName} 매도 주문 완료"))
            } catch (e: Exception) {
                Log.e(TAG, "sellPosition failed: ${e.message}", e)
                _sellResult.emit(SellResult(false, "매도 실패: ${e.message}"))
            } finally {
                _isSelling.value = false
            }
        }
    }
}
