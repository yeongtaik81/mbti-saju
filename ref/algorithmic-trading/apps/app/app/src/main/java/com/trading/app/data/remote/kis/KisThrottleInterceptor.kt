package com.trading.app.data.remote.kis

import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Token bucket rate limiter (20 req/sec).
 * OkHttp interceptor로 동기 실행.
 */
@Singleton
class KisThrottleInterceptor @Inject constructor() : Interceptor {

    private val capacity = 20
    private val refillRateMs = 1000L / capacity // 50ms per token
    private var tokens = capacity.toDouble()
    private var lastRefill = System.currentTimeMillis()
    private val lock = Any()

    override fun intercept(chain: Interceptor.Chain): Response {
        acquire()
        return chain.proceed(chain.request())
    }

    private fun acquire() {
        synchronized(lock) {
            refill()
            while (tokens < 1.0) {
                val waitMs = ((1.0 - tokens) * refillRateMs).toLong().coerceAtLeast(1)
                try { Thread.sleep(waitMs) } catch (_: InterruptedException) {}
                refill()
            }
            tokens -= 1.0
        }
    }

    private fun refill() {
        val now = System.currentTimeMillis()
        val elapsed = now - lastRefill
        tokens = (tokens + elapsed.toDouble() / refillRateMs).coerceAtMost(capacity.toDouble())
        lastRefill = now
    }
}
