package com.action.camera.delivery.service;

import com.action.camera.application.FileService;
import com.action.camera.application.OrderDisplayService;
import com.action.camera.application.UserDisplayService;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.dto.DeliveryResponse;
import com.action.camera.delivery.dto.DeliveryFileResponse;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class DeliveryService {

    private static final String PENDING_DELIVERY = "PENDING_DELIVERY";
    private static final String DELIVERED_PENDING_CONFIRM = "DELIVERED_PENDING_CONFIRM";
    private static final String REWORK_REQUIRED = "REWORK_REQUIRED";
    private static final String DELIVERY_UPLOADED = "UPLOADED";
    private static final String DELIVERY_BIZ_TYPE = "DELIVERY";
    private static final String PRIVATE_VISIBILITY = "PRIVATE";
    private static final String IMAGE_FILE_TYPE = "IMAGE";
    private static final String ZIP_FILE_TYPE = "ZIP";
    private static final int MAX_DELIVERY_FILE_COUNT = 20;
    private static final long DEFAULT_MAX_DELIVERY_IMAGE_SIZE_BYTES = 20L * 1024L * 1024L;
    private static final long DEFAULT_MAX_DELIVERY_ZIP_SIZE_BYTES = 200L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );
    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(
            ".jpg",
            ".jpeg",
            ".png",
            ".webp"
    );
    private static final Set<String> ALLOWED_ZIP_TYPES = Set.of(
            "application/zip",
            "application/x-zip-compressed",
            "multipart/x-zip",
            "application/octet-stream"
    );

    private final DeliveryRepository deliveryRepository;
    private final DeliveryFileRepository deliveryFileRepository;
    private final FileService fileService;
    private final FileRepository fileRepository;
    private final OrderQueryPort orderQueryPort;
    private final OrderStatusPort orderStatusPort;
    private final OrderService orderService;
    private final TransactionTemplate txTemplate;
    private final UserDisplayService userDisplayService;
    private final OrderDisplayService orderDisplayService;

    @org.springframework.beans.factory.annotation.Value("${camera.delivery.image.max-size-bytes:20971520}")
    private long maxDeliveryImageSizeBytes = DEFAULT_MAX_DELIVERY_IMAGE_SIZE_BYTES;

    @org.springframework.beans.factory.annotation.Value("${camera.delivery.zip.max-size-bytes:209715200}")
    private long maxDeliveryZipSizeBytes = DEFAULT_MAX_DELIVERY_ZIP_SIZE_BYTES;

    @Autowired(required = false)
    private NotificationService notificationService;

    public DeliveryService(DeliveryRepository deliveryRepository,
                           DeliveryFileRepository deliveryFileRepository,
                           FileService fileService,
                           FileRepository fileRepository,
                           OrderQueryPort orderQueryPort,
                           OrderStatusPort orderStatusPort,
                           OrderService orderService,
                           TransactionTemplate txTemplate,
                           UserDisplayService userDisplayService,
                           OrderDisplayService orderDisplayService) {
        this.deliveryRepository = deliveryRepository;
        this.deliveryFileRepository = deliveryFileRepository;
        this.fileService = fileService;
        this.fileRepository = fileRepository;
        this.orderQueryPort = orderQueryPort;
        this.orderStatusPort = orderStatusPort;
        this.orderService = orderService;
        this.txTemplate = txTemplate;
        this.userDisplayService = userDisplayService;
        this.orderDisplayService = orderDisplayService;
    }

    // 注意：此方法不加 @Transactional。
    // 原因：upload() 内部会通过 COrderHttpAdapter 向本地 OrderController 发起 HTTP 回调以更新订单状态。
    // 若在外层事务中先向 deliveries 表 INSERT（触发 orders.id 的 FK 共享锁），
    // 再发起回调 UPDATE orders，会造成同一行的 S 锁与 X 锁跨线程等待，产生死锁。
    // 修复方案：先在 txTemplate 的独立事务中提交 deliveries/delivery_files，
    // 释放 FK 共享锁后，再调用 orderStatusPort.changeStatus()。
    public DeliveryUploadResponse upload(Long orderId, MultipartFile file, String remark) {
        return upload(orderId, file == null ? List.of() : List.of(file), remark);
    }

    public DeliveryUploadResponse upload(Long orderId, List<MultipartFile> files, String remark) {
        Long currentUserId = requireCurrentUserId();
        if (UserContext.getCurrentRole() != UserRole.PROVIDER) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "需要以服务方身份操作");
        }
        List<MultipartFile> uploadFiles = normalizeAndValidateFiles(files);
        OrderSnapshot order = orderQueryPort.getOrderSnapshot(orderId);
        if (!currentUserId.equals(order.getProviderId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只有订单服务方可以上传交付文件");
        }
        orderService.syncTimelineStatusIfDue(orderId);
        order = orderQueryPort.getOrderSnapshot(orderId);
        OrderSnapshot uploadableOrder = order;
        String currentStatus = uploadableOrder.getStatus();
        if (!PENDING_DELIVERY.equals(currentStatus) && !REWORK_REQUIRED.equals(currentStatus)) {
            throw new BusinessException(ErrorCode.STATUS_CONFLICT, "订单当前状态不允许上传交付文件");
        }

        int nextDeliveryRound = resolveNextDeliveryRound(orderId);
        List<UploadedDeliveryFile> uploadedFiles = uploadDeliveryFiles(uploadFiles, currentUserId);

        // 在独立事务中保存交付记录后立即提交，释放 deliveries→orders FK 共享锁，
        // 避免后续 changeStatus HTTP 回调时产生 S/X 锁死锁。
        final Long finalUserId = currentUserId;
        final LocalDateTime now = LocalDateTime.now();
        Delivery saved;
        try {
            saved = txTemplate.execute(status -> {
                Delivery delivery = new Delivery();
                delivery.setOrderId(orderId);
                delivery.setDeliveryRound(nextDeliveryRound);
                delivery.setIsLatest(true);
                delivery.setOriginalCount(countFilesOfType(uploadedFiles, IMAGE_FILE_TYPE));
                delivery.setRefinedCount(countFilesOfType(uploadedFiles, IMAGE_FILE_TYPE));
                delivery.setDeadline(uploadableOrder.getDeliveryDeadline());
                delivery.setStatus(DELIVERY_UPLOADED);
                delivery.setRemark(remark);
                delivery.setUploadTime(now);
                delivery.setAutoConfirmDeadline(now.plusDays(7));
                Delivery d = deliveryRepository.save(delivery);

                for (UploadedDeliveryFile uploadedFile : uploadedFiles) {
                    DeliveryFile deliveryFile = new DeliveryFile();
                    deliveryFile.setDeliveryId(d.getId());
                    deliveryFile.setFileId(uploadedFile.fileId());
                    deliveryFile.setFileType(uploadedFile.fileType());
                    deliveryFile.setSortOrder(uploadedFile.sortOrder());
                    deliveryFile.setUploadTime(now);
                    deliveryFileRepository.save(deliveryFile);
                }
                return d;
            });
        } catch (RuntimeException e) {
            cleanupUploadedFiles(uploadedFiles);
            throw e;
        }

        String orderStatus;
        try {
            if (REWORK_REQUIRED.equals(uploadableOrder.getStatus())) {
                Order completedOrder = orderService.completeReworkDelivery(
                        orderId,
                        currentUserId,
                        "服务方上传交付文件"
                );
                orderStatus = completedOrder.getStatus().name();
            } else {
                Order deliveredOrder = orderService.markDeliveryUploaded(
                        orderId,
                        currentUserId,
                        "服务方上传交付文件"
                );
                orderStatus = deliveredOrder.getStatus().name();
            }
        } catch (RuntimeException e) {
            rollbackSavedDelivery(saved.getId(), uploadedFiles);
            throw e;
        }

        notifyDeliveryUploaded(uploadableOrder);

        return new DeliveryUploadResponse(
                saved.getId(),
                saved.getOrderId(),
                saved.getDeliveryRound(),
                uploadedFiles.get(0).fileId(),
                uploadedFiles.get(0).fileName(),
                finalUserId,
                saved.getUploadTime(),
                orderStatus,
                uploadedFiles.stream().map(UploadedDeliveryFile::toResponse).toList()
        );
    }

    private int resolveNextDeliveryRound(Long orderId) {
        return deliveryRepository.findByOrderIdOrderByUploadTimeDesc(orderId).stream()
                .map(Delivery::getDeliveryRound)
                .filter(round -> round != null && round > 0)
                .max(Integer::compareTo)
                .map(round -> round + 1)
                .orElse(1);
    }

    private void rollbackSavedDelivery(Long deliveryId, List<UploadedDeliveryFile> uploadedFiles) {
        try {
            txTemplate.execute(status -> {
                deliveryFileRepository.deleteByDeliveryId(deliveryId);
                deliveryRepository.deleteById(deliveryId);
                return null;
            });
        } catch (RuntimeException ignored) {
            // Preserve the original order status failure for the caller.
        }
        cleanupUploadedFiles(uploadedFiles);
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
        List<DeliveryFileResponse> files = filesOf(delivery);
        DeliveryFileResponse firstFile = files.isEmpty() ? null : files.get(0);
        return new DeliveryResponse(
                delivery.getId(),
                delivery.getOrderId(),
                delivery.getDeliveryRound(),
                delivery.getIsLatest(),
                delivery.getOriginalCount(),
                delivery.getRefinedCount(),
                firstFile == null ? null : firstFile.getFileId(),
                firstFile == null ? null : firstFile.getFileName(),
                delivery.getStatus(),
                delivery.getRemark(),
                delivery.getUploadTime(),
                files
        );
    }

    private List<DeliveryFileResponse> filesOf(Delivery delivery) {
        return deliveryFileRepository.findByDeliveryIdOrderBySortOrderAsc(delivery.getId()).stream()
                .sorted(Comparator.comparing(DeliveryFile::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .map(this::toFileResponse)
                .toList();
    }

    private DeliveryFileResponse toFileResponse(DeliveryFile deliveryFile) {
        FileRecord record = fileRepository.findById(deliveryFile.getFileId()).orElse(null);
        return new DeliveryFileResponse(
                deliveryFile.getFileId(),
                record == null ? null : record.getOriginalName(),
                record == null ? null : record.getMimeType(),
                record == null ? null : record.getFileSize(),
                deliveryFile.getFileType(),
                deliveryFile.getSortOrder()
        );
    }

    private List<MultipartFile> normalizeAndValidateFiles(List<MultipartFile> files) {
        List<MultipartFile> normalized = new ArrayList<>();
        if (files != null) {
            files.stream()
                    .filter(file -> file != null && !file.isEmpty())
                    .forEach(normalized::add);
        }
        if (normalized.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "请选择要上传的交付文件");
        }
        if (normalized.size() > MAX_DELIVERY_FILE_COUNT) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "一次最多上传 " + MAX_DELIVERY_FILE_COUNT + " 个交付文件");
        }
        for (MultipartFile file : normalized) {
            resolveDeliveryFileType(file);
        }
        return normalized;
    }

    private List<UploadedDeliveryFile> uploadDeliveryFiles(List<MultipartFile> files, Long currentUserId) {
        List<UploadedDeliveryFile> uploadedFiles = new ArrayList<>();
        try {
            for (int index = 0; index < files.size(); index++) {
                MultipartFile file = files.get(index);
                String fileType = resolveDeliveryFileType(file);
                FileUploadResponse uploadedFile = fileService.upload(
                        file,
                        currentUserId,
                        DELIVERY_BIZ_TYPE,
                        PRIVATE_VISIBILITY
                );
                uploadedFiles.add(new UploadedDeliveryFile(
                        uploadedFile.getFileId(),
                        uploadedFile.getOriginalName(),
                        normalize(file.getContentType()),
                        file.getSize(),
                        fileType,
                        index
                ));
            }
            return uploadedFiles;
        } catch (RuntimeException e) {
            cleanupUploadedFiles(uploadedFiles);
            throw e;
        }
    }

    private String resolveDeliveryFileType(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "交付文件不能为空");
        }
        String contentType = normalize(file.getContentType());
        String extension = extension(file.getOriginalFilename());
        if (ALLOWED_IMAGE_TYPES.contains(contentType) && ALLOWED_IMAGE_EXTENSIONS.contains(extension)) {
            if (file.getSize() > maxDeliveryImageSizeBytes) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "图片文件过大，单张不能超过 " + sizeMb(maxDeliveryImageSizeBytes) + "MB");
            }
            return IMAGE_FILE_TYPE;
        }
        if (".zip".equals(extension) && ALLOWED_ZIP_TYPES.contains(contentType)) {
            if (file.getSize() > maxDeliveryZipSizeBytes) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "压缩包过大，单个 zip 不能超过 " + sizeMb(maxDeliveryZipSizeBytes) + "MB");
            }
            return ZIP_FILE_TYPE;
        }
        throw new BusinessException(ErrorCode.VALIDATION_ERROR, "仅支持 jpg、jpeg、png、webp 图片或 zip 压缩包");
    }

    private int countFilesOfType(List<UploadedDeliveryFile> files, String fileType) {
        return (int) files.stream()
                .filter(file -> fileType.equals(file.fileType()))
                .count();
    }

    private void cleanupUploadedFiles(List<UploadedDeliveryFile> uploadedFiles) {
        if (uploadedFiles == null) {
            return;
        }
        uploadedFiles.forEach(file -> fileService.deleteUploadedFileQuietly(file.fileId()));
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String extension(String filename) {
        if (filename == null) {
            return "";
        }
        int dotIndex = filename.lastIndexOf('.');
        return dotIndex < 0 ? "" : filename.substring(dotIndex).toLowerCase(Locale.ROOT);
    }

    private long sizeMb(long bytes) {
        return Math.max(1L, bytes / 1024L / 1024L);
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
        String providerName = userDisplayService.resolveProviderDisplayName(order.getProviderId());
        String orderSubject = orderDisplayService.resolveOrderSubject(order.getOrderId());
        notificationService.createNotification(new NotificationCreateRequest(
                order.getCustomerId(),
                orderSubject + " 作品已上传",
                providerName + " 已上传" + orderSubject + "的作品，请前往订单详情查看并确认。",
                "DELIVERY_UPLOADED",
                "ORDER",
                order.getOrderId()
        ));
    }

    private record UploadedDeliveryFile(
            Long fileId,
            String fileName,
            String mimeType,
            Long fileSize,
            String fileType,
            Integer sortOrder
    ) {
        DeliveryFileResponse toResponse() {
            return new DeliveryFileResponse(fileId, fileName, mimeType, fileSize, fileType, sortOrder);
        }
    }
}
