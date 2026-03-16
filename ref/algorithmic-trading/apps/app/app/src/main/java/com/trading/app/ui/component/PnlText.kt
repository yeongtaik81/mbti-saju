package com.trading.app.ui.component

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import com.trading.app.ui.theme.Loss
import com.trading.app.ui.theme.Neutral
import com.trading.app.ui.theme.Profit

@Composable
fun PnlText(
    value: Double,
    isRate: Boolean = false,
    modifier: Modifier = Modifier,
    fontWeight: FontWeight = FontWeight.Normal,
) {
    val color = when {
        value > 0 -> Profit
        value < 0 -> Loss
        else -> Neutral
    }
    val text = if (isRate) {
        String.format("%+.2f%%", value * 100)
    } else {
        String.format("%+,.0f", value)
    }
    Text(text = text, color = color, fontWeight = fontWeight, modifier = modifier)
}
