package com.action.camera.application;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.UserRole;
import com.action.camera.delivery.entity.Delivery;
import com.action.camera.delivery.entity.DeliveryFile;
import com.action.camera.delivery.repository.DeliveryFileRepository;
import com.action.camera.delivery.repository.DeliveryRepository;
import com.action.camera.domain.FileRecord;
import com.action.camera.message.entity.Conversation;
import com.action.camera.message.entity.Message;
import com.action.camera.message.repository.ConversationRepository;
import com.action.camera.message.repository.MessageRepository;
import com.action.camera.order.entity.Order;
import com.action.camera.order.repository.OrderRepository;
import com.action.camera.photoauthorization.entity.PhotoAuthorization;
import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationFileRepository;
import com.action.camera.photoauthorization.repository.PhotoAuthorizationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FileAccessPolicyTest {

    private static final Long FILE_ID = 10L;
    private static final Long UPLOADER_ID = 1001L;
    private static final Long CUSTOMER_ID = 2001L;
    private static final Long PROVIDER_ID = 3001L;
    private static final Long OUTSIDER_ID = 4001L;

    @Mock private DeliveryFileRepository deliveryFileRepository;
    @Mock private DeliveryRepository deliveryRepository;
    @Mock private OrderRepository orderRepository;
    @Mock private PhotoAuthorizationFileRepository photoAuthorizationFileRepository;
    @Mock private PhotoAuthorizationRepository photoAuthorizationRepository;
    @Mock private MessageRepository messageRepository;
    @Mock private ConversationRepository conversationRepository;

    private FileAccessPolicy policy;

    @BeforeEach
    void setUp() {
        policy = new FileAccessPolicy(
                deliveryFileRepository,
                deliveryRepository,
                orderRepository,
                photoAuthorizationFileRepository,
                photoAuthorizationRepository,
                messageRepository,
                conversationRepository
        );
    }

    @Test
    void uploaderCanDownloadOwnPrivateFile() {
        assertThatCode(() -> policy.assertCanDownload(privateFile("CERTIFICATION"), UPLOADER_ID, UserRole.CUSTOMER))
                .doesNotThrowAnyException();
    }

    @Test
    void outsiderCannotDownloadUnrelatedPrivateFile() {
        stubNoBusinessRelationship();

        assertThatThrownBy(() -> policy.assertCanDownload(privateFile("CERTIFICATION"), OUTSIDER_ID, UserRole.CUSTOMER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void anonymousUserCanDownloadPublicAvatar() {
        assertThatCode(() -> policy.assertCanDownload(publicFile("AVATAR"), null, null))
                .doesNotThrowAnyException();
    }

    @Test
    void deliveryCannotBecomePublicOnlyBecauseVisibilitySaysPublic() {
        when(photoAuthorizationFileRepository.findByFileIdIn(List.of(FILE_ID))).thenReturn(List.of());

        assertThatThrownBy(() -> policy.assertCanDownload(publicFile("DELIVERY"), null, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UNAUTHORIZED);
        assertThat(policy.resolveVisibility("DELIVERY", "PUBLIC")).isEqualTo("PRIVATE");
    }

    @Test
    void orderCustomerAndProviderCanDownloadDeliveryButOutsiderCannot() {
        DeliveryFile deliveryFile = new DeliveryFile();
        deliveryFile.setFileId(FILE_ID);
        deliveryFile.setDeliveryId(20L);
        Delivery delivery = new Delivery();
        delivery.setId(20L);
        delivery.setOrderId(30L);
        Order order = new Order();
        order.setId(30L);
        order.setCustomerId(CUSTOMER_ID);
        order.setProviderUserId(PROVIDER_ID);
        when(deliveryFileRepository.findByFileId(FILE_ID)).thenReturn(List.of(deliveryFile));
        when(deliveryRepository.findAllById(any())).thenReturn(List.of(delivery));
        when(orderRepository.findAllById(any())).thenReturn(List.of(order));
        when(photoAuthorizationFileRepository.findByFileIdIn(List.of(FILE_ID))).thenReturn(List.of());
        when(messageRepository.findByFileId(FILE_ID)).thenReturn(List.of());

        assertThatCode(() -> policy.assertCanDownload(privateFile("DELIVERY"), CUSTOMER_ID, UserRole.CUSTOMER))
                .doesNotThrowAnyException();
        assertThatCode(() -> policy.assertCanDownload(privateFile("DELIVERY"), PROVIDER_ID, UserRole.PROVIDER))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.assertCanDownload(privateFile("DELIVERY"), OUTSIDER_ID, UserRole.CUSTOMER))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void grantedPhotoAuthorizationAllowsPublicDisplayOfDeliveryFile() {
        PhotoAuthorizationFile authorizationFile = new PhotoAuthorizationFile();
        authorizationFile.setAuthorizationId(50L);
        authorizationFile.setFileId(FILE_ID);
        PhotoAuthorization authorization = new PhotoAuthorization();
        authorization.setId(50L);
        authorization.setStatus(PhotoAuthorization.STATUS_GRANTED);
        authorization.setPhotoUsageScope(PhotoAuthorization.USAGE_SCOPE_PORTFOLIO_DISPLAY);
        when(photoAuthorizationFileRepository.findByFileIdIn(List.of(FILE_ID))).thenReturn(List.of(authorizationFile));
        when(photoAuthorizationRepository.findAllById(any())).thenReturn(List.of(authorization));

        assertThatCode(() -> policy.assertCanDownload(privateFile("DELIVERY"), null, null))
                .doesNotThrowAnyException();
    }

    @Test
    void conversationParticipantCanDownloadReferencedPrivateFile() {
        Message message = new Message();
        message.setFileId(FILE_ID);
        message.setConversationId(60L);
        Conversation conversation = new Conversation();
        conversation.setId(60L);
        conversation.setParticipantAId(CUSTOMER_ID);
        conversation.setParticipantBId(PROVIDER_ID);
        when(deliveryFileRepository.findByFileId(FILE_ID)).thenReturn(List.of());
        when(photoAuthorizationFileRepository.findByFileIdIn(List.of(FILE_ID))).thenReturn(List.of());
        when(messageRepository.findByFileId(FILE_ID)).thenReturn(List.of(message));
        when(conversationRepository.findAllById(any())).thenReturn(List.of(conversation));

        assertThatCode(() -> policy.assertCanDownload(privateFile("CERTIFICATION"), CUSTOMER_ID, UserRole.CUSTOMER))
                .doesNotThrowAnyException();
    }

    @Test
    void publicWhitelistRejectsUnknownBizTypeAndKeepsPrivateRequestPrivate() {
        assertThat(policy.resolveVisibility("SERVICE_PORTFOLIO", "PUBLIC")).isEqualTo("PUBLIC");
        assertThat(policy.resolveVisibility("AVATAR", "PRIVATE")).isEqualTo("PRIVATE");
        assertThatThrownBy(() -> policy.resolveVisibility("PUBLISH_IMAGE", "PUBLIC"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
    }

    private void stubNoBusinessRelationship() {
        when(deliveryFileRepository.findByFileId(FILE_ID)).thenReturn(List.of());
        when(photoAuthorizationFileRepository.findByFileIdIn(List.of(FILE_ID))).thenReturn(List.of());
        when(messageRepository.findByFileId(FILE_ID)).thenReturn(List.of());
    }

    private FileRecord privateFile(String bizType) {
        return file(bizType, "PRIVATE");
    }

    private FileRecord publicFile(String bizType) {
        return file(bizType, "PUBLIC");
    }

    private FileRecord file(String bizType, String visibility) {
        FileRecord file = new FileRecord();
        file.setId(FILE_ID);
        file.setUploaderId(UPLOADER_ID);
        file.setBizType(bizType);
        file.setVisibility(visibility);
        return file;
    }
}
