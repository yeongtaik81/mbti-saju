package com.trading.app.ui.screen.trades

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.trading.app.ui.component.TradeRow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TradesScreen(
    onTradeClick: (Long) -> Unit = {},
    viewModel: TradesViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text("매매 내역") }) }
    ) { padding ->
        if (state.trades.isEmpty() && !state.isLoading) {
            Box(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                Text("매매 내역이 없습니다")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
            ) {
                itemsIndexed(state.trades) { index, trade ->
                    if (index >= state.trades.size - 5) {
                        LaunchedEffect(state.trades.size) {
                            viewModel.loadMore()
                        }
                    }
                    TradeRow(
                        trade = trade,
                        onClick = { onTradeClick(trade.id) },
                    )
                    HorizontalDivider()
                }
                if (state.isLoading) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp))
                        }
                    }
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }
    }
}
