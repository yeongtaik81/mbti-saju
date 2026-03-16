package com.trading.app.data.remote.kis

import com.trading.app.data.local.prefs.AppPreferences
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor that injects KIS API common headers:
 * - authorization: Bearer {token}
 * - appkey, appsecret
 * - custtype: P
 * - Content-Type
 *
 * Token은 AuthRepository에서 관리하므로 token provider를 통해 주입.
 */
@Singleton
class KisAuthInterceptor @Inject constructor(
    private val prefs: AppPreferences,
) : Interceptor {

    @Volatile
    var currentToken: String? = null

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        // Token endpoint는 인증 헤더 불필요
        if (original.url.encodedPath.contains("/oauth2/")) {
            return chain.proceed(original)
        }

        val token = currentToken
        if (token == null) {
            // 토큰 없으면 네트워크 호출 없이 401 응답 반환 (OkHttp 스레드 크래시 방지)
            return Response.Builder()
                .request(original)
                .protocol(Protocol.HTTP_1_1)
                .code(401)
                .message("KIS token not available")
                .body("{\"rt_cd\":\"1\",\"msg1\":\"Token not available\"}".toResponseBody("application/json".toMediaType()))
                .build()
        }

        val request = original.newBuilder()
            .header("authorization", "Bearer $token")
            .header("appkey", prefs.appKey)
            .header("appsecret", prefs.appSecret)
            .header("custtype", KisConfig.CUST_TYPE)
            .header("Content-Type", KisConfig.CONTENT_TYPE)
            .build()

        return chain.proceed(request)
    }
}
