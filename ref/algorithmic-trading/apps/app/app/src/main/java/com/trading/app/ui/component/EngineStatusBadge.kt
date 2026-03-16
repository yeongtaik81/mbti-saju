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
import com.trading.app.domain.model.SessionState

@Composable
fun EngineStatusBadge(state: SessionState, modifier: Modifier = Modifier) {
    val (bgColor, textColor) = when (state) {
        SessionState.IDLE -> Color(0xFFE0E0E0) to Color(0xFF616161)
        SessionState.PREPARING -> Color(0xFFFFF3E0) to Color(0xFFE65100)
        SessionState.TRADING -> Color(0xFFE8F5E9) to Color(0xFF2E7D32)
        SessionState.PAUSED -> Color(0xFFFCE4EC) to Color(0xFFC62828)
        SessionState.WAITING -> Color(0xFFEDE7F6) to Color(0xFF4527A0)
    }

    Text(
        text = state.label,
        color = textColor,
        fontSize = 12.sp,
        fontWeight = FontWeight.Bold,
        modifier = modifier
            .background(bgColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}
