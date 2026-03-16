package com.trading.app.ui.component

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.trading.app.data.local.db.entity.TradeEntity

@Composable
fun TradeRow(
    trade: TradeEntity,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(trade.stockName, fontWeight = FontWeight.Medium)
                if (trade.strategy == "A" || trade.strategy == "B") {
                    val label = if (trade.strategy == "A") "A" else "B"
                    val chipColor = if (trade.strategy == "A")
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.tertiary
                    AssistChip(
                        onClick = {},
                        label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = chipColor.copy(alpha = 0.15f),
                            labelColor = chipColor,
                        ),
                        modifier = Modifier.height(22.dp),
                    )
                }
            }
            Text(
                "${trade.soldAt.take(10)} | ${trade.signal}",
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Column(horizontalAlignment = Alignment.End) {
            PnlText(value = trade.pnl, fontWeight = FontWeight.Bold)
            PnlText(value = trade.pnlRate, isRate = true)
        }
    }
}
