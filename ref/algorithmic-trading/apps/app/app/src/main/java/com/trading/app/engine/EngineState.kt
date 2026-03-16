package com.trading.app.engine

import com.trading.app.domain.model.MarketRegime
import com.trading.app.domain.model.SessionState

data class ScreeningCandidate(
    val stockCode: String,
    val stockName: String,
    val screenDate: String,
    val breakoutPrice: Double,
    val currentPrice: Double? = null,
    val prevClose: Double = 0.0,
    val openPrice: Double? = null,
    val changeRate: Double? = null,
    /** 전일종가 / DC상단 근접도 (0.97~1.0+) */
    val proximity: Double = 0.0,
    val status: String = "대기중",
)

data class ScreeningMeta(
    val screenedAt: String,
    val dataBaseDate: String,
    val totalStocksScanned: Int,
    val candidates: Int,
)

data class EngineState(
    val sessionState: SessionState = SessionState.IDLE,
    val regime: MarketRegime = MarketRegime.NEUTRAL,
    val breadth: Double = -1.0,
    val todayPnl: Double = 0.0,
    val totalEquity: Double = 0.0,
    val cash: Double = 0.0,
    val positionCount: Int = 0,
    val lastPollTime: String = "",
    val message: String = "",
    val screeningCandidates: List<ScreeningCandidate> = emptyList(),
    val screeningMeta: ScreeningMeta? = null,
)
