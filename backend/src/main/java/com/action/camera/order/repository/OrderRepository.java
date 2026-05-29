package com.action.camera.order.repository;

import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {

    Optional<Order> findByQuoteId(Long quoteId);

    List<Order> findByCustomerIdOrderByUpdatedAtDesc(Long customerId);

    List<Order> findByProviderUserIdOrderByUpdatedAtDesc(Long providerUserId);

    List<Order> findByCustomerIdAndStatusOrderByUpdatedAtDesc(Long customerId, OrderStatus status);

    List<Order> findByProviderUserIdAndStatusOrderByUpdatedAtDesc(Long providerUserId, OrderStatus status);

    List<Order> findByStatus(OrderStatus status);

    boolean existsByServicePackageId(Long servicePackageId);

    boolean existsByServicePackageIdAndStatusIn(Long servicePackageId, Collection<OrderStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Order o where o.id = :id")
    Optional<Order> findByIdForUpdate(@Param("id") Long id);
}
