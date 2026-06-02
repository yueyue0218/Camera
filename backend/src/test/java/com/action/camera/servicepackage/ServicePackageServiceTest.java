package com.action.camera.servicepackage;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import com.action.camera.order.entity.Order;
import com.action.camera.order.event.OrderPaidEvent;
import com.action.camera.schedule.service.ScheduleService;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.dto.CreateServicePackageRequest;
import com.action.camera.servicepackage.dto.CreateServicePackageResult;
import com.action.camera.servicepackage.dto.ReserveServicePackageRequest;
import com.action.camera.servicepackage.dto.ReserveServicePackageResult;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageDetailDto;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import com.action.camera.servicepackage.service.ServicePackageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServicePackageServiceTest {

    private static final Long CUSTOMER_ID = 1001L;
    private static final Long PROVIDER_ID = 2001L;
    private static final Long SERVICE_ID = 9101L;
    private static final Long CONVERSATION_ID = 9201L;
    private static final Long SCHEDULE_HOLD_ID = 9301L;

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private ScheduleService scheduleService;

    @Mock
    private ConversationService conversationService;

    private ServicePackageService servicePackageService;

    @BeforeEach
    void setUp() {
        servicePackageService = new ServicePackageService(
                servicePackageRepository,
                scheduleService,
                conversationService
        );
    }

    @Test
    void providerCanPublishOnlineAvailableServicePackage() {
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> {
            ServicePackage servicePackage = invocation.getArgument(0);
            servicePackage.setId(SERVICE_ID);
            return servicePackage;
        });

        CreateServicePackageResult result =
                servicePackageService.createServicePackage(provider(), createRequest());

        assertThat(result.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(result.getStatus()).isEqualTo(ServicePackageStatus.ONLINE.name());
        assertThat(result.getIsAvailable()).isTrue();

        ArgumentCaptor<ServicePackage> captor = ArgumentCaptor.forClass(ServicePackage.class);
        verify(servicePackageRepository).save(captor.capture());
        assertThat(captor.getValue().getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(captor.getValue().getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(captor.getValue().getIsAvailable()).isTrue();
    }

    @Test
    void customerHallReturnsOnlineServicesIncludingUnavailableAndExcludesOffline() {
        ServicePackage available = servicePackage(1L, ServicePackageStatus.ONLINE, true);
        ServicePackage unavailable = servicePackage(2L, ServicePackageStatus.ONLINE, false);
        ServicePackage offline = servicePackage(3L, ServicePackageStatus.OFFLINE, false);
        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE))
                .thenReturn(List.of(available, unavailable, offline));

        PageResult<ServicePackageCardDto> page =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);

        assertThat(page.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(2L, 1L);
        assertThat(page.getRecords()).extracting(ServicePackageCardDto::getIsAvailable)
                .containsExactly(false, true);
    }

    @Test
    void hallFiltersByCitySceneStylePriceAndAvailableDate() {
        ServicePackage matched = servicePackage(1L, ServicePackageStatus.ONLINE, true);
        ServicePackage otherCity = servicePackage(2L, ServicePackageStatus.ONLINE, true);
        otherCity.setCityCode("SH");
        ServicePackage otherScene = servicePackage(3L, ServicePackageStatus.ONLINE, true);
        otherScene.setScene("PORTRAIT");
        ServicePackage otherStyle = servicePackage(4L, ServicePackageStatus.ONLINE, true);
        otherStyle.setStyleTags(List.of("studio"));
        ServicePackage otherPrice = servicePackage(5L, ServicePackageStatus.ONLINE, true);
        otherPrice.setBasePriceCent(99900L);
        ServicePackage otherDate = servicePackage(6L, ServicePackageStatus.ONLINE, true);
        otherDate.setAvailableDates(List.of(LocalDate.of(2026, 6, 2)));
        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE))
                .thenReturn(List.of(matched, otherCity, otherScene, otherStyle, otherPrice, otherDate));

        PageResult<ServicePackageCardDto> page = servicePackageService.listServices(
                1,
                10,
                "NJ",
                "GRADUATION",
                "natural",
                30000L,
                50000L,
                LocalDate.of(2026, 6, 1),
                null
        );

        assertThat(page.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(1L);
    }

    @Test
    void customerCanViewOnlineServiceDetail() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));

        ServicePackageDetailDto detail = servicePackageService.getServiceDetail(SERVICE_ID);

        assertThat(detail.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(detail.getIsAvailable()).isTrue();
        assertThat(detail.getPortfolioIds()).containsExactly(11L, 12L);
    }

    @Test
    void customerReserveHoldsScheduleCreatesConversationAndMarksUnavailable() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        when(scheduleService.createTemporaryHold(PROVIDER_ID, SERVICE_ID, LocalDate.of(2026, 6, 1)))
                .thenReturn(SCHEDULE_HOLD_ID);
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(conversationService.createConversationWithInitialMessage(any(CreateConversationCommand.class)))
                .thenReturn(new CreateConversationResult(CONVERSATION_ID));

        ReserveServicePackageResult result = servicePackageService.reserveServicePackage(
                SERVICE_ID,
                customer(),
                reserveRequest("Please hold this date.")
        );

        assertThat(result.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(result.getConversationId()).isEqualTo(CONVERSATION_ID);
        assertThat(result.getScheduleHoldId()).isEqualTo(SCHEDULE_HOLD_ID);
        assertThat(result.getIsAvailable()).isFalse();
        assertThat(servicePackage.getIsAvailable()).isFalse();

        ArgumentCaptor<CreateConversationCommand> commandCaptor =
                ArgumentCaptor.forClass(CreateConversationCommand.class);
        verify(conversationService).createConversationWithInitialMessage(commandCaptor.capture());
        CreateConversationCommand command = commandCaptor.getValue();
        assertThat(command.getCustomerId()).isEqualTo(CUSTOMER_ID);
        assertThat(command.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(command.getInitiatorId()).isEqualTo(CUSTOMER_ID);
        assertThat(command.getSourceType()).isEqualTo(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        assertThat(command.getSourceId()).isEqualTo(SERVICE_ID);
        assertThat(command.getInitialMessage()).isEqualTo("Please hold this date.");
    }

    @Test
    void unavailableServiceCannotBeReservedAgainButStillAppearsInHall() {
        ServicePackage unavailable = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, false);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(unavailable));

        assertThatThrownBy(() -> servicePackageService.reserveServicePackage(
                SERVICE_ID,
                customer(),
                reserveRequest("Try again.")
        )).isInstanceOf(BusinessException.class);

        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE)).thenReturn(List.of(unavailable));
        PageResult<ServicePackageCardDto> page =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);
        assertThat(page.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(SERVICE_ID);
        assertThat(page.getRecords().get(0).getIsAvailable()).isFalse();
        verify(scheduleService, never()).createTemporaryHold(any(), any(), any());
    }

    @Test
    void paidServicePackageOrderMarksServiceOfflineAndRemovesItFromDefaultHall() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, false);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> invocation.getArgument(0));

        servicePackageService.handleOrderPaid(new OrderPaidEvent(servicePackageOrder()));

        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.OFFLINE);
        assertThat(servicePackage.getIsAvailable()).isFalse();
        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE)).thenReturn(List.of(servicePackage));
        PageResult<ServicePackageCardDto> page =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);
        assertThat(page.getRecords()).isEmpty();
    }

    private CurrentUser customer() {
        return new CurrentUser(CUSTOMER_ID, UserRole.CUSTOMER);
    }

    private CurrentUser provider() {
        return new CurrentUser(PROVIDER_ID, UserRole.PROVIDER);
    }

    private CreateServicePackageRequest createRequest() {
        CreateServicePackageRequest request = new CreateServicePackageRequest();
        request.setTitle("Graduation portrait package");
        request.setCityCode("NJ");
        request.setServiceArea("NJU campus");
        request.setScene("GRADUATION");
        request.setStyleTags(List.of("Natural", "Campus"));
        request.setBasePriceCent(39900L);
        request.setDurationMinutes(120);
        request.setOriginalCount(30);
        request.setRefinedCount(9);
        request.setDeliveryDays(7);
        request.setAvailableDates(List.of(LocalDate.of(2026, 6, 1)));
        request.setPortfolioIds(List.of(11L, 12L));
        request.setDescription("Outdoor graduation portraits.");
        return request;
    }

    private ReserveServicePackageRequest reserveRequest(String message) {
        ReserveServicePackageRequest request = new ReserveServicePackageRequest();
        request.setSelectedDate(LocalDate.of(2026, 6, 1));
        request.setInitialMessage(message);
        return request;
    }

    private ServicePackage servicePackage(Long id, ServicePackageStatus status, Boolean isAvailable) {
        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setId(id);
        servicePackage.setProviderId(PROVIDER_ID);
        servicePackage.setTitle("Graduation portrait package");
        servicePackage.setCityCode("NJ");
        servicePackage.setServiceArea("NJU campus");
        servicePackage.setScene("GRADUATION");
        servicePackage.setStyleTags(List.of("natural", "campus"));
        servicePackage.setBasePriceCent(39900L);
        servicePackage.setDurationMinutes(120);
        servicePackage.setOriginalCount(30);
        servicePackage.setRefinedCount(9);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of(LocalDate.of(2026, 6, 1)));
        servicePackage.setPortfolioIds(List.of(11L, 12L));
        servicePackage.setDescription("Outdoor graduation portraits.");
        servicePackage.setStatus(status);
        servicePackage.setIsAvailable(isAvailable);
        LocalDateTime timestamp = LocalDateTime.of(2026, 6, 1, 10, 0).plusMinutes(id);
        servicePackage.setCreatedAt(timestamp);
        servicePackage.setUpdatedAt(timestamp);
        return servicePackage;
    }

    private Order servicePackageOrder() {
        Order order = new Order();
        order.setId(8101L);
        order.setSourceType(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        order.setSourceId(SERVICE_ID);
        order.setServicePackageId(SERVICE_ID);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        return order;
    }
}
