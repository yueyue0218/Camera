package com.action.camera.delivery.service;

import com.action.camera.application.FileService;
import com.action.camera.common.UserContext;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.dto.DeliveryUploadResponse;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.delivery.port.OrderStatusPort;
import com.action.camera.delivery.repository.DeliveryFileRepository;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.service.OrderService;
import com.action.camera.repository.FileRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeliveryServiceTest {

    private static final Long ORDER_ID = 8001L;
    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long FILE_ID = 5001L;

    @Mock
    private DeliveryRepository deliveryRepository;

    @Mock
    private DeliveryFileRepository deliveryFileRepository;

    @Mock
    private FileService fileService;

    @Mock
    private FileRepository fileRepository;

    @Mock
    private OrderQueryPort orderQueryPort;

    @Mock
    private OrderStatusPort orderStatusPort;

    @Mock
    private OrderService orderService;

    @Mock
    private TransactionTemplate txTemplate;

    private DeliveryService deliveryService;

    @BeforeEach
    void setUp() {
        when(txTemplate.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(null);
        });
        deliveryService = new DeliveryService(
                deliveryRepository,
                deliveryFileRepository,
                fileService,
                fileRepository,
                orderQueryPort,
                orderStatusPort,
                orderService,
                txTemplate
        );
        UserContext.setUserId(PROVIDER_ID);
        UserContext.setCurrentRole(UserRole.PROVIDER);
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void pendingDeliveryUploadStillMovesOrderToDeliveredPendingConfirm() {
        prepareUpload("PENDING_DELIVERY");

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, file(), "首次交付");

        assertThat(response.getOrderStatus()).isEqualTo("DELIVERED_PENDING_CONFIRM");
        verify(orderStatusPort, times(1)).changeStatus(
                ORDER_ID,
                "DELIVERED_PENDING_CONFIRM",
                PROVIDER_ID,
                "服务方上传交付文件"
        );
    }

    @Test
    void reworkRequiredUploadMovesThroughPendingDeliveryThenDeliveredPendingConfirm() {
        prepareUpload("REWORK_REQUIRED");
        when(orderService.completeReworkDelivery(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(completedOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, file(), "返修交付");

        assertThat(response.getOrderStatus()).isEqualTo("DELIVERED_PENDING_CONFIRM");
        InOrder inOrder = inOrder(fileService, deliveryRepository, deliveryFileRepository, orderService);
        inOrder.verify(fileService).upload(any(), eq(PROVIDER_ID), eq("DELIVERY"), eq("PRIVATE"));
        inOrder.verify(deliveryRepository).save(any(Delivery.class));
        inOrder.verify(deliveryFileRepository).save(any(DeliveryFile.class));
        inOrder.verify(orderService).completeReworkDelivery(ORDER_ID, PROVIDER_ID, "服务方上传交付文件");
        verify(orderStatusPort, never()).changeStatus(ORDER_ID, "PENDING_DELIVERY", PROVIDER_ID, "服务方开始返修交付");
    }

    @Test
    void reworkRequiredUploadRollsBackDeliveryRecordWhenOrderStatusUpdateFails() {
        prepareUpload("REWORK_REQUIRED");
        when(orderService.completeReworkDelivery(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenThrow(new IllegalStateException("order status failed"));

        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,
                () -> deliveryService.upload(ORDER_ID, file(), "返修交付"));

        verify(deliveryFileRepository).deleteByDeliveryId(9001L);
        verify(deliveryRepository).deleteById(9001L);
    }

    private void prepareUpload(String orderStatus) {
        when(orderQueryPort.getOrderSnapshot(ORDER_ID)).thenReturn(new OrderSnapshot(
                ORDER_ID,
                CUSTOMER_ID,
                PROVIDER_ID,
                orderStatus,
                "NONE",
                LocalDateTime.of(2026, 6, 8, 12, 0)
        ));
        when(fileService.upload(any(), eq(PROVIDER_ID), eq("DELIVERY"), eq("PRIVATE")))
                .thenReturn(new FileUploadResponse(FILE_ID, "delivery.jpg"));
        when(deliveryRepository.save(any(Delivery.class))).thenAnswer(invocation -> {
            Delivery delivery = invocation.getArgument(0);
            delivery.setId(9001L);
            return delivery;
        });
        when(deliveryFileRepository.save(any(DeliveryFile.class))).thenAnswer(invocation -> invocation.getArgument(0));
        if ("PENDING_DELIVERY".equals(orderStatus)) {
            when(orderStatusPort.changeStatus(ORDER_ID, "DELIVERED_PENDING_CONFIRM", PROVIDER_ID, "服务方上传交付文件"))
                    .thenReturn("DELIVERED_PENDING_CONFIRM");
        }
    }

    private Order completedOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setStatus(OrderStatus.DELIVERED_PENDING_CONFIRM);
        return order;
    }

    private MockMultipartFile file() {
        return new MockMultipartFile("file", "delivery.jpg", "image/jpeg", "fake-image".getBytes());
    }
}
