package com.trading.app.engine

import android.util.Log
import com.trading.app.data.local.SeedDataImporter
import com.trading.app.data.local.db.dao.*
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.repository.*
import com.trading.app.data.remote.kis.KisConfig
import com.trading.app.data.remote.kis.KisEnv
import com.trading.app.domain.market.MarketHours
import com.trading.app.domain.model.*
import com.trading.app.domain.risk.RiskManager
import com.trading.app.domain.strategy.*
import com.google.gson.Gson
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TradingEngine @Inject constructor(
    private val authRepo: AuthRepository,
    private val marketDataRepo: MarketDataRepository,
    private val orderRepo: OrderRepository,
    private val positionRepo: PositionRepository,
    private val signalGenerator: SignalGenerator,
    private val breadthCalc: BreadthCalculator,
    private val riskManager: RiskManager,
    private val strategyConfigDao: StrategyConfigDao,
    private val eventLogDao: EventLogDao,
    private val candleDao: DailyCandleDao,
    private val positionDao: PositionDao,
    private val stockDao: StockDao,
    private val seedImporter: SeedDataImporter,
    private val prefs: AppPreferences,
) {
    private val _state = MutableStateFlow(EngineState())
    val state: StateFlow<EngineState> = _state.asStateFlow()

    private val gson = Gson()

    private val stateMutex = Mutex()
    private var riskParams = RiskParams()
    private var indicatorCache = mutableMapOf<String, StockIndicators>()
    private var holdingDaysCache = mutableMapOf<String, Int>()
    private var candidateStockCodes = listOf<String>()
    private var screeningCandidatesCache = mutableListOf<ScreeningCandidate>()
    private var remainingCash = 0.0

    companion object {
        private const val TAG = "TradingEngine"
        private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm")
        private val TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss")
        private val MARKET_CLOSE_TIME: LocalTime = LocalTime.parse(MarketHours.NEW_ORDER_CUTOFF, TIME_FORMATTER)
        private val TRADING_START_TIME: LocalTime = LocalTime.parse(MarketHours.TRADING_START, TIME_FORMATTER)
        private val CANDLE_READY_TIME: LocalTime = LocalTime.of(15, 30) // 장 마감 후 일봉 확정 시점
    }

    // === PREPARE: 데이터 확인 → 보충 → 스크리닝 ===

    suspend fun prepare(scope: CoroutineScope) {
        val envLabel = if (prefs.isProduction) "실전투자(PRODUCTION)" else "모의투자(VIRTUAL)"
        updateState(sessionState = SessionState.PREPARING, message = "준비 중... [$envLabel]")
        logEvent("ENGINE", "START", "환경: $envLabel, 계좌: ${prefs.accountNo.take(4)}****")
        try {
            // 1. 설정 로드
            loadConfig()

            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val isTradingDay = !isWeekend()

            // 2. 토큰 발급 (거래일에만 — KIS API 비거래일 403)
            if (isTradingDay) {
                authRepo.issueToken()
                authRepo.startAutoRefresh(scope)
                logEvent("ENGINE", "TOKEN_ISSUED", "Token issued ($envLabel)")
            } else {
                logEvent("ENGINE", "NON_TRADING_DAY", "비거래일 — API 호출 생략, DB 스크리닝만 실행")
                updateState(message = "비거래일 — DB 스크리닝만 실행")
            }

            // 3. 시드 import
            val seedCount = seedImporter.importIfExists()
            if (seedCount > 0) {
                logEvent("ENGINE", "SEED_IMPORT", "Imported $seedCount candle rows from seed file")
                updateState(message = "시드 데이터 ${seedCount}건 로드 완료")
            }

            // 4. 시간 기반 데이터 신선도 확인 → 보충
            ensureCandlesFresh(isTradingDay)

            // 5. 보유종목 최신 일봉 보충 (거래일만)
            if (isTradingDay) fetchPositionCandles(today)

            // 6. 스크리닝 (DB only) — Donchian 근접도 프리필터
            var positions = positionRepo.getOpenPositions()
            val positionCodes = positions.map { it.stockCode }.toSet()
            val screeningResult = screenCandidates(today).toMutableList()

            // 종목명 조회 (stocks 테이블, API 불필요)
            if (screeningResult.isNotEmpty()) {
                val codes = screeningResult.map { it.stockCode }
                val stockMap = stockDao.getByStockCodes(codes).associate { it.stockCode to it.stockName }
                for (i in screeningResult.indices) {
                    val name = stockMap[screeningResult[i].stockCode]
                    if (name != null) {
                        screeningResult[i] = screeningResult[i].copy(stockName = name)
                    }
                }
            }

            // 후보 = 보유종목 + 스크리닝 종목
            val newCodes = screeningResult.map { it.stockCode }.filter { it !in positionCodes }
            val allCandidateCodes = (positionCodes + newCodes).toList()
            stateMutex.withLock {
                candidateStockCodes = allCandidateCodes
                screeningCandidatesCache = screeningResult
            }

            // 7. 지표 사전 계산 + breadth
            precomputeIndicators()
            computeBreadth(today)

            // 8. 잔고 조회 + 포지션 동기화 (거래일만)
            if (isTradingDay) {
                val balance = marketDataRepo.getBalance()
                stateMutex.withLock { remainingCash = balance.cash }
                updateState(cash = balance.cash, totalEquity = balance.totalValue)
                logEvent("ENGINE", "BALANCE_CHECK", "Cash=${balance.cash}, Total=${balance.totalValue}")

                // KIS 잔고 기반 포지션 동기화 (체결 감지 실패 보완)
                syncPositionsFromBalance(balance)
            }

            // 9. 보유일 캐시 (동기화 후 재조회)
            positions = positionRepo.getOpenPositions()
            stateMutex.withLock {
                for (pos in positions) {
                    val key = "${pos.stockCode}:${pos.strategyId}"
                    holdingDaysCache[key] = positionRepo.getHoldingDays(pos.stockCode, today)
                }
            }

            updateState(
                positionCount = positions.size,
                message = if (screeningResult.isEmpty()) {
                    "준비 완료 — 후보 없음 (DC 근접 종목 없음)"
                } else {
                    "준비 완료 (후보 ${screeningResult.size}종목)"
                },
                screeningCandidates = screeningResult,
                screeningMeta = ScreeningMeta(
                    screenedAt = LocalTime.now().format(TIME_FORMATTER),
                    dataBaseDate = today,
                    totalStocksScanned = candleDao.getAllStockCodes().size,
                    candidates = screeningResult.size,
                ),
            )
            logEvent("ENGINE", "PREPARE_DONE",
                "candidates=${allCandidateCodes.size}, positions=${positions.size}, screening=${screeningResult.size}")
        } catch (e: Exception) {
            Log.e(TAG, "Prepare failed: ${e.message}", e)
            logEvent("ENGINE", "PREPARE_ERROR", "Error: ${e.message}")
            cleanup()
            authRepo.destroy()
            updateState(sessionState = SessionState.IDLE, message = "준비 실패: ${e.message}")
            throw e
        }
    }

    // === OPERATE: 매매 또는 대기 ===

    suspend fun operate(scope: CoroutineScope) {
        val isTradingDay = !isWeekend()

        if (LocalTime.now() < MARKET_CLOSE_TIME) {
            // === 장중 ===
            if (candidateStockCodes.isNotEmpty()) {
                updateState(sessionState = SessionState.TRADING, message = "매매 시작")
                logEvent("ENGINE", "TRADING_START", "Polling interval: ${prefs.pollingIntervalMs}ms")
                tradingLoop(scope)
            } else {
                waitUntilMarketClose(scope)
            }

            // 매매 후 스냅샷
            if (isTradingDay) saveSnapshot()
            deleteOldCandles()

            // 인증 유지한 채 리턴 → 다음 prepare()에서 오늘 일봉 수집
            logEvent("ENGINE", "TRADING_DONE", "장중 완료 — 다음 prepare()에서 일봉 수집")
            return
        }

        // === 장후 ===
        if (isTradingDay) saveSnapshot()
        deleteOldCandles()

        // 인증 해제
        cleanup()
        if (isTradingDay) authRepo.destroy()

        // 다음 08:00까지 대기
        waitUntilNextCycle(scope)
    }

    // === TRADING LOOP ===

    private suspend fun tradingLoop(scope: CoroutineScope) {
        val scheduler = PollingScheduler(scope)
        scheduler.start(prefs.pollingIntervalMs) {
            val now = LocalTime.now()
            if (now >= MARKET_CLOSE_TIME) {
                scheduler.stop()
                return@start
            }
            if (now < TRADING_START_TIME) return@start

            try {
                pollAndEvaluate()
            } catch (e: Exception) {
                Log.e(TAG, "Poll error: ${e.message}")
                logEvent("ENGINE", "POLL_ERROR", e.message ?: "Unknown")
            }
        }

        scheduler.awaitCompletion()
    }

    private suspend fun pollAndEvaluate() {
        val now = LocalTime.now()
        val time = now.format(TIMESTAMP_FORMATTER)
        val timestamp = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) + "T" + time

        if (_state.value.sessionState == SessionState.PAUSED) return

        // 1. 보유 종목 + 후보 종목 현재가 조회
        val positions = positionRepo.getOpenPositions()
        val codes = stateMutex.withLock { candidateStockCodes.toList() }
        val priceCache = mutableMapOf<String, com.trading.app.data.remote.mapper.KisMapper.CurrentPrice>()

        // Fetch prices for all relevant codes (positions + candidates)
        val allCodes = (positions.map { it.stockCode } + codes).toSet()
        val namesToSave = mutableListOf<com.trading.app.data.local.db.entity.StockEntity>()
        for (code in allCodes) {
            try {
                val priceData = marketDataRepo.getCurrentPrice(code)
                priceCache[code] = priceData
                // Update position prices in DB
                if (positions.any { it.stockCode == code }) {
                    positionRepo.updatePrice(code, priceData.price)
                }
                // stocks 테이블 자동 보충 (종목명이 있으면)
                if (!priceData.stockName.isNullOrBlank()) {
                    namesToSave.add(com.trading.app.data.local.db.entity.StockEntity(
                        stockCode = code, stockName = priceData.stockName, market = "",
                    ))
                }
            } catch (e: Exception) {
                Log.w(TAG, "Price fetch failed for $code: ${e.message}")
            }
            delay(KisConfig.getApiDelayMs(KisEnv.fromString(prefs.kisEnv)))
        }
        // stocks 테이블 일괄 저장 + 스크리닝 종목명 갱신
        if (namesToSave.isNotEmpty()) {
            stockDao.upsertAll(namesToSave)
            val nameMap = namesToSave.associate { it.stockCode to it.stockName }
            stateMutex.withLock {
                for (i in screeningCandidatesCache.indices) {
                    val c = screeningCandidatesCache[i]
                    val name = nameMap[c.stockCode]
                    if (name != null && c.stockName == c.stockCode) {
                        screeningCandidatesCache[i] = c.copy(stockName = name)
                    }
                }
            }
        }

        // 2. 매도 평가: Donchian 하한 이탈 또는 최대 보유일
        val spec = StrategySpec.active()
        for (pos in positions) {
            val indicators = stateMutex.withLock { indicatorCache[pos.stockCode] } ?: continue
            val holdKey = "${pos.stockCode}:${pos.strategyId}"
            val holdDays = stateMutex.withLock { holdingDaysCache[holdKey] } ?: 0
            val currentPrice = priceCache[pos.stockCode]?.price ?: pos.currentPrice

            // Update indicators with real-time data
            val priceData = priceCache[pos.stockCode]
            val updatedIndicators = if (priceData != null) {
                indicators.copy(
                    todayHigh = maxOf(indicators.todayHigh, priceData.high),
                    todayLow = if (indicators.todayLow <= 0) priceData.low else minOf(indicators.todayLow, priceData.low),
                )
            } else indicators

            val sellSignal = signalGenerator.evaluateSell(
                spec = spec,
                stockCode = pos.stockCode,
                stockName = pos.stockName,
                currentPrice = currentPrice,
                quantity = pos.quantity,
                holdingDays = holdDays,
                indicators = updatedIndicators,
                timestamp = timestamp,
            )

            if (sellSignal != null) {
                // 이미 활성 매도 주문이 있으면 스킵
                if (orderRepo.hasActiveSellOrder(pos.stockCode)) {
                    Log.d(TAG, "Skip sell ${pos.stockCode}: active sell order exists")
                    continue
                }

                try {
                    delay(KisConfig.getOrderDelayMs(KisEnv.fromString(prefs.kisEnv)))
                    orderRepo.placeOrder(sellSignal)
                    val pnl = (currentPrice - pos.avgPrice) * pos.quantity
                    val pnlRate = (currentPrice - pos.avgPrice) / pos.avgPrice * 100
                    logEvent("SIGNAL", "SELL",
                        "${sellSignal.reason}: ${pos.stockName}(${pos.stockCode}) " +
                        "${pos.quantity}주 매입${String.format("%,.0f", pos.avgPrice)} → 현재${String.format("%,.0f", currentPrice)} " +
                        "수익 ${String.format("%+,.0f", pnl)}원 (${String.format("%+.1f", pnlRate)}%)")
                } catch (e: Exception) {
                    Log.e(TAG, "Sell order failed for ${pos.stockName}: ${e.message}")
                    logEvent("ORDER", "SELL_FAIL", "${pos.stockName}(${pos.stockCode}): ${e.message}")
                }
            }
        }

        // 3. 매수 평가: Donchian 돌파
        delay(KisConfig.getApiDelayMs(KisEnv.fromString(prefs.kisEnv)))
        val portfolio = try { marketDataRepo.getPortfolioContext() } catch (_: Exception) { null }
        if (portfolio != null) {
            val orderableCash = try {
                marketDataRepo.getOrderableCash()
            } catch (e: Exception) {
                Log.w(TAG, "getOrderableCash failed, falling back to balance.cash: ${e.message}")
                portfolio.cash
            }

            val totalEquity = portfolio.totalEquity
            val maxPositions = riskParams.maxPositions
            val existingCount = positionDao.countByStrategy(spec.id, prefs.environment)

            val budget = BudgetState(
                remainingCash = orderableCash,
                remainingSlots = maxPositions - existingCount,
                reservedStockCodes = positions.map { it.stockCode }.toMutableSet(),
            )

            var cashSpent = 0.0

            val candidates = stateMutex.withLock {
                screeningCandidatesCache.map { it.stockCode }
            }
            for (code in candidates) {
                if (positions.any { it.stockCode == code }) continue
                val indicators = stateMutex.withLock { indicatorCache[code] } ?: continue
                val priceData = priceCache[code] ?: continue

                val updatedIndicators = indicators.copy(
                    todayHigh = priceData.high,
                    todayLow = priceData.low,
                    todayVolume = priceData.volume.toDouble(),
                )
                budget.remainingCash = orderableCash - cashSpent
                if (budget.remainingCash <= 0) break

                val buySignal = signalGenerator.evaluateBuy(
                    spec = spec,
                    stockCode = code,
                    stockName = code,
                    currentPrice = priceData.price,
                    indicators = updatedIndicators,
                    budget = budget,
                    riskParams = riskParams,
                    totalEquity = totalEquity,
                    timestamp = timestamp,
                )

                if (buySignal != null) {
                    val riskCheck = riskManager.checkBuyOrder(buySignal, riskParams, portfolio)
                    if (riskCheck.action == RiskAction.PAUSE_ENGINE) {
                        updateState(sessionState = SessionState.PAUSED, message = riskCheck.reason)
                        logEvent("RISK", "PAUSE_ENGINE", riskCheck.reason)
                        return
                    }
                    if (riskCheck.approved) {
                        try {
                            delay(KisConfig.getOrderDelayMs(KisEnv.fromString(prefs.kisEnv)))
                            orderRepo.placeOrder(buySignal)
                            val orderAmount = priceData.price * buySignal.quantity
                            cashSpent += orderAmount
                            budget.remainingCash -= orderAmount
                            budget.remainingSlots--
                            budget.reservedStockCodes.add(code)
                            val stockName = namesToSave.find { it.stockCode == code }?.stockName ?: code
                            logEvent("SIGNAL", "BUY",
                                "donchian_breakout: ${stockName}($code) ${buySignal.quantity}주 @ ${String.format("%,.0f", priceData.price)}")
                            updateScreeningStatus(code, "돌파 매수")
                        } catch (e: Exception) {
                            Log.e(TAG, "Buy order failed: ${e.message}")
                            val msg = e.message ?: ""
                            if (msg.contains("금액") || msg.contains("부족") || msg.contains("거래건수")) {
                                logEvent("ENGINE", "BUY_ABORT", "매수 중단: $msg")
                                break
                            }
                        }
                    }
                }
            }
        }

        // 4. 체결 확인
        try {
            orderRepo.pollExecutions()
        } catch (e: Exception) {
            Log.w(TAG, "Execution poll failed: ${e.message}")
        }

        // 5. 스크리닝 후보 현재가/등락률 업데이트
        stateMutex.withLock {
            for (i in screeningCandidatesCache.indices) {
                val c = screeningCandidatesCache[i]
                val price = priceCache[c.stockCode] ?: continue
                val rate = if (c.prevClose > 0 && price.price > 0) {
                    (price.price - c.prevClose) / c.prevClose
                } else null
                screeningCandidatesCache[i] = c.copy(
                    currentPrice = price.price,
                    openPrice = if (price.open > 0) price.open else c.openPrice,
                    changeRate = rate,
                )
            }
        }

        // 6. 상태 업데이트
        val portfolioCtx = try { marketDataRepo.getPortfolioContext() } catch (_: Exception) { null }
        updateState(
            lastPollTime = time,
            totalEquity = portfolioCtx?.totalEquity,
            cash = portfolioCtx?.cash,
            positionCount = portfolioCtx?.currentPositionCount,
            screeningCandidates = stateMutex.withLock { screeningCandidatesCache.toList() },
        )
    }

    // === DATA HELPERS ===

    /**
     * KIS 잔고 기반 포지션 동기화
     * 체결 감지(pollExecutions) 실패 시 보완: KIS 잔고에 있지만 DB에 없는 보유종목을 포지션으로 생성
     */
    private suspend fun syncPositionsFromBalance(balance: MarketDataRepository.BalanceResult) {
        try {
            val holdings = balance.items.filter { (it.hldgQty.toIntOrNull() ?: 0) > 0 }
            if (holdings.isEmpty()) return

            val existingPositions = positionRepo.getOpenPositions()
            val existingCodes = existingPositions.map { it.stockCode }.toSet()
            val now = java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))

            var synced = 0
            for (item in holdings) {
                val code = item.pdno
                if (code in existingCodes) continue

                val qty = item.hldgQty.toIntOrNull() ?: continue
                val avgPrice = item.pchsAvgPric.toDoubleOrNull() ?: continue
                val currentPrice = item.prpr.toDoubleOrNull() ?: avgPrice

                // 주문 이력에서 전략 ID 조회, 없으면 "A" 기본값
                val strategyId = orderRepo.getLatestBuyStrategy(code) ?: "A"

                positionDao.upsert(com.trading.app.data.local.db.entity.PositionEntity(
                    stockCode = code,
                    stockName = item.prdtName,
                    quantity = qty,
                    avgPrice = avgPrice,
                    currentPrice = currentPrice,
                    boughtAt = now,
                    updatedAt = now,
                    strategyId = strategyId,
                    environment = prefs.environment,
                    source = "balance_sync",
                ))
                synced++
                logEvent("ENGINE", "POSITION_SYNC",
                    "KIS 잔고 동기화: $code ${item.prdtName} qty=$qty avg=$avgPrice strategy=$strategyId")
            }

            if (synced > 0) {
                logEvent("ENGINE", "POSITION_SYNC_DONE", "KIS 잔고에서 ${synced}개 포지션 동기화 완료")
                // 후보 목록에 동기화된 포지션 추가
                val syncedCodes = holdings.map { it.pdno }.filter { it !in existingCodes }
                stateMutex.withLock {
                    candidateStockCodes = (candidateStockCodes + syncedCodes).distinct()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Position sync from balance failed: ${e.message}")
        }
    }

    /**
     * 시간 기반 데이터 신선도 확인 → 필요시 전종목 수집
     * - 장 마감 전 (< 15:30): target = 직전 거래일 (어제)
     * - 장 마감 후 (≥ 15:30): target = 오늘
     */
    private suspend fun ensureCandlesFresh(isTradingDay: Boolean) {
        val dbStockCount = candleDao.getAllStockCodes().size
        if (dbStockCount == 0) {
            updateState(message = "일봉 데이터 없음 — 시드 데이터를 먼저 import 하세요")
            logEvent("ENGINE", "NO_CANDLE_DATA", "DB empty — seed import needed")
            return
        }
        if (!isTradingDay) return // 비거래일에는 API 호출 불가

        val target = if (LocalTime.now() < CANDLE_READY_TIME) {
            getLastTradingDay(LocalDate.now().minusDays(1)) // 어제(직전 거래일)
        } else {
            getLastTradingDay(LocalDate.now()) // 오늘
        }

        val maxDate = candleDao.getMaxDate()
        val targetStr = target.format(DateTimeFormatter.ISO_LOCAL_DATE)
        if (maxDate == null || maxDate < targetStr) {
            updateState(message = "일봉 수집 중... (목표: $targetStr, 현재: ${maxDate ?: "없음"})")
            logEvent("ENGINE", "CANDLE_STALE",
                "maxDate=$maxDate < target=$targetStr — collecting all")
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            collectAllCandles(today)
            updateState(message = "일봉 수집 완료")
        }
    }

    private suspend fun fetchPositionCandles(today: String) {
        val positions = positionRepo.getOpenPositions()
        val startDate = LocalDate.now().minusDays(90).format(DateTimeFormatter.ISO_LOCAL_DATE)
        for (code in positions.map { it.stockCode }.toSet()) {
            try {
                marketDataRepo.fetchAndSaveDailyCandles(code, startDate, today)
                delay(KisConfig.getApiDelayMs(KisEnv.fromString(prefs.kisEnv)))
            } catch (e: Exception) {
                Log.w(TAG, "Failed to fetch candles for $code: ${e.message}")
            }
        }
    }

    private suspend fun saveSnapshot() {
        try {
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val portfolio = marketDataRepo.getPortfolioContext()
            positionRepo.saveSnapshot(
                date = today,
                totalValue = portfolio.totalEquity,
                cash = portfolio.cash,
                stockValue = portfolio.totalEquity - portfolio.cash,
            )
            logEvent("ENGINE", "SNAPSHOT_SAVED", "Snapshot saved")
        } catch (e: Exception) {
            Log.w(TAG, "Snapshot failed: ${e.message}")
        }
    }

    private suspend fun deleteOldCandles() {
        val cutoff = LocalDate.now().minusDays(120).format(DateTimeFormatter.ISO_LOCAL_DATE)
        candleDao.deleteOlderThan(cutoff)
    }

    private suspend fun waitUntilMarketClose(scope: CoroutineScope) {
        val closeTime = LocalDateTime.of(LocalDate.now(), MARKET_CLOSE_TIME)
        updateState(
            sessionState = SessionState.TRADING,
            message = "후보 없음 — 장 마감 대기 (${MARKET_CLOSE_TIME.format(TIME_FORMATTER)}까지)"
        )
        logEvent("ENGINE", "NO_CANDIDATES", "Waiting for market close at $MARKET_CLOSE_TIME")

        while (scope.isActive && LocalTime.now() < MARKET_CLOSE_TIME) {
            delay(60_000)
            val remaining = java.time.Duration.between(LocalDateTime.now(), closeTime).toMinutes()
            updateState(message = "후보 없음 — 장 마감 대기 (${remaining}분 후)")
        }
    }

    private suspend fun waitUntilNextCycle(scope: CoroutineScope) {
        val now = LocalDateTime.now()
        var nextPreMarket = LocalDateTime.of(now.toLocalDate().plusDays(1), LocalTime.of(8, 0))
        val todayPreMarket = LocalDateTime.of(now.toLocalDate(), LocalTime.of(8, 0))
        if (now < todayPreMarket) {
            nextPreMarket = todayPreMarket
        }

        val waitMinutes = java.time.Duration.between(now, nextPreMarket).toMinutes()
        updateState(
            sessionState = SessionState.WAITING,
            message = "다음 사이클 ${nextPreMarket.format(DateTimeFormatter.ofPattern("MM-dd HH:mm"))} (${waitMinutes}분 후)"
        )
        logEvent("ENGINE", "WAITING", "Next cycle at $nextPreMarket (${waitMinutes}min)")

        while (scope.isActive) {
            delay(60_000)
            val remaining = java.time.Duration.between(LocalDateTime.now(), nextPreMarket)
            if (remaining.isNegative || remaining.isZero) break
            updateState(
                message = "다음 사이클 ${nextPreMarket.format(DateTimeFormatter.ofPattern("MM-dd HH:mm"))} (${remaining.toMinutes()}분 후)"
            )
        }
    }

    /**
     * 전 종목 일봉 수집
     */
    private suspend fun collectAllCandles(today: String) {
        val allCodes = candleDao.getAllStockCodes()
        val startDate = LocalDate.now().minusDays(5).format(DateTimeFormatter.ISO_LOCAL_DATE)
        var updated = 0
        var failed = 0

        for ((i, code) in allCodes.withIndex()) {
            try {
                marketDataRepo.fetchAndSaveDailyCandles(code, startDate, today)
                updated++
                if (i % 100 == 0) {
                    updateState(message = "일봉 수집 중... ($i/${allCodes.size})")
                }
                delay(KisConfig.getApiDelayMs(KisEnv.fromString(prefs.kisEnv)))
            } catch (e: Exception) {
                failed++
                Log.w(TAG, "Candle fetch failed for $code: ${e.message}")
            }
        }
        logEvent("ENGINE", "CANDLE_COLLECT",
            "Updated=$updated, Failed=$failed, Total=${allCodes.size}")
    }

    // === Internal ===

    private fun isWeekend(): Boolean {
        val dow = LocalDate.now().dayOfWeek
        return dow == java.time.DayOfWeek.SATURDAY || dow == java.time.DayOfWeek.SUNDAY
    }

    private fun getLastTradingDay(date: LocalDate): LocalDate {
        var d = date
        while (d.dayOfWeek == java.time.DayOfWeek.SATURDAY || d.dayOfWeek == java.time.DayOfWeek.SUNDAY) {
            d = d.minusDays(1)
        }
        return d
    }

    private suspend fun loadConfig() {
        val config = strategyConfigDao.getLatestEnabled()
        if (config != null) {
            riskParams = gson.fromJson(config.riskParams, RiskParams::class.java)
        }
        riskParams = riskParams.copy(
            maxPositions = prefs.maxPositions,
            maxPositionWeight = prefs.maxPositionWeightPct / 100.0,
            maxPositionAmount = prefs.maxPositionAmount.toDouble(),
        )
    }

    /**
     * Donchian 근접도 프리필터 스크리닝 (일봉 DB 기반, API 호출 없음)
     * 전일종가 / DC상단 >= proximityThreshold (97%) 인 종목만 후보로 선별
     */
    private suspend fun screenCandidates(today: String): List<ScreeningCandidate> {
        val allStockCodes = candleDao.getAllStockCodes()
        val result = mutableListOf<ScreeningCandidate>()
        val spec = StrategySpec.active()

        for (code in allStockCodes) {
            val candles = marketDataRepo.getCandlesFromDb(code, 90)
            if (candles.size < spec.entryPeriod + 2) continue

            val last = candles.size - 1

            val entryUpperValues = Indicators.donchianUpper(candles, spec.entryPeriod)
            val dcUpper = entryUpperValues[last] ?: continue
            if (dcUpper <= 0) continue

            val prevClose = candles[last].close
            val proximity = prevClose / dcUpper

            // 프리필터: 전일종가가 DC 상단의 threshold 이상
            if (proximity >= spec.proximityThreshold) {
                result.add(ScreeningCandidate(
                    stockCode = code,
                    stockName = code,
                    screenDate = today,
                    breakoutPrice = dcUpper,
                    prevClose = prevClose,
                    proximity = proximity,
                ))
            }
        }

        // 근접도 높은 순 정렬 (돌파 가능성 높은 순)
        return result.sortedByDescending { it.proximity }
    }

    private suspend fun precomputeIndicators() {
        val codes = stateMutex.withLock { candidateStockCodes.toList() }
        val cache = mutableMapOf<String, StockIndicators>()
        val spec = StrategySpec.active()

        for (code in codes) {
            val candles = marketDataRepo.getCandlesFromDb(code, 90)
            if (candles.size < spec.entryPeriod + 2) continue

            val last = candles.size - 1
            val prev = if (last > 0) last - 1 else 0

            val entryUpperValues = Indicators.donchianUpper(candles, spec.entryPeriod)
            val exitLowerValues = Indicators.donchianLower(candles, spec.exitPeriod)

            val strategyMap = mapOf(
                spec.id to StrategyIndicatorSet(
                    donchianEntryUpper = entryUpperValues[last],
                    donchianExitLower = exitLowerValues[last],
                )
            )

            val avgVol = if (candles.size >= 20) {
                candles.takeLast(20).map { it.volume.toDouble() }.average()
            } else null

            cache[code] = StockIndicators(
                todayOpen = 0.0,
                todayHigh = 0.0,
                todayLow = 0.0,
                prevHigh = candles[prev].high,
                prevLow = candles[prev].low,
                prevClose = candles[prev].effectiveClose,
                avgVolume20 = avgVol,
                todayVolume = 0.0,
                strategyIndicators = strategyMap,
            )
        }

        stateMutex.withLock { indicatorCache = cache }
    }

    private suspend fun computeBreadth(today: String) {
        try {
            val breadth = breadthCalc.computeBreadth(today)
            val regime = breadthCalc.getRegime(breadth)
            _state.update { it.copy(breadth = breadth, regime = regime) }
        } catch (e: Exception) {
            Log.w(TAG, "Breadth computation failed: ${e.message}")
        }
    }

    private fun updateScreeningStatus(stockCode: String, status: String) {
        val idx = screeningCandidatesCache.indexOfFirst { it.stockCode == stockCode }
        if (idx >= 0) {
            screeningCandidatesCache[idx] = screeningCandidatesCache[idx].copy(status = status)
        }
    }

    /** 외부에서 호출 가능한 포지션 동기화 (포지션 탭 진입 시 등) */
    suspend fun syncPositions() {
        if (!prefs.hasApiKeys()) return
        try {
            val balance = marketDataRepo.getBalance()
            syncPositionsFromBalance(balance)
        } catch (e: Exception) {
            Log.w(TAG, "Manual position sync failed: ${e.message}")
        }
    }

    fun onManualStop() {
        cleanup()
        updateState(sessionState = SessionState.IDLE, message = "수동 정지")
    }

    private fun cleanup() {
        indicatorCache.clear()
        holdingDaysCache.clear()
        candidateStockCodes = emptyList()
        // screeningCandidatesCache 유지 — WAITING 중 대시보드 표시용
    }

    private fun updateState(
        sessionState: SessionState? = null,
        regime: MarketRegime? = null,
        breadth: Double? = null,
        todayPnl: Double? = null,
        totalEquity: Double? = null,
        cash: Double? = null,
        positionCount: Int? = null,
        lastPollTime: String? = null,
        message: String? = null,
        screeningCandidates: List<ScreeningCandidate>? = null,
        screeningMeta: ScreeningMeta? = null,
    ) {
        _state.update { current ->
            current.copy(
                sessionState = sessionState ?: current.sessionState,
                regime = regime ?: current.regime,
                breadth = breadth ?: current.breadth,
                todayPnl = todayPnl ?: current.todayPnl,
                totalEquity = totalEquity ?: current.totalEquity,
                cash = cash ?: current.cash,
                positionCount = positionCount ?: current.positionCount,
                lastPollTime = lastPollTime ?: current.lastPollTime,
                message = message ?: current.message,
                screeningCandidates = screeningCandidates ?: current.screeningCandidates,
                screeningMeta = screeningMeta ?: current.screeningMeta,
            )
        }
    }

    private suspend fun logEvent(type: String, action: String, detail: String) {
        val now = java.time.LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
        eventLogDao.insert(com.trading.app.data.local.db.entity.EventLogEntity(
            type = type, action = action, detail = detail, createdAt = now,
        ))
    }
}
