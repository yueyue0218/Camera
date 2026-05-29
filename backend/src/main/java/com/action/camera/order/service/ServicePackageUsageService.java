package com.action.camera.order.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ServicePackageUsageService {

    public static final String SOURCE_TYPE_SERVICE_PACKAGE = "SERVICE_PACKAGE";

    private static final Set<QuoteStatus> ACTIVE_QUOTE_STATUSES = EnumSet.of(
            QuoteStatus.PENDING_CONFIRM
    );

    private static final Set<OrderStatus> ACTIVE_ORDER_STATUSES = EnumSet.of(
            OrderStatus.PENDING_PAYMENT,
            OrderStatus.PAID_PENDING_SHOOT,
            OrderStatus.SHOOTING,
            OrderStatus.PENDING_DELIVERY,
            OrderStatus.DELIVERED_PENDING_CONFIRM,
            OrderStatus.APPEALING,
            OrderStatus.REWORK_REQUIRED
    );

    private final QuoteRepository quoteRepository;
    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public boolean hasAnyQuoteOrOrderForServicePackage(Long servicePackageId) {
        validateServicePackageId(servicePackageId);
        return quoteRepository.existsBySourceTypeAndSourceId(SOURCE_TYPE_SERVICE_PACKAGE, servicePackageId)
                || orderRepository.existsByServicePackageId(servicePackageId);
    }

    @Transactional(readOnly = true)
    public boolean hasActiveQuoteOrOrderForServicePackage(Long servicePackageId) {
        validateServicePackageId(servicePackageId);
        return quoteRepository.existsBySourceTypeAndSourceIdAndStatusIn(
                SOURCE_TYPE_SERVICE_PACKAGE,
                servicePackageId,
                ACTIVE_QUOTE_STATUSES
        ) || orderRepository.existsByServicePackageIdAndStatusIn(servicePackageId, ACTIVE_ORDER_STATUSES);
    }

    private void validateServicePackageId(Long servicePackageId) {
        if (servicePackageId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "servicePackageId must not be null");
        }
    }
}
