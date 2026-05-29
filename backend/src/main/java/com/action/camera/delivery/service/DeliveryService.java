package com.action.camera.delivery.service;

import com.action.camera.application.FileService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.dto.DeliveryResponse;
import com.action.camera.delivery.dto.DeliveryUploadResponse;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.delivery.port.OrderStatusPort;
import com.action.camera.delivery.repository.DeliveryFileRepository;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.domain.FileRecord;
import com.action.camera.dto.FileUploadResponse;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.service.NotificationService;
import com.action.camera.repository.FileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DeliveryService {

    private static final String PENDING_DELIVERY = "PENDING_DELIVERY";
    private static final String DELIVERED_PENDING_CONFIRM = "DELIVERED_PENDING_CONFIRM";
    private static final String DELIVERY_UPLOADED = "UPLOADED";
    private static final String DELIVERY_BIZ_TYPE = "DELIVERY";
    private static final String PRIVATE_VISIBILITY = "PRIVATE";
    private static final String RETOUCHED_FILE_TYPE = "RETOUCHED";

    private final DeliveryRepository deliveryRepository;
    private final DeliveryFileRepository deliveryFileRepository;
    private final FileService fileService;
    private final FileRepository fileRepository;
    private final OrderQueryPort orderQueryPort;
    private final OrderStatusPort orderStatusPort;

    @Autowired(required = false)
    private NotificationService notificationService;

    public DeliveryService(DeliveryRepository deliveryRepository,
                           DeliveryFileRepository deliveryFileRepository,
                           FileService fileService,
                           FileRepository fileRepository,
                           OrderQueryPort orderQueryPort,
                           OrderStatusPort orderStatusPort) {
        this.deliveryRepository = deliveryRepository;
        this.deliveryFileRepository = deliveryFileRepository;
        this.fileService = fileService;
        this.fileRepository = fileRepository;
        this.orderQueryPort = orderQueryPort;
        this.orderStatusPort = orderStatusPort;
    }

    @Transactional
    public DeliveryUploadResponse upload(Long orderId, MultipartFile file, String remark) {
        Long currentUserId = requireCurrentUserId();
        OrderSnapshot order = orderQueryPort.getOrderSnapshot(orderId);
        if (!currentUserId.equals(order.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单服务方可以上传交付文件");
        }
        if (!PENDING_DELIVERY.equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "订单当前状态不允许上传交付文件");
        }

        FileUploadResponse uploadedFile = fileService.upload(
                file,
                currentUserId,
                DELIVERY_BIZ_TYPE,
                PRIVATE_VISIBILITY
        );
        LocalDateTime now = LocalDateTime.now();
        Delivery delivery = new Delivery();
        delivery.setOrderId(orderId);
        delivery.setDeliveryRound(1);
        delivery.setIsLatest(true);
        delivery.setOriginalCount(0);
        delivery.setRefinedCount(1);
        delivery.setDeadline(order.getDeliveryDeadline());
        delivery.setStatus(DELIVERY_UPLOADED);
        delivery.setRemark(remark);
        delivery.setUploadTime(now);
        delivery.setAutoConfirmDeadline(now.plusDays(7));
        Delivery saved = deliveryRepository.save(delivery);

        DeliveryFile deliveryFile = new DeliveryFile();
        deliveryFile.setDeliveryId(saved.getId());
        deliveryFile.setFileId(uploadedFile.getFileId());
        deliveryFile.setFileType(RETOUCHED_FILE_TYPE);
        deliveryFile.setSortOrder(0);
        deliveryFile.setUploadTime(now);
        deliveryFileRepository.save(deliveryFile);

        String orderStatus = orderStatusPort.changeStatus(
                orderId,
                DELIVERED_PENDING_CONFIRM,
                currentUserId,
                "服务方上传交付文件"
        );

        notifyDeliveryUploaded(order);

        return new DeliveryUploadResponse(
                saved.getId(),
                saved.getOrderId(),
                saved.getDeliveryRound(),
                uploadedFile.getFileId(),
                uploadedFile.getOriginalName(),
                currentUserId,
                saved.getUploadTime(),
                orderStatus
        );
    }

    @Transactional(readOnly = true)
    public List<DeliveryResponse> listByOrder(Long orderId) {
        Long currentUserId = requireCurrentUserId();
        OrderSnapshot order = orderQueryPort.getOrderSnapshot(orderId);
        if (!currentUserId.equals(order.getCustomerId()) && !currentUserId.equals(order.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单双方可以查看交付记录");
        }
        return deliveryRepository.findByOrderIdOrderByUploadTimeDesc(orderId).stream()
                .map(this::toResponse)
                .toList();
    }

    private DeliveryResponse toResponse(Delivery delivery) {
        return new DeliveryResponse(
                delivery.getId(),
                delivery.getOrderId(),
                delivery.getDeliveryRound(),
                delivery.getIsLatest(),
                delivery.getOriginalCount(),
                delivery.getRefinedCount(),
                fileIdOf(delivery),
                fileNameOf(delivery),
                delivery.getStatus(),
                delivery.getRemark(),
                delivery.getUploadTime()
        );
    }

    private Long fileIdOf(Delivery delivery) {
        return deliveryFileRepository.findFirstByDeliveryIdOrderBySortOrderAsc(delivery.getId())
                .map(DeliveryFile::getFileId)
                .orElse(null);
    }

    private String fileNameOf(Delivery delivery) {
        return deliveryFileRepository.findFirstByDeliveryIdOrderBySortOrderAsc(delivery.getId())
                .map(DeliveryFile::getFileId)
                .flatMap(fileRepository::findById)
                .map(FileRecord::getOriginalName)
                .orElse(null);
    }

    private Long requireCurrentUserId() {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return currentUserId;
    }

    private void notifyDeliveryUploaded(OrderSnapshot order) {
        if (notificationService == null) {
            return;
        }
        notificationService.createNotification(new NotificationCreateRequest(
                order.getCustomerId(),
                "Delivery uploaded",
                "The provider has uploaded delivery files for your order.",
                "DELIVERY_UPLOADED",
                "ORDER",
                order.getOrderId()
        ));
    }
}
