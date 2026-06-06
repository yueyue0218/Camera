package com.action.camera.social.service;

import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.notification.repository.NotificationRepository;
import com.action.camera.provider.dto.ProviderProfilePublicVO;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.FollowStateResponse;
import com.action.camera.social.dto.PublicProfileResponse;
import com.action.camera.social.dto.SocialUserBriefResponse;
import com.action.camera.social.repository.MomentPostRepository;
import com.action.camera.social.repository.UserFollowRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class SocialRelationServiceTest {

    private static final Long VIEWER_ID = 930001L;
    private static final Long PROVIDER_ID = 930002L;
    private static final Long OTHER_ID = 930003L;

    @Autowired
    private SocialRelationService socialRelationService;

    @Autowired
    private MomentService momentService;

    @Autowired
    private MomentPostRepository momentPostRepository;

    @Autowired
    private UserFollowRepository userFollowRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setUp() {
        createMyBatisPlusTables();
        insertUser(VIEWER_ID, "viewer", "CUSTOMER", "viewer bio");
        insertUser(PROVIDER_ID, "provider", "PROVIDER", "provider bio");
        insertUser(OTHER_ID, "other", "CUSTOMER", "other bio");
        insertProviderProfile(PROVIDER_ID);
    }

    @AfterEach
    void tearDown() {
        // no-op, transaction rolls back
    }

    @Test
    void followCreatesRelationAndSendsNotificationOnce() {
        CurrentUser viewer = new CurrentUser(VIEWER_ID, UserRole.CUSTOMER);

        FollowStateResponse first = socialRelationService.follow(PROVIDER_ID, "PROVIDER", viewer);
        FollowStateResponse second = socialRelationService.follow(PROVIDER_ID, "PROVIDER", viewer);

        assertThat(first.isFollowed()).isTrue();
        assertThat(second.isFollowed()).isTrue();
        assertThat(userFollowRepository.existsByFollowerIdAndFollowingUserId(VIEWER_ID, PROVIDER_ID)).isTrue();
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .extracting("type")
                .containsExactly("FOLLOWED");
    }

    @Test
    void unfollowIsIdempotentAndDoesNotNotify() {
        CurrentUser viewer = new CurrentUser(VIEWER_ID, UserRole.CUSTOMER);
        socialRelationService.follow(PROVIDER_ID, "PROVIDER", viewer);

        FollowStateResponse first = socialRelationService.unfollow(PROVIDER_ID, "PROVIDER", viewer);
        FollowStateResponse second = socialRelationService.unfollow(PROVIDER_ID, "PROVIDER", viewer);

        assertThat(first.isFollowed()).isFalse();
        assertThat(second.isFollowed()).isFalse();
        assertThat(userFollowRepository.existsByFollowerIdAndFollowingUserId(VIEWER_ID, PROVIDER_ID)).isFalse();
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(PROVIDER_ID))
                .extracting("type")
                .containsExactly("FOLLOWED");
    }

    @Test
    void publicProfileIncludesProviderExtensionAndCounts() {
        CurrentUser viewer = new CurrentUser(VIEWER_ID, UserRole.CUSTOMER);
        socialRelationService.follow(PROVIDER_ID, "PROVIDER", viewer);
        momentService.createMoment(new CurrentUser(PROVIDER_ID, UserRole.PROVIDER), momentRequest("from provider"));
        momentService.createMoment(new CurrentUser(OTHER_ID, UserRole.CUSTOMER), momentRequest("from other"));

        PublicProfileResponse response = socialRelationService.getPublicProfile(PROVIDER_ID, "PROVIDER", viewer);

        assertThat(response.getUserId()).isEqualTo(PROVIDER_ID);
        assertThat(response.getNickname()).isEqualTo("Provider Display");
        assertThat(response.getFollowerCount()).isEqualTo(1);
        assertThat(response.getFollowingCount()).isEqualTo(0);
        assertThat(response.isFollowedByCurrentUser()).isTrue();
        assertThat(response.getMomentCount()).isEqualTo(1);
        ProviderProfilePublicVO providerProfile = response.getProviderProfile();
        assertThat(providerProfile).isNotNull();
        assertThat(providerProfile.getProviderId()).isEqualTo(PROVIDER_ID);
        assertThat(providerProfile.getServiceType()).isEqualTo("PORTRAIT");
    }

    @Test
    void followingFeedOnlyShowsFollowedPublishers() {
        CurrentUser viewer = new CurrentUser(VIEWER_ID, UserRole.CUSTOMER);
        socialRelationService.follow(PROVIDER_ID, "PROVIDER", viewer);
        momentService.createMoment(new CurrentUser(PROVIDER_ID, UserRole.PROVIDER), momentRequest("followed"));
        momentService.createMoment(new CurrentUser(OTHER_ID, UserRole.CUSTOMER), momentRequest("ignored"));

        List<Long> ids = momentService.listMoments(viewer, "following", null, null).stream()
                .map(response -> response.getMomentId())
                .toList();

        assertThat(ids).hasSize(1);
        assertThat(ids).allMatch(id -> momentPostRepository.findById(id).orElseThrow().getAuthorId().equals(PROVIDER_ID));
        assertThat(momentPostRepository.findByAuthorIdAndStatusOrderByCreatedAtDesc(PROVIDER_ID, MomentStatus.PUBLISHED))
                .hasSize(1);
    }

    @Test
    void listFollowersAndFollowingReturnsBriefUserCards() {
        CurrentUser viewer = new CurrentUser(VIEWER_ID, UserRole.CUSTOMER);
        socialRelationService.follow(PROVIDER_ID, "PROVIDER", viewer);
        socialRelationService.follow(OTHER_ID, "CUSTOMER", viewer);
        socialRelationService.follow(PROVIDER_ID, "PROVIDER", new CurrentUser(OTHER_ID, UserRole.CUSTOMER));

        List<SocialUserBriefResponse> followers = socialRelationService.listFollowers(PROVIDER_ID, "PROVIDER", viewer);
        List<SocialUserBriefResponse> following = socialRelationService.listFollowing(VIEWER_ID, null, viewer);

        assertThat(followers).extracting(SocialUserBriefResponse::getUserId)
                .containsExactlyInAnyOrder(OTHER_ID, VIEWER_ID);
        assertThat(following).extracting(SocialUserBriefResponse::getUserId)
                .containsExactlyInAnyOrder(PROVIDER_ID, OTHER_ID);
        assertThat(following).allMatch(item -> item.getNickname() != null);
    }

    private CreateMomentRequest momentRequest(String content) {
        CreateMomentRequest request = new CreateMomentRequest();
        request.setTitle("标题");
        request.setContent(content);
        request.setImageDataList(List.of("img-1"));
        return request;
    }

    private void insertUser(Long userId, String nickname, String role, String bio) {
        jdbcTemplate.update("""
                INSERT INTO users (id, nickname, current_role, bio, status, credit_score, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'ACTIVE', 80.00, NOW(), NOW())
                ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)
                """, userId, nickname, role, bio);
    }

    private void insertProviderProfile(Long userId) {
        jdbcTemplate.update("""
                INSERT INTO provider_profiles (
                    user_id, service_type, display_name, bio, city_code, city_area,
                    price_min, price_max, accepting_orders, avg_rating, completed_orders,
                    audit_status, age, equipment, created_at, updated_at
                )
                VALUES (?, 'PORTRAIT', 'Provider Display', 'provider profile bio', '110000', '核心城区',
                        199.00, 499.00, TRUE, 4.90, 18, 'APPROVED', 28, 'Sony A7R', NOW(), NOW())
                ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)
                """, userId);
    }

    private void createMyBatisPlusTables() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS provider_profiles (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    service_type VARCHAR(50),
                    display_name VARCHAR(64),
                    bio VARCHAR(500),
                    city_code VARCHAR(32),
                    city_area VARCHAR(64),
                    price_min DECIMAL(10,2),
                    price_max DECIMAL(10,2),
                    accepting_orders BOOLEAN,
                    avg_rating DECIMAL(3,2),
                    completed_orders INT,
                    audit_status VARCHAR(20),
                    age INT,
                    equipment VARCHAR(500),
                    provider_avatar_file_id BIGINT NULL,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS style_tags (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(64) NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS provider_style_tags (
                    provider_profile_id BIGINT NOT NULL,
                    tag_id BIGINT NOT NULL
                )
                """);
    }
}
