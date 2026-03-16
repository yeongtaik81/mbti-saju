package com.trading.app.ui.component

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trading.app.domain.model.Position

@Composable
fun PositionCard(
    position: Position,
    holdingDays: Int = 0,
    maxHoldDays: Int = 10,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    onSell: (() -> Unit)? = null,
    sellEnabled: Boolean = true,
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text(position.stockName, fontWeight = FontWeight.Bold)
                    Text(position.stockCode, style = MaterialTheme.typography.bodySmall)
                }
                Column(horizontalAlignment = Alignment.End) {
                    PnlText(value = position.pnl, fontWeight = FontWeight.Bold)
                    PnlText(value = position.pnlRate, isRate = true)
                }
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("보유수량", style = MaterialTheme.typography.bodySmall)
                    Text("${position.quantity}주")
                }
                Column {
                    Text("평균매입가", style = MaterialTheme.typography.bodySmall)
                    Text(String.format("%,.0f", position.avgPrice))
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("현재가", style = MaterialTheme.typography.bodySmall)
                    Text(String.format("%,.0f", position.currentPrice))
                }
            }
            // 보유일 / 출처 표시
            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                val isExternal = position.source == "balance_sync"
                if (isExternal) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        AssistChip(
                            onClick = {},
                            label = {
                                Text("외부매수", style = MaterialTheme.typography.labelSmall)
                            },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = Color(0xFFFFF3E0),
                                labelColor = Color(0xFFE65100),
                            ),
                            modifier = Modifier.height(24.dp),
                        )
                        Text(
                            "보유일 미확인",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    val remaining = maxHoldDays - holdingDays
                    Text(
                        "보유 ${holdingDays}/${maxHoldDays}일",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (remaining > 0) {
                        Text(
                            "D-$remaining",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            color = if (remaining <= 2) MaterialTheme.colorScheme.error
                                    else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Text(
                            "매도 예정",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
            if (onSell != null) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = onSell,
                    enabled = sellEnabled,
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("시장가 매도")
                }
            }
        }
    }
}
