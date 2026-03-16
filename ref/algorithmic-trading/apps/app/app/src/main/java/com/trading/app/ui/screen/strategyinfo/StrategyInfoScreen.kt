package com.trading.app.ui.screen.strategyinfo

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StrategyInfoScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("전략 설명") },
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
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // 전략 개요
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Donchian Channel 돌파 전략", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("추세 추종(Trend Following) 전략으로, 일정 기간의 최고가를 돌파하면 매수하고 최저가를 이탈하면 매도합니다.")
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("장전에 전 종목 대상으로 Donchian 상단 근접 종목을 선별하고, 장중 해당 종목만 실시간 모니터링하여 돌파 시 매수합니다.")
                    }
                }
            }

            // 스크리닝 (프리필터)
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("장전 스크리닝 (프리필터)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("전일 종가 / DC40 상단 >= 97% 인 종목만 후보로 선별")
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("DC40 상단에 가까운 종목은 당일 돌파 가능성이 높음", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("일평균 ~83종목 선별 (API 한도 내)", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            // 매수 조건
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                    ),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("매수 조건", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Donchian 40일 상단 돌파")
                        Text("금일 고가 > 전일까지 40일간 최고가", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.height(8.dp))
                        InfoRow("Donchian 진입", "40일 최고가 돌파")
                        InfoRow("주문 방식", "시장가 매수")
                        InfoRow("최대 보유 종목", "10종목")
                        InfoRow("종목당 비중", "총자본의 20%")
                    }
                }
            }

            // 매도 규칙
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f),
                    ),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("매도 규칙", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("아래 조건 중 하나라도 충족 시 시장가 매도:")
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("1. Donchian 하한 이탈: 현재가 < 20일간 최저가")
                        Text("2. 최대 보유일: 15 거래일 경과")
                    }
                }
            }

            // 백테스트 성과
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("백테스트 성과", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("2025.03 ~ 2026.03 / 고가 매수(worst-case) 기준", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(modifier = Modifier.height(8.dp))
                        InfoRow("누적 수익률", "290.7%")
                        InfoRow("승률", "41.3%")
                        InfoRow("Profit Factor", "3.76")
                        InfoRow("Sharpe Ratio", "3.04")
                        InfoRow("MDD", "-24.4%")
                        InfoRow("거래 횟수", "126회")
                        InfoRow("평균 보유일", "14.9일")
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        Text("고가 매수 = 매일 그날의 최고가에 매수했다고 가정한 보수적 시뮬레이션", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            item { Spacer(modifier = Modifier.height(32.dp)) }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}
