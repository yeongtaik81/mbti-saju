package com.trading.app.ui.screen.screening

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.trading.app.ui.component.ScreeningCandidateCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreeningScreen(
    onBack: () -> Unit,
    viewModel: ScreeningViewModel = hiltViewModel(),
) {
    val engineState by viewModel.engineState.collectAsState()
    val candidates = engineState.screeningCandidates
    val meta = engineState.screeningMeta

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("오늘의 매수 후보") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "뒤로")
                    }
                },
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
            // Meta info card
            if (meta != null) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text("스크리닝 정보", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("스크리닝 시각: ${meta.screenedAt}")
                            Text("데이터 기준일: ${meta.dataBaseDate} 종가 기준")
                            Text("대상: 전체 ${meta.totalStocksScanned}종목 -> DC근접 ${meta.candidates}종목")
                        }
                    }
                }
            }

            if (candidates.isEmpty()) {
                item {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            "장전 처리 대기중...",
                            modifier = Modifier.padding(16.dp),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }

            if (candidates.isNotEmpty()) {
                item {
                    Text(
                        "Donchian 40일 돌파 후보 (근접도 97%+)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                items(candidates) { candidate ->
                    ScreeningCandidateCard(candidate = candidate)
                }
            }

            item { Spacer(modifier = Modifier.height(32.dp)) }
        }
    }
}
