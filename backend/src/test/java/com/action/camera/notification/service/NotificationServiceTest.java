package com.action.camera.notification.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.UserContext;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.notification.dto.NotificationCreateRequest;
import com.action.camera.notification.dto.NotificationResponse;
import com.action.camera.notification.entity.Notification;
import com.action.camera.notification.repository.NotificationRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class NotificationServiceTest {

    private static final Long USER_ID = 910001L;
    private static final Long OTHER_USER_ID = 910002L;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("DELETE FROM notifications WHERE user_id IN (?, ?)", USER_ID, OTHER_USER_ID);
        insertUser(USER_ID, "notification-user");
        insertUser(OTHER_USER_ID, "notification-other-user");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void createNotificationPersistsUnreadNotification() {
        NotificationResponse response = notificationService.createNotification(new NotificationCreateRequest(
                USER_ID,
                "交付已上传",
                "服务方已上传交付文件",
                "DELIVERY_UPLOADED",
                "ORDER",
                8001L
        ));

        Notification saved = notificationRepository.findById(response.notificationId()).orElseThrow();
        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getTitle()).isEqualTo("交付已上传");
        assertThat(saved.getContent()).isEqualTo("服务方已上传交付文件");
        assertThat(saved.getType()).isEqualTo("DELIVERY_UPLOADED");
        assertThat(saved.getRelatedType()).isEqualTo("ORDER");
        assertThat(saved.getRelatedId()).isEqualTo(8001L);
        assertThat(saved.getTargetType()).isEqualTo("ORDER");
        assertThat(saved.getTargetId()).isEqualTo(8001L);
        assertThat(saved.getSourceType()).isEqualTo("ORDER");
        assertThat(saved.getSourceId()).isEqualTo(8001L);
        assertThat(saved.getIsRead()).isFalse();
        assertThat(saved.getCreatedAt()).isNotNull();
    }

    @Test
    void createNotificationPersistsFullRoutingContract() {
        NotificationResponse response = notificationService.createNotification(new NotificationCreateRequest(
                USER_ID,
                OTHER_USER_ID,
                "申诉已创建",
                "对方发起了订单申诉",
                "DISPUTE_CREATED",
                "DISPUTE_CREATED",
                "DISPUTE",
                3001L,
                "DISPUTE",
                3001L,
                "DISPUTE",
                3001L,
                "dispute:created:3001:" + USER_ID,
                "{\"orderId\":8001}"
        ));

        assertThat(response.recipientUserId()).isEqualTo(USER_ID);
        assertThat(response.actorUserId()).isEqualTo(OTHER_USER_ID);
        assertThat(response.eventType()).isEqualTo("DISPUTE_CREATED");
        assertThat(response.relatedType()).isEqualTo("DISPUTE");
        assertThat(response.relatedId()).isEqualTo(3001L);
        assertThat(response.targetType()).isEqualTo("DISPUTE");
        assertThat(response.targetId()).isEqualTo(3001L);
        assertThat(response.sourceType()).isEqualTo("DISPUTE");
        assertThat(response.sourceId()).isEqualTo(3001L);
        assertThat(response.dedupeKey()).isEqualTo("dispute:created:3001:" + USER_ID);
        assertThat(response.metadataJson()).isEqualTo("{\"orderId\":8001}");
    }

    @Test
    void listMineOnlyReturnsCurrentUserNotifications() {
        notificationService.createNotification(requestFor(USER_ID, "我的通知"));
        notificationService.createNotification(requestFor(OTHER_USER_ID, "别人的通知"));
        UserContext.setUserId(USER_ID);

        List<NotificationResponse> responses = notificationService.listMine();

        assertThat(responses)
                .extracting(NotificationResponse::title)
                .containsExactly("我的通知");
    }

    @Test
    void markReadRejectsOtherUsersNotification() {
        NotificationResponse otherNotification = notificationService.createNotification(
                requestFor(OTHER_USER_ID, "别人的通知")
        );
        UserContext.setUserId(USER_ID);

        assertThatThrownBy(() -> notificationService.markRead(otherNotification.notificationId()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.FORBIDDEN);
    }

    @Test
    void markAllReadOnlyUpdatesCurrentUserNotifications() {
        NotificationResponse mine = notificationService.createNotification(requestFor(USER_ID, "我的通知"));
        NotificationResponse other = notificationService.createNotification(requestFor(OTHER_USER_ID, "别人的通知"));
        UserContext.setUserId(USER_ID);

        List<NotificationResponse> responses = notificationService.markAllRead();

        assertThat(responses)
                .extracting(NotificationResponse::notificationId)
                .containsExactly(mine.notificationId());
        assertThat(notificationRepository.findById(mine.notificationId()).orElseThrow().getIsRead()).isTrue();
        assertThat(notificationRepository.findById(other.notificationId()).orElseThrow().getIsRead()).isFalse();
    }

    @Test
    void dedupeKeyMakesCreateIdempotent() {
        NotificationCreateRequest request = new NotificationCreateRequest(
                USER_ID,
                OTHER_USER_ID,
                "收到评价",
                "你收到了一条评价",
                "REVIEW_RECEIVED",
                "REVIEW_RECEIVED",
                "REVIEW",
                100L,
                "REVIEW",
                100L,
                "REVIEW",
                100L,
                "review:received:100",
                null
        );

        NotificationResponse first = notificationService.createNotification(request);
        NotificationResponse second = notificationService.createNotification(request);

        assertThat(second.notificationId()).isEqualTo(first.notificationId());
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(USER_ID)).hasSize(1);
    }

    @Test
    void paginationUnreadFilterAndUnreadCountWorkForCurrentUser() {
        notificationService.createNotification(requestFor(USER_ID, "第一条"));
        NotificationResponse second = notificationService.createNotification(requestFor(USER_ID, "第二条"));
        notificationService.createNotification(requestFor(OTHER_USER_ID, "别人的通知"));
        UserContext.setUserId(USER_ID);
        notificationService.markRead(second.notificationId());

        assertThat(notificationService.unreadCount()).isEqualTo(1);
        assertThat(notificationService.listMine(0, 10, false).getRecords())
                .extracting(NotificationResponse::title)
                .containsExactly("第一条");
        assertThat(notificationService.listMine(0, 1, null).getSize()).isEqualTo(1);
        assertThat(notificationService.listMine(0, 1, null).getTotal()).isEqualTo(2);
        assertThat(notificationService.listMine(0, 200, null).getSize()).isEqualTo(100);
    }

    private NotificationCreateRequest requestFor(Long userId, String title) {
        return new NotificationCreateRequest(
                userId,
                title,
                "通知内容",
                "REVIEW_RECEIVED",
                "ORDER",
                8002L
        );
    }

    private void insertUser(Long userId, String nickname) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, status, credit_score, created_at, updated_at)
                VALUES (?, ?, 'CUSTOMER', 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)
                """, userId, nickname);
    }
}
