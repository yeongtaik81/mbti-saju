package com.trading.app.ui.component

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.trading.app.domain.model.MarketRegime
import com.trading.app.ui.theme.Bear
import com.trading.app.ui.theme.Bull
import com.trading.app.ui.theme.Neutral

@Composable
fun MarketRegimeBadge(regime: MarketRegime, modifier: Modifier = Modifier) {
    val (label, bgColor) = when (regime) {
        MarketRegime.BULL -> "상승장" to Bull.copy(alpha = 0.15f)
        MarketRegime.BEAR -> "하락장" to Bear.copy(alpha = 0.15f)
        MarketRegime.NEUTRAL -> "보합장" to Neutral.copy(alpha = 0.15f)
    }
    val textColor = when (regime) {
        MarketRegime.BULL -> Bull
        MarketRegime.BEAR -> Bear
        MarketRegime.NEUTRAL -> Neutral
    }

    Text(
        text = label,
        color = textColor,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
            .background(bgColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}
