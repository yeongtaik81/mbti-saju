package com.trading.app.data.repository

import android.util.Log
import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.remote.kis.KisAuthApi
import com.trading.app.data.remote.kis.KisAuthInterceptor
import com.trading.app.data.remote.kis.dto.KisTokenRequest
import kotlinx.coroutines.*
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: KisAuthApi,
    private val prefs: AppPreferences,
    private val authInterceptor: KisAuthInterceptor,
) {
    private val mutex = Mutex()
    private var accessToken: String? = null
    private var expiresAt: Long = 0L
    private var lastIssuedAt: Long = 0L
    private var autoRefreshJob: Job? = null

    companion object {
        private const val TAG = "AuthRepository"
        private const val EXPIRY_BUFFER_MS = 5 * 60 * 1000L      // 5분
        private const val MIN_REISSUE_INTERVAL_MS = 60 * 1000L    // 60초
        private const val AUTO_REFRESH_BEFORE_MS = 60 * 60 * 1000L // 1시간 전
        private const val MAX_RETRIES = 3
    }

    fun isTokenValid(): Boolean {
        val token = accessToken ?: return false
        return token.isNotBlank() && System.currentTimeMillis() < expiresAt - EXPIRY_BUFFER_MS
    }

    suspend fun getToken(): String = mutex.withLock {
        if (isTokenValid()) return accessToken!!
        return issueTokenInternal()
    }

    suspend fun issueToken(): String = mutex.withLock {
        return issueTokenInternal()
    }

    private suspend fun issueTokenInternal(): String {
        val now = System.currentTimeMillis()
        if (now - lastIssuedAt < MIN_REISSUE_INTERVAL_MS && accessToken != null) {
            Log.w(TAG, "Token reissue throttled (< 60s interval)")
            return accessToken!!
        }

        var lastError: Exception? = null
        for (attempt in 1..MAX_RETRIES) {
            try {
                val response = authApi.issueToken(
                    KisTokenRequest(
                        appkey = prefs.appKey,
                        appsecret = prefs.appSecret,
                    )
                )
                accessToken = response.accessToken
                expiresAt = now + response.expiresIn * 1000
                lastIssuedAt = now
                authInterceptor.currentToken = response.accessToken

                Log.i(TAG, "Token issued, expires in ${response.expiresIn}s")
                return response.accessToken
            } catch (e: Exception) {
                lastError = e
                Log.w(TAG, "Token issue attempt $attempt failed: ${e.message}")
                if (attempt < MAX_RETRIES) {
                    delay(1000L * attempt) // exponential backoff
                }
            }
        }
        throw lastError ?: IllegalStateException("Token issue failed")
    }

    fun startAutoRefresh(scope: CoroutineScope) {
        autoRefreshJob?.cancel()
        autoRefreshJob = scope.launch {
            while (isActive) {
                val delayMs = if (expiresAt > 0) {
                    (expiresAt - AUTO_REFRESH_BEFORE_MS - System.currentTimeMillis())
                        .coerceAtLeast(60_000L)
                } else {
                    60_000L
                }
                delay(delayMs)
                try {
                    issueToken()
                } catch (e: Exception) {
                    Log.e(TAG, "Auto-refresh failed: ${e.message}")
                }
            }
        }
    }

    fun destroy() {
        autoRefreshJob?.cancel()
        accessToken = null
        expiresAt = 0L
    }
}
