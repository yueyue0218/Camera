package com.action.camera.delivery.service;

import com.action.camera.application.FileService;
import com.action.camera.application.OrderDisplayService;
import com.action.camera.application.UserDisplayService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.dto.DeliveryUploadResponse;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
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
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @Mock
    private UserDisplayService userDisplayService;

    @Mock
    private OrderDisplayService orderDisplayService;

    private DeliveryService deliveryService;

    @BeforeEach
    void setUp() {
        deliveryService = new DeliveryService(
                deliveryRepository,
                deliveryFileRepository,
                fileService,
                fileRepository,
                orderQueryPort,
                orderStatusPort,
                orderService,
                txTemplate,
                userDisplayService,
                orderDisplayService
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
        when(orderService.markDeliveryUploaded(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(deliveredOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, file(), "首次交付");

        assertThat(response.getOrderStatus()).isEqualTo("DELIVERED_PENDING_CONFIRM");
        assertThat(response.getFileId()).isEqualTo(FILE_ID);
        assertThat(response.getFiles()).singleElement()
                .satisfies(file -> {
                    assertThat(file.getFileId()).isEqualTo(FILE_ID);
                    assertThat(file.getFileName()).isEqualTo("delivery.jpg");
                    assertThat(file.getMimeType()).isEqualTo("image/jpeg");
                    assertThat(file.getFileType()).isEqualTo("IMAGE");
                    assertThat(file.getSortOrder()).isZero();
                });
        InOrder inOrder = inOrder(orderQueryPort, orderService, fileService, deliveryRepository,
                deliveryFileRepository);
        inOrder.verify(orderQueryPort).getOrderSnapshot(ORDER_ID);
        inOrder.verify(orderService).syncTimelineStatusIfDue(ORDER_ID);
        inOrder.verify(orderQueryPort).getOrderSnapshot(ORDER_ID);
        inOrder.verify(deliveryRepository).findByOrderIdOrderByUploadTimeDesc(ORDER_ID);
        inOrder.verify(fileService).upload(any(), eq(PROVIDER_ID), eq("DELIVERY"), eq("PRIVATE"));
        inOrder.verify(deliveryRepository).save(any(Delivery.class));
        inOrder.verify(deliveryFileRepository).save(any(DeliveryFile.class));
        inOrder.verify(orderService).markDeliveryUploaded(ORDER_ID, PROVIDER_ID, "服务方上传交付文件");
        verify(orderService, times(1)).markDeliveryUploaded(
                ORDER_ID,
                PROVIDER_ID,
                "服务方上传交付文件"
        );
        verify(orderStatusPort, never()).changeStatus(any(), any(), any(), any());
    }

    @Test
    void reworkRequiredUploadMovesThroughPendingDeliveryThenDeliveredPendingConfirm() {
        prepareUpload("REWORK_REQUIRED");
        when(orderService.completeReworkDelivery(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(completedOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, file(), "返修交付");

        assertThat(response.getOrderStatus()).isEqualTo("DELIVERED_PENDING_CONFIRM");
        InOrder inOrder = inOrder(orderQueryPort, orderService, fileService, deliveryRepository,
                deliveryFileRepository);
        inOrder.verify(orderQueryPort).getOrderSnapshot(ORDER_ID);
        inOrder.verify(orderService).syncTimelineStatusIfDue(ORDER_ID);
        inOrder.verify(orderQueryPort).getOrderSnapshot(ORDER_ID);
        inOrder.verify(deliveryRepository).findByOrderIdOrderByUploadTimeDesc(ORDER_ID);
        inOrder.verify(fileService).upload(any(), eq(PROVIDER_ID), eq("DELIVERY"), eq("PRIVATE"));
        inOrder.verify(deliveryRepository).save(any(Delivery.class));
        inOrder.verify(deliveryFileRepository).save(any(DeliveryFile.class));
        inOrder.verify(orderService).completeReworkDelivery(ORDER_ID, PROVIDER_ID, "服务方上传交付文件");
        verify(orderStatusPort, never()).changeStatus(ORDER_ID, "PENDING_DELIVERY", PROVIDER_ID, "服务方开始返修交付");
    }

    @Test
    void reworkUploadUsesNextDeliveryRoundFromExistingDeliveries() {
        prepareUpload("REWORK_REQUIRED");
        Delivery previousDelivery = new Delivery();
        previousDelivery.setId(8000L);
        previousDelivery.setOrderId(ORDER_ID);
        previousDelivery.setDeliveryRound(1);
        when(deliveryRepository.findByOrderIdOrderByUploadTimeDesc(ORDER_ID)).thenReturn(List.of(previousDelivery));
        when(orderService.completeReworkDelivery(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(completedOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, file(), "返修交付");

        assertThat(response.getDeliveryRound()).isEqualTo(2);
        ArgumentCaptor<Delivery> deliveryCaptor = ArgumentCaptor.forClass(Delivery.class);
        verify(deliveryRepository).save(deliveryCaptor.capture());
        assertThat(deliveryCaptor.getValue().getDeliveryRound()).isEqualTo(2);
    }

    @Test
    void paidPendingShootUploadIsRejectedUntilSchedulerAdvancesRealStatus() {
        prepareUpload("PAID_PENDING_SHOOT");

        assertThatThrownBy(() -> deliveryService.upload(ORDER_ID, file(), "提前交付"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATUS_CONFLICT));

        verify(orderService).syncTimelineStatusIfDue(ORDER_ID);
        verify(fileService, never()).upload(any(), any(), any(), any());
        verify(orderService, never()).markDeliveryUploaded(any(), any(), any());
        verify(orderStatusPort, never()).changeStatus(any(), any(), any(), any());
    }

    @Test
    void uploadRechecksOrderAfterTimelineSyncAndAllowsPendingDelivery() {
        when(orderQueryPort.getOrderSnapshot(ORDER_ID))
                .thenReturn(snapshot("SHOOTING"))
                .thenReturn(snapshot("PENDING_DELIVERY"));
        prepareDeliveryPersistence();
        when(orderService.markDeliveryUploaded(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(deliveredOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, file(), "拍摄结束后交付");

        assertThat(response.getOrderStatus()).isEqualTo("DELIVERED_PENDING_CONFIRM");
        InOrder inOrder = inOrder(orderQueryPort, orderService, fileService, deliveryRepository,
                deliveryFileRepository);
        inOrder.verify(orderQueryPort).getOrderSnapshot(ORDER_ID);
        inOrder.verify(orderService).syncTimelineStatusIfDue(ORDER_ID);
        inOrder.verify(orderQueryPort).getOrderSnapshot(ORDER_ID);
        inOrder.verify(deliveryRepository).findByOrderIdOrderByUploadTimeDesc(ORDER_ID);
        inOrder.verify(fileService).upload(any(), eq(PROVIDER_ID), eq("DELIVERY"), eq("PRIVATE"));
        inOrder.verify(deliveryRepository).save(any(Delivery.class));
        inOrder.verify(deliveryFileRepository).save(any(DeliveryFile.class));
        inOrder.verify(orderService).markDeliveryUploaded(ORDER_ID, PROVIDER_ID, "服务方上传交付文件");
        verify(orderStatusPort, never()).changeStatus(any(), any(), any(), any());
    }

    @Test
    void multiImageUploadCreatesOneDeliveryBatchWithMultipleDeliveryFiles() {
        prepareUpload("PENDING_DELIVERY",
                new FileUploadResponse(5001L, "cover.jpg"),
                new FileUploadResponse(5002L, "detail.png"),
                new FileUploadResponse(5003L, "retouch.webp"));
        when(orderService.markDeliveryUploaded(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(deliveredOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, List.of(
                multipart("files", "cover.jpg", "image/jpeg"),
                multipart("files", "detail.png", "image/png"),
                multipart("files", "retouch.webp", "image/webp")
        ), "多图交付");

        assertThat(response.getFileId()).isEqualTo(5001L);
        assertThat(response.getFiles()).hasSize(3);
        assertThat(response.getFiles())
                .extracting("fileType")
                .containsExactly("IMAGE", "IMAGE", "IMAGE");

        ArgumentCaptor<Delivery> deliveryCaptor = ArgumentCaptor.forClass(Delivery.class);
        verify(deliveryRepository).save(deliveryCaptor.capture());
        assertThat(deliveryCaptor.getValue().getOriginalCount()).isEqualTo(3);
        assertThat(deliveryCaptor.getValue().getRefinedCount()).isEqualTo(3);

        ArgumentCaptor<DeliveryFile> deliveryFileCaptor = ArgumentCaptor.forClass(DeliveryFile.class);
        verify(deliveryFileRepository, times(3)).save(deliveryFileCaptor.capture());
        assertThat(deliveryFileCaptor.getAllValues())
                .extracting(DeliveryFile::getFileId)
                .containsExactly(5001L, 5002L, 5003L);
        assertThat(deliveryFileCaptor.getAllValues())
                .extracting(DeliveryFile::getSortOrder)
                .containsExactly(0, 1, 2);
    }

    @Test
    void imageAndZipUploadKeepsZipAsFileCardOnlyType() {
        prepareUpload("PENDING_DELIVERY",
                new FileUploadResponse(5001L, "cover.jpg"),
                new FileUploadResponse(5002L, "all-originals.zip"));
        when(orderService.markDeliveryUploaded(ORDER_ID, PROVIDER_ID, "服务方上传交付文件"))
                .thenReturn(deliveredOrder());

        DeliveryUploadResponse response = deliveryService.upload(ORDER_ID, List.of(
                multipart("files", "cover.jpg", "image/jpeg"),
                multipart("files", "all-originals.zip", "application/zip")
        ), "图片和压缩包");

        assertThat(response.getFiles()).hasSize(2);
        assertThat(response.getFiles())
                .extracting("fileType")
                .containsExactly("IMAGE", "ZIP");

        ArgumentCaptor<DeliveryFile> deliveryFileCaptor = ArgumentCaptor.forClass(DeliveryFile.class);
        verify(deliveryFileRepository, times(2)).save(deliveryFileCaptor.capture());
        assertThat(deliveryFileCaptor.getAllValues())
                .extracting(DeliveryFile::getFileType)
                .containsExactly("IMAGE", "ZIP");

        ArgumentCaptor<Delivery> deliveryCaptor = ArgumentCaptor.forClass(Delivery.class);
        verify(deliveryRepository).save(deliveryCaptor.capture());
        assertThat(deliveryCaptor.getValue().getOriginalCount()).isEqualTo(1);
        assertThat(deliveryCaptor.getValue().getRefinedCount()).isEqualTo(1);
    }

    @Test
    void executableDeliveryFileIsRejectedBeforeUpload() {
        assertThatThrownBy(() -> deliveryService.upload(ORDER_ID,
                List.of(multipart("files", "malware.exe", "application/octet-stream")),
                "非法文件"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));

        verify(fileService, never()).upload(any(), any(), any(), any());
        verify(deliveryRepository, never()).save(any(Delivery.class));
        verify(orderService, never()).markDeliveryUploaded(any(), any(), any());
    }

    @Test
    void shootingUploadIsRejectedUntilSchedulerAdvancesRealStatus() {
        prepareUpload("SHOOTING");

        assertThatThrownBy(() -> deliveryService.upload(ORDER_ID, file(), "拍摄中交付"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATUS_CONFLICT));

        verify(orderService).syncTimelineStatusIfDue(ORDER_ID);
        verify(fileService, never()).upload(any(), any(), any(), any());
        verify(orderService, never()).markDeliveryUploaded(any(), any(), any());
        verify(orderStatusPort, never()).changeStatus(any(), any(), any(), any());
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
        verify(fileService).deleteUploadedFileQuietly(FILE_ID);
    }

    private void prepareUpload(String orderStatus) {
        prepareUpload(orderStatus, new FileUploadResponse(FILE_ID, "delivery.jpg"));
    }

    private void prepareUpload(String orderStatus, FileUploadResponse... uploadedFiles) {
        when(orderQueryPort.getOrderSnapshot(ORDER_ID)).thenReturn(snapshot(orderStatus));
        if (!"PENDING_DELIVERY".equals(orderStatus) && !"REWORK_REQUIRED".equals(orderStatus)) {
            return;
        }
        prepareDeliveryPersistence(uploadedFiles);
    }

    private OrderSnapshot snapshot(String orderStatus) {
        return new OrderSnapshot(
                ORDER_ID,
                CUSTOMER_ID,
                PROVIDER_ID,
                orderStatus,
                "NONE",
                LocalDateTime.of(2026, 6, 8, 12, 0)
        );
    }

    private void prepareDeliveryPersistence(FileUploadResponse... uploadedFiles) {
        if (uploadedFiles == null || uploadedFiles.length == 0) {
            uploadedFiles = new FileUploadResponse[] { new FileUploadResponse(FILE_ID, "delivery.jpg") };
        }
        final FileUploadResponse[] responses = uploadedFiles;
        when(txTemplate.execute(any())).thenAnswer(invocation -> {
            TransactionCallback<?> callback = invocation.getArgument(0);
            return callback.doInTransaction(null);
        });
        final int[] uploadIndex = {0};
        when(fileService.upload(any(), eq(PROVIDER_ID), eq("DELIVERY"), eq("PRIVATE")))
                .thenAnswer(invocation -> responses[Math.min(uploadIndex[0]++, responses.length - 1)]);
        when(deliveryRepository.save(any(Delivery.class))).thenAnswer(invocation -> {
            Delivery delivery = invocation.getArgument(0);
            delivery.setId(9001L);
            return delivery;
        });
        when(deliveryFileRepository.save(any(DeliveryFile.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private Order deliveredOrder() {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setStatus(OrderStatus.DELIVERED_PENDING_CONFIRM);
        return order;
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

    private MockMultipartFile multipart(String fieldName, String fileName, String contentType) {
        return new MockMultipartFile(fieldName, fileName, contentType, ("fake-" + fileName).getBytes());
    }
}
