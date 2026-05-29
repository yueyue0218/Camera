package com.action.camera.photoauthorization.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.delivery.repository.DeliveryFileRepository;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.enums.OrderStatus;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationRequest;
import com.action.camera.photoauthorization.dto.PhotoAuthorizationResponse;
import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationFileRepository;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PhotoAuthorizationService {

    private static final int MAX_REMARK_LENGTH = 500;

    private final OrderRepository orderRepository;
    private final DeliveryRepository deliveryRepository;
    private final DeliveryFileRepository deliveryFileRepository;
    private final PhotoAuthorizationRepository photoAuthorizationRepository;
    private final PhotoAuthorizationFileRepository photoAuthorizationFileRepository;

    @Transactional
    public PhotoAuthorizationResponse requestAuthorization(
            Long orderId,
            Long operatorId,
            PhotoAuthorizationRequest request
    ) {
        Order order = getOrder(orderId);
        ensureProvider(order, operatorId);
        ensureCompleted(order);

        LinkedHashSet<Long> requestedFileIds = normalizeFileIds(request);
        String remark = normalizeRemark(request == null ? null : request.getRemark());
        Map<Long, DeliveryFile> deliveryFiles = findOrderDeliveryFiles(orderId, requestedFileIds);
        ensureNoExistingAuthorization(orderId, requestedFileIds);

        PhotoAuthorization authorization = new PhotoAuthorization();
        authorization.setOrderId(orderId);
        authorization.setCustomerId(order.getCustomerId());
        authorization.setProviderUserId(order.getProviderUserId());
        authorization.setPhotoUsageScope(PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY);
        authorization.setStatus(PhotoAuthorization.STATUS_PENDING);
        authorization.setRemark(remark);
        PhotoAuthorization savedAuthorization = photoAuthorizationRepository.save(authorization);

        List<PhotoAuthorizationFile> savedFiles = new ArrayList<>();
        int sortOrder = 0;
        for (Long fileId : requestedFileIds) {
            PhotoAuthorizationFile authorizationFile = new PhotoAuthorizationFile();
            authorizationFile.setAuthorizationId(savedAuthorization.getId());
            authorizationFile.setFileId(deliveryFiles.get(fileId).getFileId());
            authorizationFile.setSortOrder(sortOrder++);
            savedFiles.add(photoAuthorizationFileRepository.save(authorizationFile));
        }

        return PhotoAuthorizationResponse.from(savedAuthorization, savedFiles);
    }

    @Transactional
    public PhotoAuthorizationResponse approve(Long authorizationId, Long operatorId, String remark) {
        PhotoAuthorization authorization = getAuthorization(authorizationId);
        Order order = getOrder(authorization.getOrderId());
        ensureCustomer(order, operatorId);
        ensurePending(authorization);

        authorization.setStatus(PhotoAuthorization.STATUS_GRANTED);
        authorization.setRemark(normalizeRemark(remark));
        authorization.setAuthorizedAt(LocalDateTime.now());
        PhotoAuthorization savedAuthorization = photoAuthorizationRepository.save(authorization);
        return PhotoAuthorizationResponse.from(savedAuthorization, findFilesByAuthorizationIds(List.of(authorizationId)));
    }

    @Transactional
    public PhotoAuthorizationResponse reject(Long authorizationId, Long operatorId, String remark) {
        PhotoAuthorization authorization = getAuthorization(authorizationId);
        Order order = getOrder(authorization.getOrderId());
        ensureCustomer(order, operatorId);
        ensurePending(authorization);

        authorization.setStatus(PhotoAuthorization.STATUS_REJECTED);
        authorization.setRemark(normalizeRemark(remark));
        PhotoAuthorization savedAuthorization = photoAuthorizationRepository.save(authorization);
        return PhotoAuthorizationResponse.from(savedAuthorization, findFilesByAuthorizationIds(List.of(authorizationId)));
    }

    @Transactional(readOnly = true)
    public List<PhotoAuthorizationResponse> listOrderAuthorizations(Long orderId, Long operatorId) {
        Order order = getOrder(orderId);
        if (!Objects.equals(order.getCustomerId(), operatorId)
                && !Objects.equals(order.getProviderUserId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only order participants can view photo authorizations");
        }
        return mapResponses(photoAuthorizationRepository.findByOrderIdOrderByAuthorizedAtDesc(orderId));
    }

    @Transactional(readOnly = true)
    public List<PhotoAuthorizationResponse> listProviderAuthorizations(Long providerUserId) {
        return mapResponses(photoAuthorizationRepository.findByProviderUserIdAndStatusOrderByAuthorizedAtDesc(
                providerUserId,
                PhotoAuthorization.STATUS_GRANTED
        ));
    }

    private Order getOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));
    }

    private PhotoAuthorization getAuthorization(Long authorizationId) {
        return photoAuthorizationRepository.findById(authorizationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Photo authorization not found"));
    }

    private void ensureCustomer(Order order, Long operatorId) {
        if (!Objects.equals(order.getCustomerId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only customer can approve or reject photo authorization");
        }
    }

    private void ensureProvider(Order order, Long operatorId) {
        if (!Objects.equals(order.getProviderUserId(), operatorId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Only provider can request photo authorization");
        }
    }

    private void ensureCompleted(Order order) {
        if (order.getStatus() != OrderStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Photo authorization is only allowed for completed orders");
        }
    }

    private void ensurePending(PhotoAuthorization authorization) {
        if (!PhotoAuthorization.STATUS_PENDING.equals(authorization.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT,
                    "Only pending photo authorization can be approved or rejected");
        }
    }

    private LinkedHashSet<Long> normalizeFileIds(PhotoAuthorizationRequest request) {
        if (request == null || request.getFileIds() == null || request.getFileIds().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "fileIds must not be empty");
        }
        LinkedHashSet<Long> fileIds = new LinkedHashSet<>();
        for (Long fileId : request.getFileIds()) {
            if (fileId == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "fileIds must not contain null");
            }
            if (!fileIds.add(fileId)) {
                throw new BusinessException(ErrorCode.DUPLICATE_OPERATION, "Duplicate fileId in request");
            }
        }
        return fileIds;
    }

    private String normalizeRemark(String remark) {
        if (remark == null) {
            return null;
        }
        String normalized = remark.trim();
        if (normalized.length() > MAX_REMARK_LENGTH) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "remark length must not exceed 500");
        }
        return normalized.isEmpty() ? null : normalized;
    }

    private Map<Long, DeliveryFile> findOrderDeliveryFiles(Long orderId, Set<Long> requestedFileIds) {
        List<Delivery> deliveries = deliveryRepository.findByOrderIdOrderByUploadTimeDesc(orderId);
        if (deliveries.isEmpty()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Completed order has no delivery files");
        }
        List<Long> deliveryIds = deliveries.stream()
                .map(Delivery::getId)
                .filter(Objects::nonNull)
                .toList();
        if (deliveryIds.isEmpty()) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "Completed order has no delivery files");
        }
        Map<Long, DeliveryFile> files = deliveryFileRepository
                .findByDeliveryIdInAndFileIdIn(deliveryIds, requestedFileIds)
                .stream()
                .collect(Collectors.toMap(
                        DeliveryFile::getFileId,
                        Function.identity(),
                        (first, ignored) -> first
                ));
        if (!files.keySet().containsAll(requestedFileIds)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Only delivery files of this order can be authorized");
        }
        return files;
    }

    private void ensureNoExistingAuthorization(Long orderId, Collection<Long> requestedFileIds) {
        List<PhotoAuthorizationFile> existingFiles = photoAuthorizationFileRepository.findByFileIdIn(requestedFileIds);
        if (existingFiles.isEmpty()) {
            return;
        }
        Set<Long> authorizationIds = existingFiles.stream()
                .map(PhotoAuthorizationFile::getAuthorizationId)
                .collect(Collectors.toSet());
        Map<Long, PhotoAuthorization> authorizations = photoAuthorizationRepository.findAllById(authorizationIds)
                .stream()
                .collect(Collectors.toMap(PhotoAuthorization::getId, Function.identity()));
        Set<Long> duplicateFileIds = new HashSet<>();
        for (PhotoAuthorizationFile file : existingFiles) {
            PhotoAuthorization authorization = authorizations.get(file.getAuthorizationId());
            if (authorization != null
                    && Objects.equals(authorization.getOrderId(), orderId)) {
                duplicateFileIds.add(file.getFileId());
            }
        }
        if (!duplicateFileIds.isEmpty()) {
            throw new BusinessException(ErrorCode.DUPLICATE_OPERATION,
                    "Photo authorization already exists for fileIds: " + duplicateFileIds);
        }
    }

    private List<PhotoAuthorizationFile> findFilesByAuthorizationIds(List<Long> authorizationIds) {
        return photoAuthorizationFileRepository.findByAuthorizationIdIn(authorizationIds)
                .stream()
                .sorted(Comparator.comparing(PhotoAuthorizationFile::getSortOrder))
                .toList();
    }

    private List<PhotoAuthorizationResponse> mapResponses(List<PhotoAuthorization> authorizations) {
        if (authorizations.isEmpty()) {
            return List.of();
        }
        List<Long> authorizationIds = authorizations.stream()
                .map(PhotoAuthorization::getId)
                .toList();
        Map<Long, List<PhotoAuthorizationFile>> filesByAuthorizationId =
                findFilesByAuthorizationIds(authorizationIds)
                        .stream()
                        .collect(Collectors.groupingBy(PhotoAuthorizationFile::getAuthorizationId, HashMap::new,
                                Collectors.toList()));
        return authorizations.stream()
                .map(authorization -> PhotoAuthorizationResponse.from(
                        authorization,
                        filesByAuthorizationId.getOrDefault(authorization.getId(), List.of())
                ))
                .toList();
    }
}
