package com.trading.app.data.remote.mapper

import com.trading.app.data.local.db.entity.DailyCandleEntity
import com.trading.app.data.local.db.entity.PositionEntity
import com.trading.app.data.remote.kis.dto.*
import com.trading.app.domain.model.Candle
import com.trading.app.domain.model.Position
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

object KisMapper {

    private val dateFormatter = DateTimeFormatter.ofPattern("yyyyMMdd")

    fun toCandle(item: KisDailyCandleItem, stockCode: String): Candle {
        val date = LocalDate.parse(item.stckBsopDate, dateFormatter)
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
        return Candle(
            stockCode = stockCode,
            date = date,
            open = item.stckOprc.toDoubleOrNull() ?: 0.0,
            high = item.stckHgpr.toDoubleOrNull() ?: 0.0,
            low = item.stckLwpr.toDoubleOrNull() ?: 0.0,
            close = item.stckClpr.toDoubleOrNull() ?: 0.0,
            volume = item.acmlVol.toLongOrNull() ?: 0L,
            amount = item.acmlTrPbmn?.toLongOrNull(),
        )
    }

    fun toDailyCandleEntity(item: KisDailyCandleItem, stockCode: String): DailyCandleEntity {
        val date = LocalDate.parse(item.stckBsopDate, dateFormatter)
            .format(DateTimeFormatter.ISO_LOCAL_DATE)
        return DailyCandleEntity(
            stockCode = stockCode,
            date = date,
            open = item.stckOprc.toDoubleOrNull() ?: 0.0,
            high = item.stckHgpr.toDoubleOrNull() ?: 0.0,
            low = item.stckLwpr.toDoubleOrNull() ?: 0.0,
            close = item.stckClpr.toDoubleOrNull() ?: 0.0,
            volume = item.acmlVol.toLongOrNull() ?: 0L,
            amount = item.acmlTrPbmn?.toDoubleOrNull() ?: 0.0,
        )
    }

    fun toPosition(item: KisBalanceItem): PositionEntity {
        val now = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
        val avgPrice = item.pchsAvgPric.toDoubleOrNull() ?: 0.0
        val currentPrice = item.prpr.toDoubleOrNull() ?: 0.0
        val quantity = item.hldgQty.toIntOrNull() ?: 0
        val pnl = item.evluPflsAmt.toDoubleOrNull() ?: 0.0
        val pnlRate = if (avgPrice > 0 && quantity > 0) {
            (currentPrice - avgPrice) / avgPrice
        } else 0.0

        return PositionEntity(
            stockCode = item.pdno,
            stockName = item.prdtName,
            quantity = quantity,
            avgPrice = avgPrice,
            currentPrice = currentPrice,
            pnl = pnl,
            pnlRate = pnlRate,
            boughtAt = now, // KIS doesn't provide exact buy date in balance
            updatedAt = now,
        )
    }

    data class CurrentPrice(
        val price: Double,
        val open: Double,
        val high: Double,
        val low: Double,
        val volume: Long,
        val amount: Long,
        val marketCap: Long,
        val stockName: String? = null,
    )

    fun toCurrentPrice(output: KisCurrentPriceOutput): CurrentPrice {
        return CurrentPrice(
            price = output.stckPrpr.toDoubleOrNull() ?: 0.0,
            open = output.stckOprc.toDoubleOrNull() ?: 0.0,
            high = output.stckHgpr.toDoubleOrNull() ?: 0.0,
            low = output.stckLwpr.toDoubleOrNull() ?: 0.0,
            volume = output.acmlVol.toLongOrNull() ?: 0L,
            amount = output.acmlTrPbmn.toLongOrNull() ?: 0L,
            marketCap = output.htsAvls?.toLongOrNull() ?: 0L,
            stockName = output.htsKorIsnm,
        )
    }
}
