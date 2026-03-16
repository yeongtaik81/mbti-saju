package com.trading.app.ui.screen.positiondetail

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
import com.trading.app.data.local.db.entity.OrderEntity
import com.trading.app.ui.component.PnlText
import com.trading.app.ui.component.PriceLineChart

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PositionDetailScreen(
    onBack: () -> Unit,
    viewModel: PositionDetailViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.position?.stockName ?: "포지션 상세") },
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
            state.position != null -> {
                val pos = state.position!!
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
                                    pos.stockName,
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    pos.stockCode,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(modifier = Modifier.height(12.dp))
                                PnlText(
                                    value = pos.pnlRate,
                                    isRate = true,
                                    fontWeight = FontWeight.Bold,
                                )
                                PnlText(value = pos.pnl)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "보유 중",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.primary,
                                )
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
                                InfoRow("매수일", pos.boughtAt.take(10))
                                InfoRow("보유일수", "${state.holdingDays}일")
                                HorizontalDivider()
                                InfoRow("평균매수가", String.format("%,.0f원", pos.avgPrice))
                                InfoRow("현재가", String.format("%,.0f원", pos.currentPrice))
                                InfoRow("수량", "${pos.quantity}주")
                                HorizontalDivider()
                                InfoRow("평가금액", String.format("%,.0f원", pos.currentPrice * pos.quantity))
                                InfoRow("투자금액", String.format("%,.0f원", pos.avgPrice * pos.quantity))
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

                    // Buy orders
                    if (state.buyOrders.isNotEmpty()) {
                        item {
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Text("매수 주문 내역", style = MaterialTheme.typography.titleMedium)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    state.buyOrders.forEach { order ->
                                        OrderRow(order)
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
private fun OrderRow(order: OrderEntity) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            order.createdAt.take(10),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text("${order.filledQuantity}주", style = MaterialTheme.typography.bodySmall)
        Text(String.format("%,.0f원", order.filledPrice), style = MaterialTheme.typography.bodySmall)
        Text(
            order.status,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium,
        )
    }
}
