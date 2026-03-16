package com.trading.app.domain.order

import com.trading.app.domain.model.OrderStatus
import org.junit.Assert.*
import org.junit.Test

class OrderStateMachineTest {

    @Test
    fun `initial status is CREATED`() {
        val sm = OrderStateMachine()
        assertEquals(OrderStatus.CREATED, sm.status)
        assertFalse(sm.isTerminal)
    }

    @Test
    fun `CREATED can transition to SUBMITTED`() {
        val sm = OrderStateMachine()
        assertTrue(sm.canTransition(OrderStatus.SUBMITTED))
        sm.transition(OrderStatus.SUBMITTED)
        assertEquals(OrderStatus.SUBMITTED, sm.status)
    }

    @Test
    fun `CREATED cannot transition to FILLED`() {
        val sm = OrderStateMachine()
        assertFalse(sm.canTransition(OrderStatus.FILLED))
    }

    @Test(expected = IllegalStateException::class)
    fun `invalid transition throws`() {
        val sm = OrderStateMachine()
        sm.transition(OrderStatus.FILLED)
    }

    @Test
    fun `full happy path - CREATED to FILLED`() {
        val sm = OrderStateMachine()
        sm.transition(OrderStatus.SUBMITTED)
        sm.transition(OrderStatus.PENDING)
        sm.transition(OrderStatus.FILLED)
        assertEquals(OrderStatus.FILLED, sm.status)
        assertTrue(sm.isTerminal)
    }

    @Test
    fun `cancellation path`() {
        val sm = OrderStateMachine()
        sm.transition(OrderStatus.SUBMITTED)
        sm.transition(OrderStatus.PENDING)
        sm.transition(OrderStatus.CANCEL_REQUESTED)
        sm.transition(OrderStatus.CANCELLED)
        assertEquals(OrderStatus.CANCELLED, sm.status)
        assertTrue(sm.isTerminal)
    }

    @Test
    fun `CANCEL_REQUESTED can transition to FILLED (race condition)`() {
        val sm = OrderStateMachine()
        sm.transition(OrderStatus.SUBMITTED)
        sm.transition(OrderStatus.PENDING)
        sm.transition(OrderStatus.CANCEL_REQUESTED)
        assertTrue(sm.canTransition(OrderStatus.FILLED))
    }

    @Test
    fun `partial fill path`() {
        val sm = OrderStateMachine()
        sm.transition(OrderStatus.SUBMITTED)
        sm.transition(OrderStatus.PENDING)
        sm.transition(OrderStatus.PARTIAL_FILLED)
        sm.transition(OrderStatus.FILLED)
        assertTrue(sm.isTerminal)
    }

    @Test
    fun `REJECTED is terminal`() {
        val sm = OrderStateMachine()
        sm.transition(OrderStatus.SUBMITTED)
        sm.transition(OrderStatus.REJECTED)
        assertTrue(sm.isTerminal)
        assertTrue(sm.allowedTransitions().isEmpty())
    }

    @Test
    fun `onTransition callback is called`() {
        val transitions = mutableListOf<Pair<OrderStatus, OrderStatus>>()
        val sm = OrderStateMachine(onTransition = { from, to -> transitions.add(from to to) })
        sm.transition(OrderStatus.SUBMITTED)
        sm.transition(OrderStatus.PENDING)

        assertEquals(2, transitions.size)
        assertEquals(OrderStatus.CREATED to OrderStatus.SUBMITTED, transitions[0])
        assertEquals(OrderStatus.SUBMITTED to OrderStatus.PENDING, transitions[1])
    }
}
