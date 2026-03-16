package com.trading.app.domain.order

import com.trading.app.domain.model.OrderStatus

typealias OnOrderTransition = (from: OrderStatus, to: OrderStatus) -> Unit

class OrderStateMachine(
    initialStatus: OrderStatus = OrderStatus.CREATED,
    private val onTransition: OnOrderTransition? = null,
) {
    private var _status: OrderStatus = initialStatus

    val status: OrderStatus get() = _status

    val isTerminal: Boolean
        get() = _status in TERMINAL_STATES

    fun canTransition(to: OrderStatus): Boolean {
        val allowed = TRANSITIONS[_status] ?: return false
        return to in allowed
    }

    fun transition(to: OrderStatus) {
        if (!canTransition(to)) {
            throw IllegalStateException("Invalid order state transition: ${_status} → $to")
        }
        val from = _status
        _status = to
        onTransition?.invoke(from, to)
    }

    fun allowedTransitions(): List<OrderStatus> =
        TRANSITIONS[_status] ?: emptyList()

    companion object {
        private val TRANSITIONS: Map<OrderStatus, List<OrderStatus>> = mapOf(
            OrderStatus.CREATED to listOf(OrderStatus.SUBMITTED, OrderStatus.REJECTED, OrderStatus.ERROR),
            OrderStatus.SUBMITTED to listOf(OrderStatus.PENDING, OrderStatus.REJECTED),
            OrderStatus.PENDING to listOf(
                OrderStatus.FILLED, OrderStatus.PARTIAL_FILLED,
                OrderStatus.REJECTED, OrderStatus.CANCEL_REQUESTED,
            ),
            OrderStatus.PARTIAL_FILLED to listOf(
                OrderStatus.FILLED, OrderStatus.CANCEL_REQUESTED,
            ),
            OrderStatus.FILLED to emptyList(),
            OrderStatus.REJECTED to emptyList(),
            OrderStatus.CANCEL_REQUESTED to listOf(OrderStatus.CANCELLED, OrderStatus.FILLED),
            OrderStatus.CANCELLED to emptyList(),
        )

        private val TERMINAL_STATES: Set<OrderStatus> = setOf(
            OrderStatus.FILLED, OrderStatus.REJECTED, OrderStatus.CANCELLED, OrderStatus.ERROR,
        )
    }
}
