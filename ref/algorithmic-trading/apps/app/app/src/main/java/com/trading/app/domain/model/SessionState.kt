package com.trading.app.domain.model

enum class SessionState(val label: String) {
    IDLE("대기"),
    PREPARING("준비중"),
    TRADING("매매중"),
    PAUSED("일시정지"),
    WAITING("다음 사이클 대기");
}
