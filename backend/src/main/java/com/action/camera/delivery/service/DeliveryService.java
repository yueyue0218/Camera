package com.action.camera.delivery.service;

import com.action.camera.application.FileService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
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
import com.action.camera.order.entity.Order;
import com.action.camera.order.service.OrderService;
import com.action.camera.repository.FileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class DeliveryService {

    private static final String PENDING_DELIVERY = "PENDING_DELIVERY";
    private static final String DELIVERED_PENDING_CONFIRM = "DELIVERED_PENDING_CONFIRM";
    private static final String REWORK_REQUIRED = "REWORK_REQUIRED";
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
    private final OrderService orderService;
    private final TransactionTemplate txTemplate;

    @Autowired(required = false)
    private NotificationService notificationService;

    public DeliveryService(DeliveryRepository deliveryRepository,
                           DeliveryFileRepository deliveryFileRepository,
                           FileService fileService,
                           FileRepository fileRepository,
                           OrderQueryPort orderQueryPort,
                           OrderStatusPort orderStatusPort,
                           OrderService orderService,
                           TransactionTemplate txTemplate) {
        this.deliveryRepository = deliveryRepository;
        this.deliveryFileRepository = deliveryFileRepository;
        this.fileService = fileService;
        this.fileRepository = fileRepository;
        this.orderQueryPort = orderQueryPort;
        this.orderStatusPort = orderStatusPort;
        this.orderService = orderService;
        this.txTemplate = txTemplate;
    }

    // 注意：此方法不加 @Transactional。
    // 原因：upload() 内部会通过 COrderHttpAdapter 向本地 OrderController 发起 HTTP 回调以更新订单状态。
    // 若在外层事务中先向 deliveries 表 INSERT（触发 orders.id 的 FK 共享锁），
    // 再发起回调 UPDATE orders，会造成同一行的 S 锁与 X 锁跨线程等待，产生死锁。
    // 修复方案：先在 txTemplate 的独立事务中提交 deliveries/delivery_files，
    // 释放 FK 共享锁后，再调用 orderStatusPort.changeStatus()。
    public DeliveryUploadResponse upload(Long orderId, MultipartFile file, String remark) {
        Long currentUserId = requireCurrentUserId();
        if (UserContext.getCurrentRole() != UserRole.PROVIDER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "需要以服务方身份操作");
        }
        OrderSnapshot order = orderQueryPort.getOrderSnapshot(orderId);
        if (!currentUserId.equals(order.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单服务方可以上传交付文件");
        }
        if (!PENDING_DELIVERY.equals(order.getStatus()) && !REWORK_REQUIRED.equals(order.getStatus())) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "订单当前状态不允许上传交付文件");
        }

        FileUploadResponse uploadedFile = fileService.upload(
                file,
                currentUserId,
                DELIVERY_BIZ_TYPE,
                PRIVATE_VISIBILITY
        );

        // 在独立事务中保存交付记录后立即提交，释放 deliveries→orders FK 共享锁，
        // 避免后续 changeStatus HTTP 回调时产生 S/X 锁死锁。
        final Long finalUserId = currentUserId;
        final LocalDateTime now = LocalDateTime.now();
        Delivery saved = txTemplate.execute(status -> {
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
            Delivery d = deliveryRepository.save(delivery);

            DeliveryFile deliveryFile = new DeliveryFile();
            deliveryFile.setDeliveryId(d.getId());
            deliveryFile.setFileId(uploadedFile.getFileId());
            deliveryFile.setFileType(RETOUCHED_FILE_TYPE);
            deliveryFile.setSortOrder(0);
            deliveryFile.setUploadTime(now);
            deliveryFileRepository.save(deliveryFile);
            return d;
        });

        String orderStatus;
        try {
            if (REWORK_REQUIRED.equals(order.getStatus())) {
                Order completedOrder = orderService.completeReworkDelivery(
                        orderId,
                        currentUserId,
                        "服务方上传交付文件"
                );
                orderStatus = completedOrder.getStatus().name();
            } else {
                // deliveries 事务已提交，FK 共享锁已释放，可安全发起 HTTP 回调
                orderStatus = orderStatusPort.changeStatus(
                        orderId,
                        DELIVERED_PENDING_CONFIRM,
                        currentUserId,
                        "服务方上传交付文件"
                );
            }
        } catch (RuntimeException e) {
            rollbackSavedDelivery(saved.getId());
            throw e;
        }

        notifyDeliveryUploaded(order);

        return new DeliveryUploadResponse(
                saved.getId(),
                saved.getOrderId(),
                saved.getDeliveryRound(),
                uploadedFile.getFileId(),
                uploadedFile.getOriginalName(),
                finalUserId,
                saved.getUploadTime(),
                orderStatus
        );
    }

    private void rollbackSavedDelivery(Long deliveryId) {
        try {
            txTemplate.execute(status -> {
                deliveryFileRepository.deleteByDeliveryId(deliveryId);
                deliveryRepository.deleteById(deliveryId);
                return null;
            });
        } catch (RuntimeException ignored) {
            // Preserve the original order status failure for the caller.
        }
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
