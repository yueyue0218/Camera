package com.action.camera.delivery.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.delivery.dto.DeliveryResponse;
import com.action.camera.delivery.dto.DeliveryUploadResponse;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.port.OrderQueryPort;
import com.action.camera.delivery.port.OrderSnapshot;
import com.action.camera.delivery.port.OrderStatusPort;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.infrastructure.storage.FileStorage;
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

    private final DeliveryRepository deliveryRepository;
    private final FileStorage fileStorage;
    private final OrderQueryPort orderQueryPort;
    private final OrderStatusPort orderStatusPort;

    public DeliveryService(DeliveryRepository deliveryRepository,
                           FileStorage fileStorage,
                           OrderQueryPort orderQueryPort,
                           OrderStatusPort orderStatusPort) {
        this.deliveryRepository = deliveryRepository;
        this.fileStorage = fileStorage;
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

        String fileKey = fileStorage.store(file);
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

        String orderStatus = orderStatusPort.changeStatus(
                orderId,
                DELIVERED_PENDING_CONFIRM,
                currentUserId,
                "服务方上传交付文件"
        );

        return new DeliveryUploadResponse(
                saved.getId(),
                saved.getOrderId(),
                saved.getDeliveryRound(),
                fileKey,
                file.getOriginalFilename(),
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
                delivery.getStatus(),
                delivery.getRemark(),
                delivery.getUploadTime()
        );
    }

    private Long requireCurrentUserId() {
        Long currentUserId = UserContext.getUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return currentUserId;
    }
}
