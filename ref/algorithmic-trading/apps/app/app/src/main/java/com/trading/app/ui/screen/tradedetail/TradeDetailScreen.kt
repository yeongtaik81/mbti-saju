package com.trading.app.ui.screen.tradedetail

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.trading.app.data.local.db.entity.ExecutionEntity
import com.trading.app.ui.component.PnlText
import com.trading.app.ui.component.PriceLineChart

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TradeDetailScreen(
    onBack: () -> Unit,
    viewModel: TradeDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.trade?.stockName ?: "매매 상세") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                    }
                },
            )
        }
    ) { padding ->
        when {
            state.isLoading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            state.error != null -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text(state.error!!)
                }
            }
            state.trade != null -> {
                val trade = state.trade!!
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    // Summary card
                    item {
                        Spacer(modifier = Modifier.height(4.dp))
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                Text(
                                    trade.stockName,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    trade.stockCode,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                PnlText(
                                    value = trade.pnlRate,
                                    isRate = true,
                                    fontWeight = FontWeight.Bold,
                                )
                                PnlText(value = trade.pnl)
                            }
                        }
                    }

                    // Info card
                    item {
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                InfoRow("매수일", trade.boughtAt.take(10))
                                InfoRow("매도일", trade.soldAt.take(10))
                                InfoRow("보유일수", "${state.holdingDays}일")
                                HorizontalDivider()
                                InfoRow("매수가", String.format("%,.0f원", trade.buyPrice))
                                InfoRow("매도가", String.format("%,.0f원", trade.sellPrice))
                                InfoRow("수량", "${trade.quantity}주")
                                HorizontalDivider()
                                InfoRow("수수료", String.format("%,.0f원", trade.feeTotal))
                                InfoRow("전략", trade.strategy)
                                InfoRow("매매 신호", trade.signal)
                            }
                        }
                    }

                    // Price chart
                    if (state.dailyCandles.size >= 2) {
                        item {
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text(
                                        "종가 추이",
                                        style = MaterialTheme.typography.titleMedium,
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    PriceLineChart(candles = state.dailyCandles)
                                }
                            }
                        }
                    }

                    // Buy executions
                    if (state.buyExecutions.isNotEmpty()) {
                        item {
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("매수 체결", style = MaterialTheme.typography.titleMedium)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    state.buyExecutions.forEach { exec ->
                                        ExecutionRow(exec)
                                    }
                                }
                            }
                        }
                    }

                    // Sell executions
                    if (state.sellExecutions.isNotEmpty()) {
                        item {
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("매도 체결", style = MaterialTheme.typography.titleMedium)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    state.sellExecutions.forEach { exec ->
                                        ExecutionRow(exec)
                                    }
                                }
                            }
                        }
                    }

                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun ExecutionRow(exec: ExecutionEntity) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            exec.executedAt.takeLast(8),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("${exec.quantity}주", style = MaterialTheme.typography.bodySmall)
        Text(String.format("%,.0f원", exec.price), style = MaterialTheme.typography.bodySmall)
        Text(
            String.format("%,.0f원", exec.amount),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
        )
    }
}
