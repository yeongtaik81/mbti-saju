package com.trading.app.ui.screen.logs

import androidx.lifecycle.ViewModel
import com.trading.app.data.local.db.dao.EventLogDao
import com.trading.app.data.local.db.entity.EventLogEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import javax.inject.Inject

@HiltViewModel
class LogsViewModel @Inject constructor(
    private val eventLogDao: EventLogDao,
) : ViewModel() {

    val types: Flow<List<String>> = eventLogDao.observeTypes()

    private val _selectedType = MutableStateFlow<String?>(null)
    val selectedType = _selectedType.asStateFlow()

    @OptIn(ExperimentalCoroutinesApi::class)
    val logs: Flow<List<EventLogEntity>> = _selectedType.flatMapLatest { type ->
        if (type == null) {
            eventLogDao.observeRecent(200)
        } else {
            eventLogDao.observeByType(type, 200)
        }
    }

    fun setFilter(type: String?) {
        _selectedType.value = type
    }
}
