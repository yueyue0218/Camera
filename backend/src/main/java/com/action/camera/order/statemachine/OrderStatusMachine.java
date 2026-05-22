package com.action.camera.order.statemachine;

import com.action.camera.order.enums.OrderStatus;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Centralized legal transition rules for order status changes.
 *
 * <p>This class only validates lifecycle transitions. Payment, logging,
 * persistence and permission checks belong to the later OrderService layer.</p>
 */
public final class OrderStatusMachine {

    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS = buildAllowedTransitions();

    private OrderStatusMachine() {
    }

    public static boolean canTransit(OrderStatus from, OrderStatus to) {
        if (from == null || to == null) {
            return false;
        }
        return ALLOWED_TRANSITIONS.getOrDefault(from, Collections.emptySet()).contains(to);
    }

    public static void assertCanTransit(OrderStatus from, OrderStatus to) {
        if (!canTransit(from, to)) {
            throw new IllegalArgumentException("Illegal order status transition from " + from + " to " + to);
        }
    }

    private static Map<OrderStatus, Set<OrderStatus>> buildAllowedTransitions() {
        EnumMap<OrderStatus, Set<OrderStatus>> transitions = new EnumMap<>(OrderStatus.class);

        transitions.put(OrderStatus.PENDING_PAYMENT, immutableEnumSet(
                OrderStatus.PAID_PENDING_SHOOT,
                OrderStatus.CANCELLED
        ));
        transitions.put(OrderStatus.PAID_PENDING_SHOOT, immutableEnumSet(
                OrderStatus.SHOOTING,
                OrderStatus.CANCELLED,
                OrderStatus.APPEALING
        ));
        transitions.put(OrderStatus.SHOOTING, immutableEnumSet(
                OrderStatus.PENDING_DELIVERY,
                OrderStatus.APPEALING
        ));
        transitions.put(OrderStatus.PENDING_DELIVERY, immutableEnumSet(
                OrderStatus.DELIVERED_PENDING_CONFIRM,
                OrderStatus.APPEALING
        ));
        transitions.put(OrderStatus.DELIVERED_PENDING_CONFIRM, immutableEnumSet(
                OrderStatus.COMPLETED,
                OrderStatus.APPEALING,
                OrderStatus.REWORK_REQUIRED
        ));
        transitions.put(OrderStatus.REWORK_REQUIRED, immutableEnumSet(
                OrderStatus.PENDING_DELIVERY,
                OrderStatus.APPEALING
        ));
        transitions.put(OrderStatus.APPEALING, immutableEnumSet(
                OrderStatus.COMPLETED,
                OrderStatus.REFUNDED,
                OrderStatus.REWORK_REQUIRED
        ));

        transitions.put(OrderStatus.COMPLETED, Collections.emptySet());
        transitions.put(OrderStatus.CANCELLED, Collections.emptySet());
        transitions.put(OrderStatus.REFUNDED, Collections.emptySet());

        return Collections.unmodifiableMap(transitions);
    }

    private static Set<OrderStatus> immutableEnumSet(OrderStatus first, OrderStatus... rest) {
        return Collections.unmodifiableSet(EnumSet.of(first, rest));
    }
}
