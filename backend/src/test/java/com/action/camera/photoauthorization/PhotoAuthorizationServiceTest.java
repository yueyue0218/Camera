package com.action.camera.photoauthorization;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.delivery.repository.DeliveryFileRepository;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.EscrowStatus;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationRequest;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationResponse;
import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationFileRepository;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationRepository;
import com.action.camera.photoauthorization.service.PhotoAuthorizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PhotoAuthorizationServiceTest {

    private static final Long ORDER_ID = 8001L;
    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long STRANGER_ID = 3001L;
    private static final Long DELIVERY_ID = 9001L;
    private static final Long FILE_ID = 5001L;
    private static final Long SECOND_FILE_ID = 5002L;
    private static final Long AUTHORIZATION_ID = 6001L;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private DeliveryRepository deliveryRepository;

    @Mock
    private DeliveryFileRepository deliveryFileRepository;

    @Mock
    private PhotoAuthorizationRepository photoAuthorizationRepository;

    @Mock
    private PhotoAuthorizationFileRepository photoAuthorizationFileRepository;

    private PhotoAuthorizationService photoAuthorizationService;

    @BeforeEach
    void setUp() {
        photoAuthorizationService = new PhotoAuthorizationService(
                orderRepository,
                deliveryRepository,
                deliveryFileRepository,
                photoAuthorizationRepository,
                photoAuthorizationFileRepository
        );
    }

    @Test
    void providerCanRequestAuthorizationForCompletedOrderDeliveryFilesAsPending() {
        prepareRequestMocks();

        PhotoAuthorizationResponse response = photoAuthorizationService.requestAuthorization(
                ORDER_ID,
                PROVIDER_ID,
                request(List.of(FILE_ID, SECOND_FILE_ID), " 希望展示到作品集 ")
        );

        assertEquals(AUTHORIZATION_ID, response.getId());
        assertEquals(ORDER_ID, response.getOrderId());
        assertEquals(CUSTOMER_ID, response.getCustomerId());
        assertEquals(PROVIDER_ID, response.getProviderUserId());
        assertEquals(PhotoAuthorization.STATUS_PENDING, response.getStatus());
        assertEquals(PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY, response.getPhotoUsageScope());
        assertEquals("希望展示到作品集", response.getRemark());
        assertNull(response.getAuthorizedAt());
        assertEquals(List.of(FILE_ID, SECOND_FILE_ID),
                response.getFiles().stream().map(file -> file.getFileId()).toList());

        ArgumentCaptor<PhotoAuthorization> authorizationCaptor = ArgumentCaptor.forClass(PhotoAuthorization.class);
        verify(photoAuthorizationRepository).save(authorizationCaptor.capture());
        assertEquals(PhotoAuthorization.STATUS_PENDING, authorizationCaptor.getValue().getStatus());
        assertNull(authorizationCaptor.getValue().getAuthorizedAt());
    }

    @Test
    void customerCanApprovePendingAuthorization() {
        PhotoAuthorization authorization = authorization(PhotoAuthorization.STATUS_PENDING);
        when(photoAuthorizationRepository.findById(AUTHORIZATION_ID)).thenReturn(Optional.of(authorization));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));
        when(photoAuthorizationRepository.save(any(PhotoAuthorization.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(photoAuthorizationFileRepository.findByAuthorizationIdIn(List.of(AUTHORIZATION_ID)))
                .thenReturn(List.of(authorizationFile(AUTHORIZATION_ID, FILE_ID, 0)));

        PhotoAuthorizationResponse response =
                photoAuthorizationService.approve(AUTHORIZATION_ID, CUSTOMER_ID, "同意展示");

        assertEquals(PhotoAuthorization.STATUS_GRANTED, response.getStatus());
        assertEquals("同意展示", response.getRemark());
        assertTrue(response.getAuthorizedAt() != null);
        assertEquals(List.of(FILE_ID), response.getFiles().stream().map(file -> file.getFileId()).toList());
    }

    @Test
    void customerCanRejectPendingAuthorization() {
        PhotoAuthorization authorization = authorization(PhotoAuthorization.STATUS_PENDING);
        when(photoAuthorizationRepository.findById(AUTHORIZATION_ID)).thenReturn(Optional.of(authorization));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));
        when(photoAuthorizationRepository.save(any(PhotoAuthorization.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(photoAuthorizationFileRepository.findByAuthorizationIdIn(List.of(AUTHORIZATION_ID)))
                .thenReturn(List.of(authorizationFile(AUTHORIZATION_ID, FILE_ID, 0)));

        PhotoAuthorizationResponse response =
                photoAuthorizationService.reject(AUTHORIZATION_ID, CUSTOMER_ID, "不希望公开展示");

        assertEquals(PhotoAuthorization.STATUS_REJECTED, response.getStatus());
        assertEquals("不希望公开展示", response.getRemark());
        assertNull(response.getAuthorizedAt());
    }

    @Test
    void providerAndStrangerCannotApproveOrRejectForCustomer() {
        PhotoAuthorization authorization = authorization(PhotoAuthorization.STATUS_PENDING);
        when(photoAuthorizationRepository.findById(AUTHORIZATION_ID)).thenReturn(Optional.of(authorization));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));

        BusinessException providerApprove = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.approve(AUTHORIZATION_ID, PROVIDER_ID, null));
        BusinessException strangerReject = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.reject(AUTHORIZATION_ID, STRANGER_ID, null));

        assertEquals(ErrorCode.FORBIDDEN, providerApprove.getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, strangerReject.getErrorCode());
        verify(photoAuthorizationRepository, never()).save(any(PhotoAuthorization.class));
    }

    @Test
    void nonProviderCannotRequestAuthorization() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));

        BusinessException customerException = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.requestAuthorization(
                        ORDER_ID,
                        CUSTOMER_ID,
                        request(List.of(FILE_ID), null)
                ));
        BusinessException strangerException = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.requestAuthorization(
                        ORDER_ID,
                        STRANGER_ID,
                        request(List.of(FILE_ID), null)
                ));

        assertEquals(ErrorCode.FORBIDDEN, customerException.getErrorCode());
        assertEquals(ErrorCode.FORBIDDEN, strangerException.getErrorCode());
        verify(deliveryRepository, never()).findByOrderIdOrderByUploadTimeDesc(any());
        verify(photoAuthorizationRepository, never()).save(any(PhotoAuthorization.class));
    }

    @Test
    void unfinishedOrderCannotRequestAuthorization() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.DELIVERED_PENDING_CONFIRM)));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.requestAuthorization(
                        ORDER_ID,
                        PROVIDER_ID,
                        request(List.of(FILE_ID), null)
                ));

        assertEquals(ErrorCode.STATUS_CONFLICT, exception.getErrorCode());
        verify(deliveryRepository, never()).findByOrderIdOrderByUploadTimeDesc(any());
        verify(photoAuthorizationRepository, never()).save(any(PhotoAuthorization.class));
    }

    @Test
    void fileOutsideOrderCannotBeRequested() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));
        when(deliveryRepository.findByOrderIdOrderByUploadTimeDesc(ORDER_ID)).thenReturn(List.of(delivery()));
        when(deliveryFileRepository.findByDeliveryIdInAndFileIdIn(
                eq(List.of(DELIVERY_ID)),
                eq(new LinkedHashSet<>(List.of(FILE_ID)))
        )).thenReturn(List.of());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.requestAuthorization(
                        ORDER_ID,
                        PROVIDER_ID,
                        request(List.of(FILE_ID), null)
                ));

        assertEquals(ErrorCode.VALIDATION_ERROR, exception.getErrorCode());
        verify(photoAuthorizationRepository, never()).save(any(PhotoAuthorization.class));
    }

    @Test
    void duplicateRequestForSameOrderAndFileIsRejected() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));
        when(deliveryRepository.findByOrderIdOrderByUploadTimeDesc(ORDER_ID)).thenReturn(List.of(delivery()));
        when(deliveryFileRepository.findByDeliveryIdInAndFileIdIn(
                eq(List.of(DELIVERY_ID)),
                eq(new LinkedHashSet<>(List.of(FILE_ID)))
        )).thenReturn(List.of(deliveryFile(FILE_ID)));

        PhotoAuthorization existingAuthorization = authorization(PhotoAuthorization.STATUS_REJECTED);
        PhotoAuthorizationFile existingFile = authorizationFile(AUTHORIZATION_ID, FILE_ID, 0);
        when(photoAuthorizationFileRepository.findByFileIdIn(anyCollection())).thenReturn(List.of(existingFile));
        when(photoAuthorizationRepository.findAllById(anyCollection())).thenReturn(List.of(existingAuthorization));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.requestAuthorization(
                        ORDER_ID,
                        PROVIDER_ID,
                        request(List.of(FILE_ID), null)
                ));

        assertEquals(ErrorCode.DUPLICATE_OPERATION, exception.getErrorCode());
        verify(photoAuthorizationRepository, never()).save(any(PhotoAuthorization.class));
    }

    @Test
    void cannotApproveOrRejectNonPendingAuthorization() {
        PhotoAuthorization grantedAuthorization = authorization(PhotoAuthorization.STATUS_GRANTED);
        grantedAuthorization.setAuthorizedAt(LocalDateTime.of(2026, 6, 20, 12, 0));
        when(photoAuthorizationRepository.findById(AUTHORIZATION_ID)).thenReturn(Optional.of(grantedAuthorization));
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.approve(AUTHORIZATION_ID, CUSTOMER_ID, null));

        assertEquals(ErrorCode.STATUS_CONFLICT, exception.getErrorCode());
        verify(photoAuthorizationRepository, never()).save(any(PhotoAuthorization.class));
    }

    @Test
    void providerListOnlyReturnsGrantedAuthorizations() {
        PhotoAuthorization grantedAuthorization = authorization(PhotoAuthorization.STATUS_GRANTED);
        grantedAuthorization.setAuthorizedAt(LocalDateTime.of(2026, 6, 20, 12, 0));
        when(photoAuthorizationRepository.findByProviderUserIdAndStatusOrderByAuthorizedAtDesc(
                PROVIDER_ID,
                PhotoAuthorization.STATUS_GRANTED
        )).thenReturn(List.of(grantedAuthorization));
        when(photoAuthorizationFileRepository.findByAuthorizationIdIn(List.of(AUTHORIZATION_ID)))
                .thenReturn(List.of(authorizationFile(AUTHORIZATION_ID, FILE_ID, 0)));

        List<PhotoAuthorizationResponse> responses =
                photoAuthorizationService.listProviderAuthorizations(PROVIDER_ID);

        assertEquals(1, responses.size());
        assertEquals(PhotoAuthorization.STATUS_GRANTED, responses.get(0).getStatus());
        assertEquals(PROVIDER_ID, responses.get(0).getProviderUserId());
        assertEquals(List.of(FILE_ID), responses.get(0).getFiles().stream().map(file -> file.getFileId()).toList());
    }

    @Test
    void unrelatedProviderCannotSeeOtherProvidersAuthorizedPhotos() {
        when(photoAuthorizationRepository.findByProviderUserIdAndStatusOrderByAuthorizedAtDesc(
                STRANGER_ID,
                PhotoAuthorization.STATUS_GRANTED
        )).thenReturn(List.of());

        List<PhotoAuthorizationResponse> responses =
                photoAuthorizationService.listProviderAuthorizations(STRANGER_ID);

        assertTrue(responses.isEmpty());
        verify(photoAuthorizationFileRepository, never()).findByAuthorizationIdIn(anyCollection());
    }

    @Test
    void orderParticipantsCanListAuthorizationsAndStrangerCannot() {
        PhotoAuthorization pendingAuthorization = authorization(PhotoAuthorization.STATUS_PENDING);
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));
        when(photoAuthorizationRepository.findByOrderIdOrderByAuthorizedAtDesc(ORDER_ID))
                .thenReturn(List.of(pendingAuthorization));
        when(photoAuthorizationFileRepository.findByAuthorizationIdIn(List.of(AUTHORIZATION_ID)))
                .thenReturn(List.of(authorizationFile(AUTHORIZATION_ID, FILE_ID, 0)));

        List<PhotoAuthorizationResponse> customerResponses =
                photoAuthorizationService.listOrderAuthorizations(ORDER_ID, CUSTOMER_ID);
        List<PhotoAuthorizationResponse> providerResponses =
                photoAuthorizationService.listOrderAuthorizations(ORDER_ID, PROVIDER_ID);
        BusinessException strangerException = assertThrows(BusinessException.class,
                () -> photoAuthorizationService.listOrderAuthorizations(ORDER_ID, STRANGER_ID));

        assertEquals(PhotoAuthorization.STATUS_PENDING, customerResponses.get(0).getStatus());
        assertEquals(PhotoAuthorization.STATUS_PENDING, providerResponses.get(0).getStatus());
        assertEquals(ErrorCode.FORBIDDEN, strangerException.getErrorCode());
    }

    private void prepareRequestMocks() {
        when(orderRepository.findById(ORDER_ID)).thenReturn(Optional.of(order(OrderStatus.COMPLETED)));
        when(deliveryRepository.findByOrderIdOrderByUploadTimeDesc(ORDER_ID)).thenReturn(List.of(delivery()));
        when(deliveryFileRepository.findByDeliveryIdInAndFileIdIn(
                eq(List.of(DELIVERY_ID)),
                eq(new LinkedHashSet<>(List.of(FILE_ID, SECOND_FILE_ID)))
        )).thenReturn(List.of(deliveryFile(FILE_ID), deliveryFile(SECOND_FILE_ID)));
        when(photoAuthorizationFileRepository.findByFileIdIn(anyCollection())).thenReturn(List.of());
        when(photoAuthorizationRepository.save(any(PhotoAuthorization.class))).thenAnswer(invocation -> {
            PhotoAuthorization authorization = invocation.getArgument(0);
            authorization.setId(AUTHORIZATION_ID);
            return authorization;
        });
        when(photoAuthorizationFileRepository.save(any(PhotoAuthorizationFile.class))).thenAnswer(invocation -> {
            PhotoAuthorizationFile file = invocation.getArgument(0);
            file.setId(file.getFileId() + 100);
            return file;
        });
    }

    private PhotoAuthorizationRequest request(List<Long> fileIds, String remark) {
        PhotoAuthorizationRequest request = new PhotoAuthorizationRequest();
        request.setFileIds(fileIds);
        request.setRemark(remark);
        return request;
    }

    private Order order(OrderStatus status) {
        Order order = new Order();
        order.setId(ORDER_ID);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        order.setStatus(status);
        order.setEscrowStatus(EscrowStatus.RELEASED);
        order.setSettlementStatus("SETTLED");
        return order;
    }

    private Delivery delivery() {
        Delivery delivery = new Delivery();
        delivery.setId(DELIVERY_ID);
        delivery.setOrderId(ORDER_ID);
        delivery.setUploadTime(LocalDateTime.of(2026, 6, 10, 12, 0));
        return delivery;
    }

    private DeliveryFile deliveryFile(Long fileId) {
        DeliveryFile file = new DeliveryFile();
        file.setId(fileId + 200);
        file.setDeliveryId(DELIVERY_ID);
        file.setFileId(fileId);
        file.setSortOrder(fileId.equals(FILE_ID) ? 0 : 1);
        return file;
    }

    private PhotoAuthorization authorization(String status) {
        PhotoAuthorization authorization = new PhotoAuthorization();
        authorization.setId(AUTHORIZATION_ID);
        authorization.setOrderId(ORDER_ID);
        authorization.setCustomerId(CUSTOMER_ID);
        authorization.setProviderUserId(PROVIDER_ID);
        authorization.setStatus(status);
        authorization.setPhotoUsageScope(PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY);
        return authorization;
    }

    private PhotoAuthorizationFile authorizationFile(Long authorizationId, Long fileId, Integer sortOrder) {
        PhotoAuthorizationFile file = new PhotoAuthorizationFile();
        file.setId(fileId + 300);
        file.setAuthorizationId(authorizationId);
        file.setFileId(fileId);
        file.setSortOrder(sortOrder);
        return file;
    }
}
