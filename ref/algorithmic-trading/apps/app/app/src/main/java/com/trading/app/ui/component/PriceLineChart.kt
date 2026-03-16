package com.trading.app.ui.component

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.trading.app.data.local.db.entity.DailyCandleEntity
import com.trading.app.ui.theme.Loss
import com.trading.app.ui.theme.Profit

@Composable
fun PriceLineChart(
    candles: List<DailyCandleEntity>,
    modifier: Modifier = Modifier,
) {
    if (candles.size < 2) return

    val prices = candles.map { it.close }
    val minPrice = prices.min()
    val maxPrice = prices.max()
    val priceRange = (maxPrice - minPrice).coerceAtLeast(1.0)
    val isProfit = prices.last() >= prices.first()
    val lineColor = if (isProfit) Profit else Loss

    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(String.format("%,.0f", maxPrice), style = MaterialTheme.typography.labelSmall)
            Text(String.format("%,.0f", minPrice), style = MaterialTheme.typography.labelSmall)
        }

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(160.dp)
                .padding(vertical = 4.dp)
        ) {
            val w = size.width
            val h = size.height
            val stepX = w / (prices.size - 1).toFloat()

            val path = Path().apply {
                prices.forEachIndexed { i, price ->
                    val x = i * stepX
                    val y = h - ((price - minPrice) / priceRange * h).toFloat()
                    if (i == 0) moveTo(x, y) else lineTo(x, y)
                }
            }

            // Gradient fill
            val fillPath = Path().apply {
                addPath(path)
                lineTo(w, h)
                lineTo(0f, h)
                close()
            }
            drawPath(
                fillPath,
                brush = Brush.verticalGradient(
                    colors = listOf(lineColor.copy(alpha = 0.3f), lineColor.copy(alpha = 0.0f)),
                ),
            )

            // Line
            drawPath(
                path,
                color = lineColor,
                style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round),
            )

            // Start/end dots
            val firstY = h - ((prices.first() - minPrice) / priceRange * h).toFloat()
            val lastY = h - ((prices.last() - minPrice) / priceRange * h).toFloat()
            drawCircle(lineColor, radius = 3.dp.toPx(), center = Offset(0f, firstY))
            drawCircle(lineColor, radius = 3.dp.toPx(), center = Offset(w, lastY))
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(candles.first().date.takeLast(5), style = MaterialTheme.typography.labelSmall)
            Text(candles.last().date.takeLast(5), style = MaterialTheme.typography.labelSmall)
        }
    }
}
