package com.trading.app.ui.screen.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.trading.app.domain.model.SessionState
import com.trading.app.ui.component.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    onNavigateToScreening: () -> Unit = {},
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    val engineState by viewModel.engineState.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("대시보드") },
                actions = {
                    val envLabel = if (viewModel.isProduction) "실전" else "모의"
                    val envColor = if (viewModel.isProduction)
                        MaterialTheme.colorScheme.error
                    else
                        MaterialTheme.colorScheme.tertiary
                    AssistChip(
                        onClick = {},
                        label = { Text(envLabel, style = MaterialTheme.typography.labelSmall) },
                        colors = AssistChipDefaults.assistChipColors(
                            containerColor = envColor.copy(alpha = 0.15f),
                            labelColor = envColor,
                        ),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    EngineStatusBadge(engineState.sessionState)
                    Spacer(modifier = Modifier.width(4.dp))
                    MarketRegimeBadge(engineState.regime)
                    Spacer(modifier = Modifier.width(8.dp))
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Engine control
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("엔진 제어", style = MaterialTheme.typography.titleMedium)
                            if (engineState.sessionState == SessionState.IDLE) {
                                Button(onClick = { viewModel.startEngine() }) {
                                    Text("시작")
                                }
                            } else {
                                OutlinedButton(onClick = { viewModel.stopEngine() }) {
                                    Text("정지")
                                }
                            }
                        }
                        if (engineState.message.isNotBlank()) {
                            Text(
                                engineState.message,
                                style = MaterialTheme.typography.bodySmall,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                    }
                }
            }

            // Portfolio summary
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("포트폴리오", style = MaterialTheme.typography.titleMedium)
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column {
                                Text("총자산", style = MaterialTheme.typography.bodySmall)
                                Text(
                                    String.format("%,.0f원", engineState.totalEquity),
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("예수금", style = MaterialTheme.typography.bodySmall)
                                Text(String.format("%,.0f원", engineState.cash))
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Column {
                                Text("보유종목", style = MaterialTheme.typography.bodySmall)
                                Text("${engineState.positionCount}종목")
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text("마지막 폴링", style = MaterialTheme.typography.bodySmall)
                                Text(engineState.lastPollTime.ifBlank { "-" })
                            }
                        }
                    }
                }
            }

            // Screening candidates button
            item {
                if (engineState.screeningCandidates.isNotEmpty()) {
                    OutlinedButton(
                        onClick = onNavigateToScreening,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("오늘의 후보 ${engineState.screeningCandidates.size}종목")
                    }
                } else if (engineState.sessionState != SessionState.IDLE) {
                    OutlinedButton(
                        onClick = onNavigateToScreening,
                        modifier = Modifier.fillMaxWidth(),
                        enabled = false,
                    ) {
                        Text("오늘의 후보 없음")
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(80.dp)) }
        }
    }
}
