package com.trading.app.ui.screen.settings

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trading.app.data.local.SeedDataImporter
import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.data.local.db.dao.StockDao
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.repository.MarketDataRepository
import com.trading.app.domain.model.SessionState
import com.trading.app.engine.TradingEngine
import com.trading.app.service.TradingService
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class SettingsState(
    val virtualAppKey: String = "",
    val virtualAppSecret: String = "",
    val virtualAccountNo: String = "",
    val prodAppKey: String = "",
    val prodAppSecret: String = "",
    val prodAccountNo: String = "",
    val kisEnv: String = "virtual",
    val autoStart: Boolean = true,
    val pollingIntervalSec: Int = 30,
    val maxPositions: Int = 10,
    val maxPositionWeightPct: Int = 10,
    val maxPositionAmount: Long = 1_000_000L,
    val candleDataInfo: String = "",
    val importStatus: String? = null,
    val gapFillRunning: Boolean = false,
    val gapFillCurrentDate: String? = null,
    val gapFillProgress: String? = null,
    val gapFillLogs: List<String> = emptyList(),
    val gapFillSummary: String? = null,
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val prefs: AppPreferences,
    private val seedImporter: SeedDataImporter,
    private val candleDao: DailyCandleDao,
    private val stockDao: StockDao,
    private val marketDataRepo: MarketDataRepository,
    private val engine: TradingEngine,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private var gapFillJob: Job? = null

    private val _state = MutableStateFlow(loadState())
    val state = _state.asStateFlow()

    private fun loadState() = SettingsState(
        virtualAppKey = prefs.virtualAppKey,
        virtualAppSecret = prefs.virtualAppSecret,
        virtualAccountNo = prefs.virtualAccountNo,
        prodAppKey = prefs.prodAppKey,
        prodAppSecret = prefs.prodAppSecret,
        prodAccountNo = prefs.prodAccountNo,
        kisEnv = prefs.kisEnv,
        autoStart = prefs.autoStartEnabled,
        pollingIntervalSec = (prefs.pollingIntervalMs / 1000).toInt(),
        maxPositions = prefs.maxPositions,
        maxPositionWeightPct = prefs.maxPositionWeightPct,
        maxPositionAmount = prefs.maxPositionAmount,
    )

    fun updateVirtualAppKey(value: String) {
        prefs.virtualAppKey = value
        _state.value = _state.value.copy(virtualAppKey = value)
    }

    fun updateVirtualAppSecret(value: String) {
        prefs.virtualAppSecret = value
        _state.value = _state.value.copy(virtualAppSecret = value)
    }

    fun updateVirtualAccountNo(value: String) {
        prefs.virtualAccountNo = value
        _state.value = _state.value.copy(virtualAccountNo = value)
    }

    fun updateProdAppKey(value: String) {
        prefs.prodAppKey = value
        _state.value = _state.value.copy(prodAppKey = value)
    }

    fun updateProdAppSecret(value: String) {
        prefs.prodAppSecret = value
        _state.value = _state.value.copy(prodAppSecret = value)
    }

    fun updateProdAccountNo(value: String) {
        prefs.prodAccountNo = value
        _state.value = _state.value.copy(prodAccountNo = value)
    }

    fun updateKisEnv(value: String) {
        if (prefs.kisEnv == value) return
        // 환경 전환 시 엔진 정지 (IDLE이 아니면 정지)
        if (engine.state.value.sessionState != SessionState.IDLE) {
            val intent = Intent(context, TradingService::class.java).apply {
                action = TradingService.ACTION_STOP
            }
            context.startService(intent)
        }
        prefs.kisEnv = value
        _state.value = _state.value.copy(kisEnv = value)
    }

    fun updateAutoStart(value: Boolean) {
        prefs.autoStartEnabled = value
        _state.value = _state.value.copy(autoStart = value)
    }

    fun updatePollingInterval(value: Int) {
        prefs.pollingIntervalMs = value * 1000L
        _state.value = _state.value.copy(pollingIntervalSec = value)
    }

    fun updateMaxPositions(value: Int) {
        prefs.maxPositions = value
        _state.value = _state.value.copy(maxPositions = value)
    }

    fun updateMaxPositionWeightPct(value: Int) {
        prefs.maxPositionWeightPct = value
        _state.value = _state.value.copy(maxPositionWeightPct = value)
    }

    fun updateMaxPositionAmount(value: Long) {
        prefs.maxPositionAmount = value
        _state.value = _state.value.copy(maxPositionAmount = value)
    }

    fun importCandleDb(uri: Uri) {
        viewModelScope.launch {
            _state.value = _state.value.copy(importStatus = "불러오는 중...")
            val result = seedImporter.importFromUri(uri)
            if (result.count > 0) {
                _state.value = _state.value.copy(importStatus = "${result.count}건 로드 완료")
            } else {
                _state.value = _state.value.copy(importStatus = result.error ?: "알 수 없는 오류")
            }
            loadCandleInfo()
        }
    }

    fun startGapFill() {
        if (_state.value.gapFillRunning) return
        gapFillJob = viewModelScope.launch {
            _state.value = _state.value.copy(
                gapFillRunning = true,
                gapFillLogs = emptyList(),
                gapFillSummary = null,
                gapFillCurrentDate = null,
                gapFillProgress = null,
            )

            // 엔진 실행 중이면 자동 정지
            if (engine.state.value.sessionState != SessionState.IDLE) {
                context.startService(Intent(context, TradingService::class.java).apply {
                    action = TradingService.ACTION_STOP
                })
                delay(500)
            }

            // 장중 미완성 일봉 방지: endDate는 직전 거래일(어제)까지만
            val yesterday = LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
            val minDate = LocalDate.now().minusYears(1).format(DateTimeFormatter.ISO_LOCAL_DATE)

            try {
                val gaps = candleDao.getStocksNeedingUpdate(yesterday, minDate)
                if (gaps.isEmpty()) {
                    _state.value = _state.value.copy(
                        gapFillRunning = false,
                        gapFillSummary = "모든 종목이 최신 상태입니다",
                    )
                    return@launch
                }

                // 종목명 일괄 조회
                val stockNames = stockDao.getByStockCodes(gaps.map { it.stockCode })
                    .associate { it.stockCode to it.stockName }

                var fetched = 0
                var errorCount = 0
                val logs = mutableListOf<String>()

                for ((i, gap) in gaps.withIndex()) {
                    ensureActive()

                    val nextDate = LocalDate.parse(gap.latestDate)
                        .plusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE)
                    _state.value = _state.value.copy(
                        gapFillCurrentDate = gap.latestDate,
                        gapFillProgress = "${i + 1} / ${gaps.size}",
                    )

                    try {
                        val candles = marketDataRepo.fetchAndSaveDailyCandles(
                            gap.stockCode, nextDate, yesterday,
                        )
                        if (candles.isNotEmpty()) {
                            val name = stockNames[gap.stockCode] ?: gap.stockCode
                            logs.add("$name: +${candles.size}건 ($nextDate~$yesterday)")
                            fetched += candles.size
                            _state.value = _state.value.copy(gapFillLogs = logs.toList())
                        }
                    } catch (_: Exception) {
                        errorCount++
                    }

                    delay(100) // KIS rate limit
                }

                _state.value = _state.value.copy(
                    gapFillRunning = false,
                    gapFillSummary = "완료: ${fetched}건 수집 (${gaps.size}종목, 실패 ${errorCount}건). 엔진 정지 상태.",
                )
            } catch (_: Exception) {
                _state.value = _state.value.copy(
                    gapFillRunning = false,
                    gapFillSummary = "중단됨",
                )
            }
            loadCandleInfo()
        }
    }

    fun stopGapFill() {
        gapFillJob?.cancel()
        gapFillJob = null
        _state.value = _state.value.copy(
            gapFillRunning = false,
            gapFillSummary = "중단됨",
        )
        loadCandleInfo()
    }

    fun deleteTodayCandles() {
        viewModelScope.launch {
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val deleted = candleDao.deleteFromDate(today)
            _state.value = _state.value.copy(
                importStatus = if (deleted > 0) "오늘 일봉 ${deleted}건 삭제 완료" else "오늘 일봉 없음",
            )
            loadCandleInfo()
        }
    }

    private fun loadCandleInfo() {
        viewModelScope.launch {
            val stocks = candleDao.getAllStockCodes().size
            val maxDate = candleDao.getMaxDate()
            val info = if (stocks > 0 && maxDate != null) {
                "${stocks}종목 (최신: $maxDate)"
            } else {
                "데이터 없음"
            }
            _state.value = _state.value.copy(candleDataInfo = info)
        }
    }

    init {
        loadCandleInfo()
    }
}
