package com.trading.app.di

import com.trading.app.domain.risk.RiskManager
import com.trading.app.domain.strategy.SignalGenerator
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideSignalGenerator(): SignalGenerator = SignalGenerator()

    @Provides
    @Singleton
    fun provideRiskManager(): RiskManager = RiskManager()
}
