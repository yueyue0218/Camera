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
        assertThat(saved.getIsRead()).isFalse();
        assertThat(saved.getCreatedAt()).isNotNull();
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
