package com.trading.app.data.local

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import android.util.Log
import com.trading.app.data.local.db.dao.DailyCandleDao
import com.trading.app.data.local.db.dao.StockDao
import com.trading.app.data.local.db.entity.DailyCandleEntity
import com.trading.app.data.local.db.entity.StockEntity
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SeedDataImporter @Inject constructor(
    @ApplicationContext private val context: Context,
    private val candleDao: DailyCandleDao,
    private val stockDao: StockDao,
) {
    companion object {
        private const val TAG = "SeedDataImporter"
        private const val SEED_FILE_NAME = "seed_candles.db"
        private const val BATCH_SIZE = 1000
    }

    /**
     * seed_candles.db 파일이 외부 저장소에 있으면 import 후 삭제.
     * 경로: /sdcard/Android/data/com.trading.app/files/seed_candles.db
     * @return imported row count, or 0 if no seed file
     */
    suspend fun importIfExists(): Int {
        val seedFile = File(context.getExternalFilesDir(null), SEED_FILE_NAME)
        if (!seedFile.exists()) return 0
        Log.i(TAG, "Seed file found: ${seedFile.absolutePath} (${seedFile.length() / 1024}KB)")
        val count = importFromFile(seedFile.absolutePath)
        if (count > 0) {
            seedFile.delete()
            Log.i(TAG, "Seed file deleted")
        }
        return count
    }

    /**
     * SAF Uri에서 import — 설정 화면 파일 선택용.
     * content:// URI를 임시 파일로 복사 후 import, 완료 시 임시 파일 삭제.
     */
    data class ImportResult(val count: Int, val error: String? = null)

    suspend fun importFromUri(uri: Uri): ImportResult {
        val tempFile = File(context.cacheDir, "import_candles.db")
        try {
            context.contentResolver.openInputStream(uri)?.use { input ->
                tempFile.outputStream().use { output -> input.copyTo(output) }
            } ?: return ImportResult(0, "파일을 열 수 없습니다")
            Log.i(TAG, "Temp file created: ${tempFile.length() / 1024}KB")
            val count = importFromFile(tempFile.absolutePath)
            return if (count > 0) ImportResult(count) else ImportResult(0, "DB에서 데이터를 읽을 수 없습니다 (테이블명: daily_candles)")
        } catch (e: Exception) {
            Log.e(TAG, "Import URI failed: ${e.message}", e)
            return ImportResult(0, "오류: ${e.message}")
        } finally {
            tempFile.delete()
        }
    }

    private suspend fun importFromFile(path: String): Int {
        var imported = 0
        var db: SQLiteDatabase? = null
        try {
            db = SQLiteDatabase.openDatabase(path, null, SQLiteDatabase.OPEN_READONLY)

            // 1. stocks 테이블 import (있으면)
            try {
                val stockCursor = db.rawQuery(
                    "SELECT stock_code, stock_name, market FROM stocks", null,
                )
                val stockBatch = mutableListOf<StockEntity>()
                var stockCount = 0
                stockCursor.use { c ->
                    while (c.moveToNext()) {
                        stockBatch.add(
                            StockEntity(
                                stockCode = c.getString(0),
                                stockName = c.getString(1),
                                market = if (c.isNull(2)) "" else c.getString(2),
                            )
                        )
                        if (stockBatch.size >= BATCH_SIZE) {
                            stockDao.upsertAll(stockBatch.toList())
                            stockCount += stockBatch.size
                            stockBatch.clear()
                        }
                    }
                }
                if (stockBatch.isNotEmpty()) {
                    stockDao.upsertAll(stockBatch.toList())
                    stockCount += stockBatch.size
                }
                Log.i(TAG, "Stocks imported: $stockCount rows")
            } catch (e: Exception) {
                Log.w(TAG, "stocks 테이블 없음 (구버전 seed DB): ${e.message}")
            }

            // 2. daily_candles 테이블 import
            val cursor = db.rawQuery(
                "SELECT stock_code, date, open, high, low, close, adj_close, volume, amount FROM daily_candles",
                null,
            )

            val batch = mutableListOf<DailyCandleEntity>()
            cursor.use { c ->
                while (c.moveToNext()) {
                    batch.add(
                        DailyCandleEntity(
                            stockCode = c.getString(0),
                            date = c.getString(1),
                            open = c.getDouble(2),
                            high = c.getDouble(3),
                            low = c.getDouble(4),
                            close = c.getDouble(5),
                            adjClose = if (c.isNull(6)) null else c.getDouble(6),
                            volume = c.getLong(7),
                            amount = c.getDouble(8),
                        )
                    )
                    if (batch.size >= BATCH_SIZE) {
                        candleDao.upsertAll(batch.toList())
                        imported += batch.size
                        batch.clear()
                    }
                }
            }
            if (batch.isNotEmpty()) {
                candleDao.upsertAll(batch.toList())
                imported += batch.size
            }
            Log.i(TAG, "Import complete: $imported rows from $path")
        } catch (e: Exception) {
            Log.e(TAG, "Import failed: ${e.message}", e)
        } finally {
            db?.close()
        }
        return imported
    }
}
