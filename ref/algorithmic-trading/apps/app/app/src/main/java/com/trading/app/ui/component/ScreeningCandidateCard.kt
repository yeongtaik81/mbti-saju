package com.trading.app.ui.component

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trading.app.engine.ScreeningCandidate

private val UpColor = Color(0xFFD32F2F)   // 빨강 (상승)
private val DownColor = Color(0xFF1976D2) // 파랑 (하락)

@Composable
fun ScreeningCandidateCard(
    candidate: ScreeningCandidate,
    modifier: Modifier = Modifier,
) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header: stock name + change rate + status chip
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text(candidate.stockName, fontWeight = FontWeight.Bold)
                    Text(candidate.stockCode, style = MaterialTheme.typography.bodySmall)
                    // 등락률 표시
                    if (candidate.changeRate != null) {
                        val rate = candidate.changeRate * 100
                        val color = when {
                            rate > 0 -> UpColor
                            rate < 0 -> DownColor
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        val sign = if (rate > 0) "+" else ""
                        Text(
                            "${sign}${String.format("%.2f", rate)}%",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Bold,
                            color = color,
                        )
                    }
                }
                val (statusColor, statusContainerColor) = when (candidate.status) {
                    "돌파 매수" -> MaterialTheme.colorScheme.primary to MaterialTheme.colorScheme.primaryContainer
                    "미충족" -> MaterialTheme.colorScheme.error to MaterialTheme.colorScheme.errorContainer
                    else -> MaterialTheme.colorScheme.onSurfaceVariant to MaterialTheme.colorScheme.surfaceVariant
                }
                AssistChip(
                    onClick = {},
                    label = { Text(candidate.status, style = MaterialTheme.typography.labelSmall) },
                    colors = AssistChipDefaults.assistChipColors(
                        containerColor = statusContainerColor,
                        labelColor = statusColor,
                    ),
                    modifier = Modifier.height(24.dp),
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Breakout price + current price + prev close
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("돌파 기준가", style = MaterialTheme.typography.bodySmall)
                    Text(String.format("%,.0f", candidate.breakoutPrice), fontWeight = FontWeight.Medium)
                }
                if (candidate.currentPrice != null) {
                    val proximity = candidate.currentPrice / candidate.breakoutPrice * 100
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("현재가", style = MaterialTheme.typography.bodySmall)
                        val priceColor = if (candidate.changeRate != null) {
                            when {
                                candidate.changeRate > 0 -> UpColor
                                candidate.changeRate < 0 -> DownColor
                                else -> MaterialTheme.colorScheme.onSurface
                            }
                        } else MaterialTheme.colorScheme.onSurface
                        Text(
                            String.format("%,.0f", candidate.currentPrice),
                            fontWeight = FontWeight.Medium,
                            color = priceColor,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("근접도", style = MaterialTheme.typography.bodySmall)
                        Text(
                            "${String.format("%.1f", proximity)}%",
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // prev close + open price + MA values
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    "전일종가: ${String.format("%,.0f", candidate.prevClose)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (candidate.openPrice != null) {
                    val openRate = if (candidate.prevClose > 0) {
                        (candidate.openPrice - candidate.prevClose) / candidate.prevClose * 100
                    } else 0.0
                    val openColor = when {
                        openRate > 0 -> UpColor
                        openRate < 0 -> DownColor
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                    val openSign = if (openRate > 0) "+" else ""
                    Text(
                        "시가: ${String.format("%,.0f", candidate.openPrice)} (${openSign}${String.format("%.2f", openRate)}%)",
                        style = MaterialTheme.typography.bodySmall,
                        color = openColor,
                    )
                }
            }

            Text(
                "DC근접도: ${String.format("%.1f", candidate.proximity * 100)}%",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
