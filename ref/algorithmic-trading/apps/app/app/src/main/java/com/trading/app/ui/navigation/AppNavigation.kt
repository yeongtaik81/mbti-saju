package com.trading.app.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.ShowChart
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.trading.app.ui.screen.dashboard.DashboardScreen
import com.trading.app.ui.screen.logs.LogsScreen
import com.trading.app.ui.screen.positions.PositionsScreen
import com.trading.app.ui.screen.positiondetail.PositionDetailScreen
import com.trading.app.ui.screen.screening.ScreeningScreen
import com.trading.app.ui.screen.settings.SettingsScreen
import com.trading.app.ui.screen.strategyinfo.StrategyInfoScreen
import com.trading.app.ui.screen.trades.TradesScreen
import com.trading.app.ui.screen.tradedetail.TradeDetailScreen

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Dashboard : Screen("dashboard", "대시보드", Icons.Default.Dashboard)
    data object Positions : Screen("positions", "포지션", Icons.Default.ShowChart)
    data object Trades : Screen("trades", "매매내역", Icons.Default.History)
    data object Settings : Screen("settings", "설정", Icons.Default.Settings)
    data object Logs : Screen("logs", "로그", Icons.Default.List)
}

private val bottomNavItems = listOf(
    Screen.Dashboard,
    Screen.Positions,
    Screen.Trades,
    Screen.Logs,
    Screen.Settings,
)

private val topLevelRoutes = bottomNavItems.map { it.route }.toSet()

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val showBottomBar = currentDestination?.route in topLevelRoutes

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { screen ->
                        NavigationBarItem(
                            icon = { Icon(screen.icon, contentDescription = screen.label) },
                            label = { Text(screen.label) },
                            selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                            onClick = {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Dashboard.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Screen.Dashboard.route) {
                DashboardScreen(
                    onNavigateToScreening = { navController.navigate("screening") },
                )
            }
            composable(Screen.Positions.route) {
                PositionsScreen(
                    onPositionClick = { stockCode ->
                        navController.navigate("positions/$stockCode")
                    },
                )
            }
            composable(Screen.Trades.route) {
                TradesScreen(
                    onTradeClick = { tradeId ->
                        navController.navigate("trades/$tradeId")
                    },
                )
            }
            composable(Screen.Settings.route) {
                SettingsScreen(
                    onNavigateToStrategyInfo = { navController.navigate("strategy-info") },
                )
            }
            composable(Screen.Logs.route) { LogsScreen() }

            // Detail screens
            composable(
                route = "trades/{tradeId}",
                arguments = listOf(navArgument("tradeId") { type = NavType.LongType }),
            ) {
                TradeDetailScreen(onBack = { navController.popBackStack() })
            }
            composable(
                route = "positions/{stockCode}",
                arguments = listOf(navArgument("stockCode") { type = NavType.StringType }),
            ) {
                PositionDetailScreen(onBack = { navController.popBackStack() })
            }

            // Strategy info
            composable("strategy-info") {
                StrategyInfoScreen(onBack = { navController.popBackStack() })
            }

            // Screening
            composable("screening") {
                ScreeningScreen(onBack = { navController.popBackStack() })
            }
        }
    }
}
