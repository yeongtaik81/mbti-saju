package com.trading.app.engine

import kotlinx.coroutines.*

class PollingScheduler(private val scope: CoroutineScope) {
    private var job: Job? = null

    fun start(intervalMs: Long, action: suspend () -> Unit) {
        stop()
        job = scope.launch {
            while (isActive) {
                try {
                    action()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    // Log but don't crash the loop
                    android.util.Log.e("PollingScheduler", "Poll error: ${e.message}")
                }
                delay(intervalMs)
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    suspend fun awaitCompletion() {
        job?.join()
    }

    val isRunning: Boolean get() = job?.isActive == true
}
