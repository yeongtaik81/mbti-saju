package com.trading.app.data.local.prefs

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppPreferences @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "trading_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    // --- Virtual (모의투자) credentials ---
    var virtualAppKey: String
        get() = prefs.getString(KEY_VIRTUAL_APP_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_VIRTUAL_APP_KEY, value).apply()

    var virtualAppSecret: String
        get() = prefs.getString(KEY_VIRTUAL_APP_SECRET, "") ?: ""
        set(value) = prefs.edit().putString(KEY_VIRTUAL_APP_SECRET, value).apply()

    var virtualAccountNo: String
        get() = prefs.getString(KEY_VIRTUAL_ACCOUNT_NO, "") ?: ""
        set(value) = prefs.edit().putString(KEY_VIRTUAL_ACCOUNT_NO, value).apply()

    // --- Production (실전투자) credentials ---
    var prodAppKey: String
        get() = prefs.getString(KEY_PROD_APP_KEY, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PROD_APP_KEY, value).apply()

    var prodAppSecret: String
        get() = prefs.getString(KEY_PROD_APP_SECRET, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PROD_APP_SECRET, value).apply()

    var prodAccountNo: String
        get() = prefs.getString(KEY_PROD_ACCOUNT_NO, "") ?: ""
        set(value) = prefs.edit().putString(KEY_PROD_ACCOUNT_NO, value).apply()

    // --- Active credentials (based on current env) ---
    var kisEnv: String
        get() = prefs.getString(KEY_KIS_ENV, "virtual") ?: "virtual"
        set(value) = prefs.edit().putString(KEY_KIS_ENV, value).apply()

    val isProduction: Boolean get() = kisEnv == "production"
    /** DB 환경 태그: "virtual" or "production" */
    val environment: String get() = if (isProduction) "production" else "virtual"

    /** Returns the active app key for the current environment */
    val appKey: String get() = if (isProduction) prodAppKey else virtualAppKey

    /** Returns the active app secret for the current environment */
    val appSecret: String get() = if (isProduction) prodAppSecret else virtualAppSecret

    /** Returns the active account number for the current environment */
    val accountNo: String get() = if (isProduction) prodAccountNo else virtualAccountNo

    // Account product code (계좌상품코드, 보통 "01")
    var accountProductCode: String
        get() = prefs.getString(KEY_ACCOUNT_PRODUCT_CODE, "01") ?: "01"
        set(value) = prefs.edit().putString(KEY_ACCOUNT_PRODUCT_CODE, value).apply()

    // Engine auto-start
    var autoStartEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_START, true)
        set(value) = prefs.edit().putBoolean(KEY_AUTO_START, value).apply()

    // Polling interval (ms)
    var pollingIntervalMs: Long
        get() = prefs.getLong(KEY_POLLING_INTERVAL, 30_000L)
        set(value) = prefs.edit().putLong(KEY_POLLING_INTERVAL, value).apply()

    // Risk params
    var maxPositions: Int
        get() = prefs.getInt(KEY_MAX_POSITIONS, 10)
        set(value) = prefs.edit().putInt(KEY_MAX_POSITIONS, value).apply()

    var maxPositionWeightPct: Int
        get() = prefs.getInt(KEY_MAX_POSITION_WEIGHT_PCT, 10)
        set(value) = prefs.edit().putInt(KEY_MAX_POSITION_WEIGHT_PCT, value).apply()

    var maxPositionAmount: Long
        get() = prefs.getLong(KEY_MAX_POSITION_AMOUNT, 1_000_000L)
        set(value) = prefs.edit().putLong(KEY_MAX_POSITION_AMOUNT, value).apply()

    // Strategy toggles
    var strategyAEnabled: Boolean
        get() = prefs.getBoolean(KEY_STRATEGY_A_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_STRATEGY_A_ENABLED, value).apply()

    var strategyBEnabled: Boolean
        get() = prefs.getBoolean(KEY_STRATEGY_B_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_STRATEGY_B_ENABLED, value).apply()

    fun hasApiKeys(): Boolean =
        appKey.isNotBlank() && appSecret.isNotBlank() && accountNo.isNotBlank()

    companion object {
        private const val KEY_VIRTUAL_APP_KEY = "kis_virtual_app_key"
        private const val KEY_VIRTUAL_APP_SECRET = "kis_virtual_app_secret"
        private const val KEY_VIRTUAL_ACCOUNT_NO = "kis_virtual_account_no"
        private const val KEY_PROD_APP_KEY = "kis_prod_app_key"
        private const val KEY_PROD_APP_SECRET = "kis_prod_app_secret"
        private const val KEY_PROD_ACCOUNT_NO = "kis_prod_account_no"
        private const val KEY_KIS_ENV = "kis_env"
        private const val KEY_ACCOUNT_PRODUCT_CODE = "kis_acnt_prdt_cd"
        private const val KEY_AUTO_START = "auto_start"
        private const val KEY_POLLING_INTERVAL = "polling_interval_ms"
        private const val KEY_MAX_POSITIONS = "risk_max_positions"
        private const val KEY_MAX_POSITION_WEIGHT_PCT = "risk_max_position_weight_pct"
        private const val KEY_MAX_POSITION_AMOUNT = "risk_max_position_amount"
        private const val KEY_STRATEGY_A_ENABLED = "strategy_a_enabled"
        private const val KEY_STRATEGY_B_ENABLED = "strategy_b_enabled"
    }
}
