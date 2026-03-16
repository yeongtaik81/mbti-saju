package com.trading.app.di

import com.trading.app.data.local.prefs.AppPreferences
import com.trading.app.data.remote.kis.*
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    /**
     * Dynamic base URL interceptor: reads prefs.kisEnv on every request
     * so that switching virtual <-> production takes effect immediately.
     */
    @Provides
    @Singleton
    fun provideDynamicBaseUrlInterceptor(prefs: AppPreferences): Interceptor {
        return Interceptor { chain ->
            val env = KisEnv.fromString(prefs.kisEnv)
            val targetUrl = env.restBaseUrl.toHttpUrl()
            val originalRequest = chain.request()
            val newUrl = originalRequest.url.newBuilder()
                .scheme(targetUrl.scheme)
                .host(targetUrl.host)
                .port(targetUrl.port)
                .build()
            chain.proceed(originalRequest.newBuilder().url(newUrl).build())
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: KisAuthInterceptor,
        throttleInterceptor: KisThrottleInterceptor,
        dynamicBaseUrlInterceptor: Interceptor,
    ): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }
        return OkHttpClient.Builder()
            .addInterceptor(throttleInterceptor)
            .addInterceptor(dynamicBaseUrlInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit {
        // Placeholder baseUrl — overridden by dynamic interceptor per request
        return Retrofit.Builder()
            .baseUrl(KisEnv.VIRTUAL.restBaseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideKisApi(retrofit: Retrofit): KisApi =
        retrofit.create(KisApi::class.java)

    @Provides
    @Singleton
    fun provideKisAuthApi(prefs: AppPreferences): KisAuthApi {
        // Auth API uses its own OkHttpClient without auth interceptor
        val env = KisEnv.fromString(prefs.kisEnv)
        return Retrofit.Builder()
            .baseUrl(env.restBaseUrl)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(KisAuthApi::class.java)
    }
}
