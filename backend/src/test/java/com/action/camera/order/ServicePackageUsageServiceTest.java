package com.action.camera.order;

import com.action.camera.message.enums.QuoteStatus;
import com.action.camera.message.repository.QuoteRepository;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.order.service.ServicePackageUsageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServicePackageUsageServiceTest {

    private static final Long SERVICE_PACKAGE_ID = 9101L;

    @Mock
    private QuoteRepository quoteRepository;

    @Mock
    private OrderRepository orderRepository;

    private ServicePackageUsageService servicePackageUsageService;

    @BeforeEach
    void setUp() {
        servicePackageUsageService = new ServicePackageUsageService(quoteRepository, orderRepository);
    }

    @Test
    void conversationWithoutQuoteOrOrderDoesNotCountAsUsage() {
        when(quoteRepository.existsBySourceTypeAndSourceId("SERVICE_PACKAGE", SERVICE_PACKAGE_ID)).thenReturn(false);
        when(orderRepository.existsByServicePackageId(SERVICE_PACKAGE_ID)).thenReturn(false);

        boolean hasUsage = servicePackageUsageService.hasAnyQuoteOrOrderForServicePackage(SERVICE_PACKAGE_ID);

        assertFalse(hasUsage);
    }

    @Test
    void quoteCountsAsHistoricalUsage() {
        when(quoteRepository.existsBySourceTypeAndSourceId("SERVICE_PACKAGE", SERVICE_PACKAGE_ID)).thenReturn(true);

        boolean hasUsage = servicePackageUsageService.hasAnyQuoteOrOrderForServicePackage(SERVICE_PACKAGE_ID);

        assertTrue(hasUsage);
        verify(orderRepository, never()).existsByServicePackageId(SERVICE_PACKAGE_ID);
    }

    @Test
    void activeOrderCountsAsActiveUsage() {
        when(quoteRepository.existsBySourceTypeAndSourceIdAndStatusIn(
                eq("SERVICE_PACKAGE"),
                eq(SERVICE_PACKAGE_ID),
                anyCollection()
        )).thenReturn(false);
        when(orderRepository.existsByServicePackageIdAndStatusIn(
                eq(SERVICE_PACKAGE_ID),
                anyCollection()
        )).thenReturn(true);

        boolean hasActiveUsage = servicePackageUsageService.hasActiveQuoteOrOrderForServicePackage(SERVICE_PACKAGE_ID);

        assertTrue(hasActiveUsage);
    }

    @Test
    void completedOrderCountsAsHistoricalButNotActiveUsage() {
        when(quoteRepository.existsBySourceTypeAndSourceId("SERVICE_PACKAGE", SERVICE_PACKAGE_ID)).thenReturn(false);
        when(orderRepository.existsByServicePackageId(SERVICE_PACKAGE_ID)).thenReturn(true);
        when(quoteRepository.existsBySourceTypeAndSourceIdAndStatusIn(
                eq("SERVICE_PACKAGE"),
                eq(SERVICE_PACKAGE_ID),
                anyCollection()
        )).thenReturn(false);
        when(orderRepository.existsByServicePackageIdAndStatusIn(
                eq(SERVICE_PACKAGE_ID),
                anyCollection()
        )).thenReturn(false);

        boolean hasUsage = servicePackageUsageService.hasAnyQuoteOrOrderForServicePackage(SERVICE_PACKAGE_ID);
        boolean hasActiveUsage = servicePackageUsageService.hasActiveQuoteOrOrderForServicePackage(SERVICE_PACKAGE_ID);

        assertTrue(hasUsage);
        assertFalse(hasActiveUsage);
    }

    @Test
    void pendingQuoteCountsAsActiveUsage() {
        when(quoteRepository.existsBySourceTypeAndSourceIdAndStatusIn(
                eq("SERVICE_PACKAGE"),
                eq(SERVICE_PACKAGE_ID),
                argThat(statuses -> statuses.contains(QuoteStatus.PENDING_CONFIRM))
        )).thenReturn(true);

        boolean hasActiveUsage = servicePackageUsageService.hasActiveQuoteOrOrderForServicePackage(SERVICE_PACKAGE_ID);

        assertTrue(hasActiveUsage);
        verify(orderRepository, never()).existsByServicePackageIdAndStatusIn(
                eq(SERVICE_PACKAGE_ID),
                argThat(statuses -> statuses.contains(OrderStatus.PENDING_PAYMENT))
        );
    }
}
