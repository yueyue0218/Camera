package com.action.camera.order.statemachine;

import com.action.camera.order.enums.OrderStatus;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrderStatusMachineTest {

    @Test
    void shouldAllowLegalTransitions() {
        assertAllowed(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID_PENDING_SHOOT);
        assertAllowed(OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED);
        assertAllowed(OrderStatus.PAID_PENDING_SHOOT, OrderStatus.SHOOTING);
        assertAllowed(OrderStatus.SHOOTING, OrderStatus.PENDING_DELIVERY);
        assertAllowed(OrderStatus.PENDING_DELIVERY, OrderStatus.DELIVERED_PENDING_CONFIRM);
        assertAllowed(OrderStatus.DELIVERED_PENDING_CONFIRM, OrderStatus.COMPLETED);
        assertAllowed(OrderStatus.DELIVERED_PENDING_CONFIRM, OrderStatus.REWORK_REQUIRED);
        assertAllowed(OrderStatus.REWORK_REQUIRED, OrderStatus.PENDING_DELIVERY);
        assertAllowed(OrderStatus.APPEALING, OrderStatus.REFUNDED);
    }

    @Test
    void shouldRejectIllegalTransitions() {
        assertRejected(OrderStatus.PENDING_PAYMENT, OrderStatus.COMPLETED);
        assertRejected(OrderStatus.COMPLETED, OrderStatus.SHOOTING);
        assertRejected(OrderStatus.CANCELLED, OrderStatus.PAID_PENDING_SHOOT);
        assertRejected(OrderStatus.REFUNDED, OrderStatus.COMPLETED);
        assertRejected(OrderStatus.SHOOTING, OrderStatus.COMPLETED);
    }

    @Test
    void shouldRejectNullStatusTransitions() {
        assertRejected(null, OrderStatus.PAID_PENDING_SHOOT);
        assertRejected(OrderStatus.PENDING_PAYMENT, null);
        assertRejected(null, null);
    }

    private static void assertAllowed(OrderStatus from, OrderStatus to) {
        assertTrue(OrderStatusMachine.canTransit(from, to));
        assertDoesNotThrow(() -> OrderStatusMachine.assertCanTransit(from, to));
    }

    private static void assertRejected(OrderStatus from, OrderStatus to) {
        assertFalse(OrderStatusMachine.canTransit(from, to));
        IllegalArgumentException exception = assertThrows(
                IllegalArgumentException.class,
                () -> OrderStatusMachine.assertCanTransit(from, to)
        );
        assertTrue(exception.getMessage().contains(String.valueOf(from)));
        assertTrue(exception.getMessage().contains(String.valueOf(to)));
    }
}
