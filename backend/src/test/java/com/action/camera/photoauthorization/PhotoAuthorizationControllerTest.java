package com.action.camera.photoauthorization;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.Result;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.photoauthorization.controller.PhotoAuthorizationController;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationRequest;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationResponse;
import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import com.action.camera.photoauthorization.service.PhotoAuthorizationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PhotoAuthorizationControllerTest {

    private static final Long ORDER_ID = 8001L;
    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long AUTHORIZATION_ID = 6001L;

    @Mock
    private PhotoAuthorizationService photoAuthorizationService;

    private PhotoAuthorizationController photoAuthorizationController;

    @BeforeEach
    void setUp() {
        photoAuthorizationController = new PhotoAuthorizationController(photoAuthorizationService);
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void providerRequestEndpointUsesCurrentUser() {
        UserContext.setUserId(PROVIDER_ID);
        PhotoAuthorizationRequest request = new PhotoAuthorizationRequest();
        request.setFileIds(List.of(5001L));
        PhotoAuthorizationResponse response = response(PhotoAuthorization.STATUS_PENDING);
        when(photoAuthorizationService.requestAuthorization(ORDER_ID, PROVIDER_ID, request)).thenReturn(response);

        Result<PhotoAuthorizationResponse> result =
                photoAuthorizationController.requestAuthorization(ORDER_ID, request);

        assertEquals(200, result.getCode());
        assertEquals(PhotoAuthorization.STATUS_PENDING, result.getData().getStatus());
        verify(photoAuthorizationService).requestAuthorization(ORDER_ID, PROVIDER_ID, request);
    }

    @Test
    void approveEndpointUsesCurrentUserAndRemark() {
        UserContext.setUserId(CUSTOMER_ID);
        PhotoAuthorizationRequest request = new PhotoAuthorizationRequest();
        request.setRemark("同意展示");
        when(photoAuthorizationService.approve(AUTHORIZATION_ID, CUSTOMER_ID, "同意展示"))
                .thenReturn(response(PhotoAuthorization.STATUS_GRANTED));

        Result<PhotoAuthorizationResponse> result =
                photoAuthorizationController.approve(AUTHORIZATION_ID, request);

        assertEquals(PhotoAuthorization.STATUS_GRANTED, result.getData().getStatus());
        verify(photoAuthorizationService).approve(AUTHORIZATION_ID, CUSTOMER_ID, "同意展示");
    }

    @Test
    void rejectEndpointUsesCurrentUserAndRemark() {
        UserContext.setUserId(CUSTOMER_ID);
        PhotoAuthorizationRequest request = new PhotoAuthorizationRequest();
        request.setRemark("不同意公开");
        when(photoAuthorizationService.reject(AUTHORIZATION_ID, CUSTOMER_ID, "不同意公开"))
                .thenReturn(response(PhotoAuthorization.STATUS_REJECTED));

        Result<PhotoAuthorizationResponse> result =
                photoAuthorizationController.reject(AUTHORIZATION_ID, request);

        assertEquals(PhotoAuthorization.STATUS_REJECTED, result.getData().getStatus());
        verify(photoAuthorizationService).reject(AUTHORIZATION_ID, CUSTOMER_ID, "不同意公开");
    }

    @Test
    void listOrderAuthorizationsUsesCurrentUser() {
        UserContext.setUserId(CUSTOMER_ID);
        when(photoAuthorizationService.listOrderAuthorizations(ORDER_ID, CUSTOMER_ID))
                .thenReturn(List.of(response(PhotoAuthorization.STATUS_PENDING)));

        Result<List<PhotoAuthorizationResponse>> result =
                photoAuthorizationController.listOrderAuthorizations(ORDER_ID);

        assertEquals(1, result.getData().size());
        verify(photoAuthorizationService).listOrderAuthorizations(ORDER_ID, CUSTOMER_ID);
    }

    @Test
    void providerListEndpointUsesCurrentUser() {
        UserContext.setUserId(PROVIDER_ID);
        when(photoAuthorizationService.listProviderAuthorizations(PROVIDER_ID))
                .thenReturn(List.of(response(PhotoAuthorization.STATUS_GRANTED)));

        Result<List<PhotoAuthorizationResponse>> result =
                photoAuthorizationController.listProviderAuthorizations();

        assertEquals(1, result.getData().size());
        verify(photoAuthorizationService).listProviderAuthorizations(PROVIDER_ID);
    }

    @Test
    void endpointsRejectUnauthenticatedUser() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> photoAuthorizationController.listProviderAuthorizations());

        assertEquals(ErrorCode.UNAUTHORIZED, exception.getErrorCode());
    }

    private PhotoAuthorizationResponse response(String status) {
        return PhotoAuthorizationResponse.builder()
                .id(AUTHORIZATION_ID)
                .orderId(ORDER_ID)
                .customerId(CUSTOMER_ID)
                .providerUserId(PROVIDER_ID)
                .status(status)
                .photoUsageScope(PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY)
                .authorizedAt(PhotoAuthorization.STATUS_GRANTED.equals(status)
                        ? LocalDateTime.of(2026, 6, 20, 12, 0)
                        : null)
                .files(List.of())
                .build();
    }
}
