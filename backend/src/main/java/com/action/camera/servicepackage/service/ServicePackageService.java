package com.action.camera.servicepackage.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.page.PageResult;
import com.action.camera.common.security.CurrentUser;
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
import com.action.camera.servicepackage.mapper.ServicePackageMapper;
import com.action.camera.servicepackage.repository.ServicePackageRepository;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class ServicePackageService {

    private static final int MAX_PAGE_SIZE = 50;
    private static final String DEFAULT_RESERVE_MESSAGE = "I would like to reserve this service package.";

    private final ServicePackageRepository servicePackageRepository;
    private final ScheduleService scheduleService;
    private final ConversationService conversationService;

    public ServicePackageService(ServicePackageRepository servicePackageRepository,
                                 ScheduleService scheduleService,
                                 ConversationService conversationService) {
        this.servicePackageRepository = servicePackageRepository;
        this.scheduleService = scheduleService;
        this.conversationService = conversationService;
    }

    @Transactional
    public CreateServicePackageResult createServicePackage(CurrentUser currentUser,
                                                           CreateServicePackageRequest request) {
        ensureProvider(currentUser);
        validateCreateRequest(request);

        ServicePackage servicePackage = new ServicePackage();
        servicePackage.setProviderId(currentUser.getUserId());
        servicePackage.setTitle(trim(request.getTitle()));
        servicePackage.setCityCode(trim(request.getCityCode()));
        servicePackage.setServiceArea(trimToNull(request.getServiceArea()));
        servicePackage.setScene(trim(request.getScene()));
        servicePackage.setStyleTags(normalizeTags(request.getStyleTags()));
        servicePackage.setBasePriceCent(request.getBasePriceCent());
        servicePackage.setDurationMinutes(request.getDurationMinutes());
        servicePackage.setOriginalCount(request.getOriginalCount());
        servicePackage.setRefinedCount(request.getRefinedCount());
        servicePackage.setDeliveryDays(request.getDeliveryDays());
        servicePackage.setAvailableDates(normalizeDates(request.getAvailableDates()));
        servicePackage.setPortfolioIds(normalizeIds(request.getPortfolioIds()));
        servicePackage.setDescription(trimToNull(request.getDescription()));
        servicePackage.setStatus(ServicePackageStatus.ONLINE);
        servicePackage.setIsAvailable(true);

        return ServicePackageMapper.toCreateResult(servicePackageRepository.save(servicePackage));
    }

    @Transactional(readOnly = true)
    public PageResult<ServicePackageCardDto> listServices(int page,
                                                          int size,
                                                          String cityCode,
                                                          String scene,
                                                          String style,
                                                          Long minPriceCent,
                                                          Long maxPriceCent,
                                                          LocalDate availableDate,
                                                          String sort) {
        int safePage = Math.max(page, 1);
        int safeSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        String normalizedCity = normalizeFilter(cityCode);
        String normalizedScene = normalizeFilter(scene);
        String normalizedStyle = normalizeFilter(style);

        List<ServicePackageCardDto> filtered = servicePackageRepository.findByStatus(ServicePackageStatus.ONLINE)
                .stream()
                .filter(servicePackage -> servicePackage.getStatus() == ServicePackageStatus.ONLINE)
                .filter(servicePackage -> normalizedCity == null
                        || servicePackage.getCityCode().equalsIgnoreCase(normalizedCity))
                .filter(servicePackage -> normalizedScene == null
                        || servicePackage.getScene().equalsIgnoreCase(normalizedScene))
                .filter(servicePackage -> normalizedStyle == null
                        || servicePackage.getStyleTags().contains(normalizedStyle))
                .filter(servicePackage -> matchesPrice(servicePackage, minPriceCent, maxPriceCent))
                .filter(servicePackage -> availableDate == null
                        || servicePackage.getAvailableDates().contains(availableDate))
                .sorted(resolveSort(sort))
                .map(ServicePackageMapper::toCard)
                .toList();

        int fromIndex = Math.min((safePage - 1) * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());
        return new PageResult<>(filtered.subList(fromIndex, toIndex), safePage, safeSize, filtered.size());
    }

    @Transactional(readOnly = true)
    public ServicePackageDetailDto getServiceDetail(Long serviceId) {
        ServicePackage servicePackage = getServicePackage(serviceId);
        if (servicePackage.getStatus() == ServicePackageStatus.OFFLINE) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Service package is offline");
        }
        return ServicePackageMapper.toDetail(servicePackage);
    }

    @Transactional
    public ReserveServicePackageResult reserveServicePackage(Long serviceId,
                                                             CurrentUser currentUser,
                                                             ReserveServicePackageRequest request) {
        ensureCustomer(currentUser);
        validateReserveRequest(request);
        ServicePackage servicePackage = getServicePackage(serviceId);
        if (servicePackage.getStatus() != ServicePackageStatus.ONLINE) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Service package is not online");
        }
        if (!Boolean.TRUE.equals(servicePackage.getIsAvailable())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Service package is not available for reservation");
        }
        if (!servicePackage.getAvailableDates().contains(request.getSelectedDate())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Selected date is not available");
        }

        Long scheduleHoldId = scheduleService.createTemporaryHold(
                servicePackage.getProviderId(),
                servicePackage.getId(),
                request.getSelectedDate()
        );
        servicePackage.markReserved(scheduleHoldId);
        ServicePackage saved = servicePackageRepository.save(servicePackage);

        CreateConversationResult conversation = conversationService.createConversationWithInitialMessage(
                new CreateConversationCommand(
                        currentUser.getUserId(),
                        saved.getProviderId(),
                        currentUser.getUserId(),
                        ConversationService.SOURCE_TYPE_SERVICE_PACKAGE,
                        saved.getId(),
                        initialMessage(request.getInitialMessage())
                )
        );
        return new ReserveServicePackageResult(
                saved.getId(),
                conversation.getConversationId(),
                scheduleHoldId,
                saved.getStatus().name(),
                saved.getIsAvailable()
        );
    }

    @EventListener
    @Transactional
    public void handleOrderPaid(OrderPaidEvent event) {
        Order order = event.order();
        if (order == null || order.getServicePackageId() == null
                || !ConversationService.SOURCE_TYPE_SERVICE_PACKAGE.equals(order.getSourceType())) {
            return;
        }
        servicePackageRepository.findById(order.getServicePackageId()).ifPresent(servicePackage -> {
            servicePackage.markOffline();
            servicePackageRepository.save(servicePackage);
        });
    }

    private ServicePackage getServicePackage(Long serviceId) {
        if (serviceId == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "serviceId must not be null");
        }
        return servicePackageRepository.findById(serviceId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND,
                        "Service package not found: " + serviceId));
    }

    private void validateCreateRequest(CreateServicePackageRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        requireText(request.getTitle(), "title must not be blank");
        requireText(request.getCityCode(), "cityCode must not be blank");
        requireText(request.getScene(), "scene must not be blank");
        requirePositive(request.getBasePriceCent(), "basePriceCent must be positive");
        requirePositive(request.getDurationMinutes(), "durationMinutes must be positive");
        requireNonNegative(request.getOriginalCount(), "originalCount must not be negative");
        requireNonNegative(request.getRefinedCount(), "refinedCount must not be negative");
        requirePositive(request.getDeliveryDays(), "deliveryDays must be positive");
    }

    private void validateReserveRequest(ReserveServicePackageRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "request must not be null");
        }
        if (request.getSelectedDate() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "selectedDate must not be null");
        }
    }

    private void ensureProvider(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current user is required");
        }
        if (!currentUser.isProvider()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only provider can publish service packages");
        }
    }

    private void ensureCustomer(CurrentUser currentUser) {
        if (currentUser == null || currentUser.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Current user is required");
        }
        if (!currentUser.isCustomer()) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only customer can reserve service packages");
        }
    }

    private void requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void requirePositive(Long value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void requirePositive(Integer value, String message) {
        if (value == null || value <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private void requireNonNegative(Integer value, String message) {
        if (value == null || value < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private boolean matchesPrice(ServicePackage servicePackage, Long minPriceCent, Long maxPriceCent) {
        Long price = servicePackage.getBasePriceCent();
        if (minPriceCent != null && price < minPriceCent) {
            return false;
        }
        return maxPriceCent == null || price <= maxPriceCent;
    }

    private Comparator<ServicePackage> resolveSort(String sort) {
        if ("price_asc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getBasePriceCent);
        }
        if ("price_desc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getBasePriceCent).reversed();
        }
        if ("created_asc".equalsIgnoreCase(sort)) {
            return Comparator.comparing(ServicePackage::getCreatedAt,
                    Comparator.nullsLast(Comparator.naturalOrder()));
        }
        return Comparator.comparing(ServicePackage::getCreatedAt,
                Comparator.nullsLast(Comparator.naturalOrder())).reversed();
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) {
            return List.of();
        }
        return tags.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .map(value -> value.toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private List<LocalDate> normalizeDates(List<LocalDate> dates) {
        if (dates == null) {
            return List.of();
        }
        return dates.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
    }

    private List<Long> normalizeIds(List<Long> ids) {
        if (ids == null) {
            return List.of();
        }
        return ids.stream()
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private String normalizeFilter(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private String initialMessage(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? DEFAULT_RESERVE_MESSAGE : normalized;
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
