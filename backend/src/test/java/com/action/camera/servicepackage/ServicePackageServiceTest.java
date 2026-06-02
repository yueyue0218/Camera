package com.action.camera.servicepackage;

import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.domain.User;
import com.action.camera.message.model.CreateConversationCommand;
import com.action.camera.message.model.CreateConversationResult;
import com.action.camera.message.service.ConversationService;
import com.action.camera.repository.FileRepository;
import com.action.camera.repository.UserRepository;
import com.action.camera.servicepackage.domain.ServicePackage;
import com.action.camera.servicepackage.domain.ServicePackageInterest;
import com.action.camera.servicepackage.domain.ServicePackageStatus;
import com.action.camera.servicepackage.dto.CreateServicePackageRequest;
import com.action.camera.servicepackage.dto.CreateServicePackageResult;
import com.action.camera.servicepackage.dto.ServicePackageCardDto;
import com.action.camera.servicepackage.dto.ServicePackageInterestDto;
import com.action.camera.servicepackage.dto.StartServicePackageChatRequest;
import com.action.camera.servicepackage.dto.StartServicePackageChatResult;
import com.action.camera.servicepackage.dto.UpdateServicePackageRequest;
import com.action.camera.servicepackage.repository.ServicePackageInterestRepository;
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
    private static final LocalDate AVAILABLE_DATE = LocalDate.of(2026, 7, 1);

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private ServicePackageInterestRepository interestRepository;

    @Mock
    private ConversationService conversationService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private FileRepository fileRepository;

    private ServicePackageService servicePackageService;

    @BeforeEach
    void setUp() {
        servicePackageService = new ServicePackageService(
                servicePackageRepository,
                interestRepository,
                conversationService,
                userRepository,
                fileRepository
        );
    }

    @Test
    void providerPublishesServicePackageWithRequiredTimeFields() {
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> {
            ServicePackage servicePackage = invocation.getArgument(0);
            servicePackage.setId(SERVICE_ID);
            return servicePackage;
        });

        CreateServicePackageResult result =
                servicePackageService.createServicePackage(provider(), createRequest());

        assertThat(result.getServiceId()).isEqualTo(SERVICE_ID);
        assertThat(result.getStatus()).isEqualTo(ServicePackageStatus.ONLINE.name());

        ArgumentCaptor<ServicePackage> captor = ArgumentCaptor.forClass(ServicePackage.class);
        verify(servicePackageRepository).save(captor.capture());
        ServicePackage saved = captor.getValue();
        assertThat(saved.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(saved.getImages()).containsExactly("https://cdn.example/cover.jpg", "https://cdn.example/detail.jpg");
        assertThat(saved.getPriceRange()).isEqualTo("399-599");
        assertThat(saved.getTimeDescription()).isEqualTo("七月上旬周末可约");
        assertThat(saved.getTimeTags()).containsExactly("NEAR_7_DAYS");
    }

    @Test
    void publishRejectsMissingTimeDescription() {
        CreateServicePackageRequest request = createRequest();
        request.setTimeDescription(" ");

        assertThatThrownBy(() -> servicePackageService.createServicePackage(provider(), request))
                .isInstanceOf(BusinessException.class);

        verify(servicePackageRepository, never()).save(any());
    }

    @Test
    void hallFiltersByTimeTagAndOmitsUntaggedPackagesOnlyWhenFilterIsUsed() {
        ServicePackage nearSeven = servicePackage(1L, ServicePackageStatus.ONLINE, true);
        nearSeven.setTimeTags(List.of("NEAR_7_DAYS"));
        ServicePackage untagged = servicePackage(2L, ServicePackageStatus.ONLINE, true);
        untagged.setTimeTags(List.of());
        when(servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE))
                .thenReturn(List.of(nearSeven, untagged))
                .thenReturn(List.of(nearSeven, untagged));
        when(userRepository.findById(PROVIDER_ID)).thenReturn(Optional.of(providerUser()));

        PageResult<ServicePackageCardDto> ordinary =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null, null);
        PageResult<ServicePackageCardDto> filtered =
                servicePackageService.listServices(1, 10, null, null, null, null, null, null,
                        "NEAR_7_DAYS", null);

        assertThat(ordinary.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(2L, 1L);
        assertThat(filtered.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(1L);
        assertThat(filtered.getRecords().get(0).getCoverImage()).isEqualTo("https://cdn.example/cover.jpg");
        assertThat(filtered.getRecords().get(0).getPhotographerNickname()).isEqualTo("Photographer Lin");
    }

    @Test
    void photographerUpdatesAndOfflinesOwnPackage() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        when(servicePackageRepository.findByIdAndProviderId(SERVICE_ID, PROVIDER_ID))
                .thenReturn(Optional.of(servicePackage));
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userRepository.findById(PROVIDER_ID)).thenReturn(Optional.of(providerUser()));

        UpdateServicePackageRequest update = new UpdateServicePackageRequest();
        update.setTitle("Updated showcase");
        update.setTimeTags(List.of("near_3_days", "NEAR_1_MONTH"));
        servicePackageService.updateServicePackage(SERVICE_ID, provider(), update);
        servicePackageService.offlineServicePackage(SERVICE_ID, provider());

        assertThat(servicePackage.getTitle()).isEqualTo("Updated showcase");
        assertThat(servicePackage.getTimeTags()).containsExactly("NEAR_3_DAYS", "NEAR_1_MONTH");
        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.OFFLINE);
    }

    @Test
    void customerInterestIsIdempotentAndCannotTargetOwnPackage() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        ServicePackageInterest existing = interest(CUSTOMER_ID, SERVICE_ID);
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        when(interestRepository.findByUserIdAndServicePackageId(CUSTOMER_ID, SERVICE_ID))
                .thenReturn(Optional.of(existing));

        ServicePackageInterestDto result = servicePackageService.addInterest(SERVICE_ID, customer());

        assertThat(result.getInterestId()).isEqualTo(existing.getId());
        verify(interestRepository, never()).save(any());

        assertThatThrownBy(() -> servicePackageService.addInterest(SERVICE_ID, new CurrentUser(PROVIDER_ID, UserRole.CUSTOMER)))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void myInterestListSupportsTimeTagFilter() {
        ServicePackage matching = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        matching.setTimeTags(List.of("NEAR_3_DAYS"));
        ServicePackage untagged = servicePackage(9202L, ServicePackageStatus.ONLINE, true);
        untagged.setTimeTags(List.of());
        when(interestRepository.findByUserIdOrderByCreatedAtDesc(CUSTOMER_ID))
                .thenReturn(List.of(interest(CUSTOMER_ID, SERVICE_ID), interest(CUSTOMER_ID, 9202L)));
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(matching));
        when(servicePackageRepository.findById(9202L)).thenReturn(Optional.of(untagged));
        when(userRepository.findById(PROVIDER_ID)).thenReturn(Optional.of(providerUser()));

        PageResult<ServicePackageCardDto> result =
                servicePackageService.listMyInterests(customer(), 1, 10, "NEAR_3_DAYS");

        assertThat(result.getRecords()).extracting(ServicePackageCardDto::getServiceId)
                .containsExactly(SERVICE_ID);
    }

    @Test
    void startChatCreatesOrGetsConversationWithoutChangingPackageStatusOrAvailability() {
        ServicePackage servicePackage = servicePackage(SERVICE_ID, ServicePackageStatus.ONLINE, true);
        StartServicePackageChatRequest request = new StartServicePackageChatRequest();
        request.setInitialMessage("现在想聊一下这组橱窗");
        when(servicePackageRepository.findById(SERVICE_ID)).thenReturn(Optional.of(servicePackage));
        when(conversationService.createConversationWithInitialMessage(any(CreateConversationCommand.class)))
                .thenReturn(new CreateConversationResult(CONVERSATION_ID));

        StartServicePackageChatResult result = servicePackageService.startChat(SERVICE_ID, customer(), request);

        assertThat(result.getConversationId()).isEqualTo(CONVERSATION_ID);
        assertThat(servicePackage.getStatus()).isEqualTo(ServicePackageStatus.ONLINE);
        assertThat(servicePackage.getIsAvailable()).isTrue();

        ArgumentCaptor<CreateConversationCommand> commandCaptor =
                ArgumentCaptor.forClass(CreateConversationCommand.class);
        verify(conversationService).createConversationWithInitialMessage(commandCaptor.capture());
        assertThat(commandCaptor.getValue().getSourceType()).isEqualTo(ConversationService.SOURCE_TYPE_SERVICE_PACKAGE);
        assertThat(commandCaptor.getValue().getSourceId()).isEqualTo(SERVICE_ID);
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
        request.setImages(List.of("https://cdn.example/cover.jpg", "https://cdn.example/detail.jpg"));
        request.setBasePriceCent(39900L);
        request.setPriceRange("399-599");
        request.setDurationMinutes(120);
        request.setOriginalCount(30);
        request.setRefinedCount(9);
        request.setDeliveryDays(7);
        request.setAvailableDates(List.of(AVAILABLE_DATE));
        request.setPortfolioIds(List.of(11L, 12L));
        request.setDescription("Outdoor graduation portraits.");
        request.setTimeDescription("七月上旬周末可约");
        request.setTimeTags(List.of("near_7_days"));
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
        servicePackage.setImages(List.of("https://cdn.example/cover.jpg", "https://cdn.example/detail.jpg"));
        servicePackage.setBasePriceCent(39900L);
        servicePackage.setPriceRange("399-599");
        servicePackage.setDurationMinutes(120);
        servicePackage.setOriginalCount(30);
        servicePackage.setRefinedCount(9);
        servicePackage.setDeliveryDays(7);
        servicePackage.setAvailableDates(List.of(AVAILABLE_DATE));
        servicePackage.setPortfolioIds(List.of(11L, 12L));
        servicePackage.setDescription("Outdoor graduation portraits.");
        servicePackage.setTimeDescription("七月上旬周末可约");
        servicePackage.setTimeTags(List.of("NEAR_7_DAYS"));
        servicePackage.setStatus(status);
        servicePackage.setIsAvailable(isAvailable);
        LocalDateTime timestamp = LocalDateTime.of(2026, 6, 1, 10, 0).plusMinutes(id);
        servicePackage.setCreatedAt(timestamp);
        servicePackage.setUpdatedAt(timestamp);
        return servicePackage;
    }

    private ServicePackageInterest interest(Long userId, Long serviceId) {
        ServicePackageInterest interest = new ServicePackageInterest();
        interest.setId(userId + serviceId);
        interest.setUserId(userId);
        interest.setServicePackageId(serviceId);
        interest.setCreatedAt(LocalDateTime.of(2026, 6, 3, 10, 0));
        return interest;
    }

    private User providerUser() {
        User user = new User();
        user.setId(PROVIDER_ID);
        user.setNickname("Photographer Lin");
        user.setCurrentRole("PROVIDER");
        return user;
    }
}
