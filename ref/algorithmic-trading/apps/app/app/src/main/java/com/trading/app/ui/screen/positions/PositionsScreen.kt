package com.trading.app.ui.screen.positions

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.trading.app.domain.model.Position
import com.trading.app.ui.component.PnlText
import com.trading.app.ui.component.PositionCard
import kotlinx.coroutines.flow.collectLatest

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PositionsScreen(
    onPositionClick: (String) -> Unit = {},
    viewModel: PositionsViewModel = hiltViewModel(),
) {
    val positionsWithInfo by viewModel.positionsWithInfo.collectAsState(initial = emptyList())
    val isRefreshing by viewModel.isRefreshing.collectAsState()
    val isSelling by viewModel.isSelling.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // 매도 결과 snackbar
    LaunchedEffect(Unit) {
        viewModel.sellResult.collectLatest { result ->
            snackbarHostState.showSnackbar(result.message)
        }
    }

    // 탭 진입 시 KIS 잔고 동기화
    LaunchedEffect(Unit) {
        viewModel.refresh()
    }

    // 매도 확인 다이얼로그
    var sellTarget by remember { mutableStateOf<Position?>(null) }
    if (sellTarget != null) {
        val target = sellTarget!!
        AlertDialog(
            onDismissRequest = { sellTarget = null },
            title = { Text("시장가 매도") },
            text = {
                Text("${target.stockName} ${target.quantity}주를 시장가로 매도하시겠습니까?")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.sellPosition(target)
                        sellTarget = null
                    },
                ) {
                    Text("매도", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { sellTarget = null }) {
                    Text("취소")
                }
            },
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("포지션") },
                actions = {
                    IconButton(
                        onClick = { viewModel.refreshPrices() },
                        enabled = !isRefreshing,
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = "현재가 새로고침")
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (positionsWithInfo.isEmpty() && !isRefreshing) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("보유 종목이 없습니다")
                }
            } else {
                val positions = positionsWithInfo.map { it.position }
                val totalPnl = positions.sumOf { it.pnl }
                val totalCost = positions.sumOf { it.avgPrice * it.quantity }
                val totalPnlRate = if (totalCost > 0) totalPnl / totalCost else 0.0
                val totalValue = positions.sumOf { it.currentPrice * it.quantity.toDouble() }

                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    // 전체 수익 요약
                    item {
                        Card(
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                            ),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(
                                    "총 평가수익",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                                PnlText(
                                    value = totalPnl,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(top = 2.dp),
                                )
                                PnlText(
                                    value = totalPnlRate,
                                    isRate = true,
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    Column {
                                        Text("총 매입", style = MaterialTheme.typography.bodySmall)
                                        Text(String.format("%,.0f", totalCost))
                                    }
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("총 평가", style = MaterialTheme.typography.bodySmall)
                                        Text(String.format("%,.0f", totalValue))
                                    }
                                }
                            }
                        }
                    }
                    items(positionsWithInfo) { info ->
                        PositionCard(
                            position = info.position,
                            holdingDays = info.holdingDays,
                            maxHoldDays = info.maxHoldDays,
                            onClick = { onPositionClick(info.position.stockCode) },
                            onSell = { sellTarget = info.position },
                            sellEnabled = !isSelling,
                        )
                    }
                    item { Spacer(modifier = Modifier.height(80.dp)) }
                }
            }
        }
    }
}
