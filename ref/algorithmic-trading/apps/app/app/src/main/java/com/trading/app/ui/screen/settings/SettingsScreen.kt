package com.trading.app.ui.screen.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onNavigateToStrategyInfo: () -> Unit = {},
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    val dbFilePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument(),
    ) { uri ->
        uri?.let { viewModel.importCandleDb(it) }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("설정") }) }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // 전략 설정
            Text("전략 설정", style = MaterialTheme.typography.titleMedium)

            Text(
                "Donchian 40/20 돌파 전략",
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                "DC40 상단 돌파 매수 / DC20 하단 이탈 매도 / 최대 15일 보유",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedButton(
                onClick = onNavigateToStrategyInfo,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("알고리즘 상세보기")
            }

            HorizontalDivider()

            // 환경 선택
            Text("환경 선택", style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = state.kisEnv == "virtual",
                    onClick = { viewModel.updateKisEnv("virtual") },
                    label = { Text("모의투자") },
                )
                FilterChip(
                    selected = state.kisEnv == "production",
                    onClick = { viewModel.updateKisEnv("production") },
                    label = { Text("실전투자") },
                )
            }

            HorizontalDivider()

            // 모의투자 설정
            Text(
                "모의투자 API",
                style = MaterialTheme.typography.titleMedium,
                color = if (state.kisEnv == "virtual") MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (state.kisEnv == "virtual") {
                Text(
                    "현재 사용 중",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }

            OutlinedTextField(
                value = state.virtualAppKey,
                onValueChange = { viewModel.updateVirtualAppKey(it) },
                label = { Text("App Key (모의)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            OutlinedTextField(
                value = state.virtualAppSecret,
                onValueChange = { viewModel.updateVirtualAppSecret(it) },
                label = { Text("App Secret (모의)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
            )

            OutlinedTextField(
                value = state.virtualAccountNo,
                onValueChange = { viewModel.updateVirtualAccountNo(it) },
                label = { Text("계좌번호 (모의)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            HorizontalDivider()

            // 실전투자 설정
            Text(
                "실전투자 API",
                style = MaterialTheme.typography.titleMedium,
                color = if (state.kisEnv == "production") MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (state.kisEnv == "production") {
                Text(
                    "현재 사용 중",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }

            OutlinedTextField(
                value = state.prodAppKey,
                onValueChange = { viewModel.updateProdAppKey(it) },
                label = { Text("App Key (실전)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )

            OutlinedTextField(
                value = state.prodAppSecret,
                onValueChange = { viewModel.updateProdAppSecret(it) },
                label = { Text("App Secret (실전)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
            )

            OutlinedTextField(
                value = state.prodAccountNo,
                onValueChange = { viewModel.updateProdAccountNo(it) },
                label = { Text("계좌번호 (실전)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            HorizontalDivider()

            // 엔진 설정
            Text("엔진 설정", style = MaterialTheme.typography.titleMedium)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("앱 구동시 자동 시작")
                Switch(
                    checked = state.autoStart,
                    onCheckedChange = { viewModel.updateAutoStart(it) },
                )
            }

            OutlinedTextField(
                value = state.pollingIntervalSec.toString(),
                onValueChange = {
                    it.toIntOrNull()?.let { sec -> viewModel.updatePollingInterval(sec) }
                },
                label = { Text("폴링 간격 (초)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            HorizontalDivider()

            // 리스크 설정
            Text("리스크 설정", style = MaterialTheme.typography.titleMedium)

            OutlinedTextField(
                value = state.maxPositions.toString(),
                onValueChange = {
                    it.toIntOrNull()?.let { v -> viewModel.updateMaxPositions(v) }
                },
                label = { Text("최대 보유 종목 수") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            OutlinedTextField(
                value = state.maxPositionWeightPct.toString(),
                onValueChange = {
                    it.toIntOrNull()?.let { v -> viewModel.updateMaxPositionWeightPct(v) }
                },
                label = { Text("종목당 최대 비중 (%)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            OutlinedTextField(
                value = state.maxPositionAmount.toString(),
                onValueChange = {
                    it.toLongOrNull()?.let { v -> viewModel.updateMaxPositionAmount(v) }
                },
                label = { Text("종목당 최대 금액 (원)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )

            HorizontalDivider()

            // 데이터 관리
            Text("데이터 관리", style = MaterialTheme.typography.titleMedium)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("일봉 데이터")
                    Text(
                        state.candleDataInfo.ifEmpty { "확인 중..." },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedButton(
                        onClick = { dbFilePicker.launch(arrayOf("application/octet-stream", "*/*")) },
                    ) {
                        Text("DB 불러오기")
                    }
                    OutlinedButton(
                        onClick = { viewModel.deleteTodayCandles() },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Text("오늘 일봉 삭제")
                    }
                }
            }

            if (state.importStatus != null) {
                Text(
                    state.importStatus!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (state.importStatus!!.contains("완료"))
                        MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.error,
                )
            }

            HorizontalDivider()

            // 데이터 보충 (Gap Fill)
            Text("데이터 보충", style = MaterialTheme.typography.titleMedium)
            Text(
                "누락된 일봉을 KIS API로 보충합니다 (최대 1년)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            if (!state.gapFillRunning) {
                Button(
                    onClick = { viewModel.startGapFill() },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("보충 시작")
                }
            } else {
                OutlinedButton(
                    onClick = { viewModel.stopGapFill() },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.outlinedButtonColors(
                        contentColor = MaterialTheme.colorScheme.error,
                    ),
                ) {
                    Text("정지")
                }
            }

            if (state.gapFillRunning && state.gapFillProgress != null) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
                Text(
                    "확인중: ${state.gapFillCurrentDate ?: ""} (${state.gapFillProgress})",
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            if (state.gapFillSummary != null) {
                Text(
                    state.gapFillSummary!!,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (state.gapFillSummary!!.contains("완료"))
                        MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.error,
                )
            }

            if (state.gapFillLogs.isNotEmpty()) {
                Text("수집 로그", style = MaterialTheme.typography.labelMedium)
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    for (log in state.gapFillLogs.reversed()) {
                        Text(
                            log,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}
