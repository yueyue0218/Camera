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
    void customerAuthorizeEndpointUsesCurrentUser() {
        UserContext.setUserId(CUSTOMER_ID);
        PhotoAuthorizationRequest request = new PhotoAuthorizationRequest();
        request.setFileIds(List.of(5001L));
        PhotoAuthorizationResponse response = response();
        when(photoAuthorizationService.authorize(ORDER_ID, CUSTOMER_ID, request)).thenReturn(response);

        Result<PhotoAuthorizationResponse> result =
                photoAuthorizationController.authorize(ORDER_ID, request);

        assertEquals(200, result.getCode());
        assertEquals(AUTHORIZATION_ID, result.getData().getId());
        verify(photoAuthorizationService).authorize(ORDER_ID, CUSTOMER_ID, request);
    }

    @Test
    void listOrderAuthorizationsUsesCurrentUser() {
        UserContext.setUserId(CUSTOMER_ID);
        when(photoAuthorizationService.listOrderAuthorizations(ORDER_ID, CUSTOMER_ID))
                .thenReturn(List.of(response()));

        Result<List<PhotoAuthorizationResponse>> result =
                photoAuthorizationController.listOrderAuthorizations(ORDER_ID);

        assertEquals(1, result.getData().size());
        verify(photoAuthorizationService).listOrderAuthorizations(ORDER_ID, CUSTOMER_ID);
    }

    @Test
    void providerListEndpointUsesCurrentUser() {
        UserContext.setUserId(PROVIDER_ID);
        when(photoAuthorizationService.listProviderAuthorizations(PROVIDER_ID)).thenReturn(List.of(response()));

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

    private PhotoAuthorizationResponse response() {
        return PhotoAuthorizationResponse.builder()
                .id(AUTHORIZATION_ID)
                .orderId(ORDER_ID)
                .customerId(CUSTOMER_ID)
                .providerUserId(PROVIDER_ID)
                .status(PhotoAuthorization.STATUS_GRANTED)
                .photoUsageScope(PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY)
                .authorizedAt(LocalDateTime.of(2026, 6, 20, 12, 0))
                .files(List.of())
                .build();
    }
}
