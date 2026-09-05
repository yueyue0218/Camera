package com.action.camera.social.service;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.notification.repository.NotificationRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.domain.UserFollow;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.MomentDto;
import com.action.camera.social.repository.MomentPostRepository;
import com.action.camera.social.repository.UserFollowRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("smoke")
@Transactional
class MomentServiceTest {

    private static final Long AUTHOR_ID = 910101L;
    private static final Long OTHER_USER_ID = 910102L;
    private static final Long ADMIN_ID = 910103L;

    @Autowired
    private MomentService momentService;

    @Autowired
    private MomentPostRepository momentPostRepository;

    @Autowired
    private UserFollowRepository userFollowRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Test
    void createMomentPersistsImagesOrderAndMentions() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CreateMomentRequest request = new CreateMomentRequest();
        request.setTitle("  ");
        request.setContent("  第一条动态内容 ");
        request.setImageDataList(List.of("img-2", "img-1"));
        request.setMentions(Arrays.asList(" @alice ", null, "@bob", "@alice"));

        MomentDto dto = momentService.createMoment(author, request);

        MomentPost saved = momentPostRepository.findById(dto.getMomentId()).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo(MomentStatus.PUBLISHED);
        assertThat(saved.getImages()).hasSize(2);
        assertThat(saved.getImages().get(0).getCover()).isTrue();
        assertThat(saved.getImages().get(1).getCover()).isFalse();
        assertThat(saved.getImageDataList()).containsExactly("img-2", "img-1");
        assertThat(saved.getMentions()).containsExactly("@alice", "@bob");
        assertThat(dto.getTitle()).isNull();
        assertThat(dto.getContent()).isEqualTo("第一条动态内容");
        assertThat(dto.getImageData()).isEqualTo("img-2");
        assertThat(dto.getImageDataList()).containsExactly("img-2", "img-1");
    }

    @Test
    void updateMomentCanReplaceTextAndImages() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        MomentDto created = momentService.createMoment(author, newMomentRequest());

        CreateMomentRequest update = new CreateMomentRequest();
        update.setTitle("更新标题");
        update.setContent("更新正文");
        update.setImageDataList(List.of("img-c", "img-d", "img-e"));
        update.setMentions(List.of("@charlie"));

        MomentDto updated = momentService.updateMoment(created.getMomentId(), author, update);
        MomentPost saved = momentPostRepository.findById(created.getMomentId()).orElseThrow();

        assertThat(saved.getTitle()).isEqualTo("更新标题");
        assertThat(saved.getContent()).isEqualTo("更新正文");
        assertThat(saved.getImageDataList()).containsExactly("img-c", "img-d", "img-e");
        assertThat(updated.getImageDataList()).containsExactly("img-c", "img-d", "img-e");
        assertThat(updated.getStatus()).isEqualTo("PUBLISHED");
    }

    @Test
    void deleteMomentUsesSoftDeleteState() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        MomentDto created = momentService.createMoment(author, newMomentRequest());

        momentService.deleteMoment(created.getMomentId(), author);
        MomentPost deleted = momentPostRepository.findById(created.getMomentId()).orElseThrow();
        assertThat(deleted.getStatus()).isEqualTo(MomentStatus.DELETED);
        assertThat(momentService.listMoments(author, null, null, null))
                .extracting(MomentDto::getMomentId)
                .doesNotContain(created.getMomentId());
    }

    @Test
    void likedAndFavoritedStatePersistsAcrossCalls() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser otherUser = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        MomentDto created = momentService.createMoment(author, newMomentRequest());

        MomentDto liked = momentService.likeMoment(created.getMomentId(), otherUser);
        MomentDto favorited = momentService.favoriteMoment(created.getMomentId(), otherUser);
        MomentPost saved = momentPostRepository.findById(created.getMomentId()).orElseThrow();

        assertThat(liked.isLikedByCurrentUser()).isTrue();
        assertThat(favorited.isFavoritedByCurrentUser()).isTrue();
        assertThat(saved.getLikedUserIds()).contains(OTHER_USER_ID);
        assertThat(saved.getFavoritedUserIds()).contains(OTHER_USER_ID);
    }

    @Test
    void repeatedLikeDoesNotDuplicateNotification() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser otherUser = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        MomentDto created = momentService.createMoment(author, newMomentRequest());

        momentService.likeMoment(created.getMomentId(), otherUser);
        momentService.likeMoment(created.getMomentId(), otherUser);
        momentService.unlikeMoment(created.getMomentId(), otherUser);
        momentService.unlikeMoment(created.getMomentId(), otherUser);

        MomentPost saved = momentPostRepository.findById(created.getMomentId()).orElseThrow();
        assertThat(saved.getLikedUserIds()).doesNotContain(OTHER_USER_ID);
        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(AUTHOR_ID))
                .extracting("type")
                .containsExactly("MOMENT_LIKED");
    }

    @Test
    void selfLikeDoesNotGenerateNotification() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        MomentDto created = momentService.createMoment(author, newMomentRequest());

        momentService.likeMoment(created.getMomentId(), author);

        assertThat(notificationRepository.findByUserIdOrderByCreatedAtDesc(AUTHOR_ID)).isEmpty();
    }

    @Test
    void hiddenMomentCannotBeLiked() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser otherUser = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        MomentDto created = momentService.createMoment(author, newMomentRequest());
        momentService.deleteMoment(created.getMomentId(), author);

        assertThatThrownBy(() -> momentService.toggleLike(created.getMomentId(), otherUser))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    @Test
    void hiddenMomentIsAbsentFromLatestFollowingHotAndAuthorPublicLists() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser viewer = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        MomentDto hidden = momentService.createMoment(author, newMomentRequest());
        hide(hidden.getMomentId());
        userFollowRepository.save(new UserFollow(OTHER_USER_ID, AUTHOR_ID, "CUSTOMER"));

        assertThat(momentService.listMoments(viewer, "latest", null, null))
                .extracting(MomentDto::getMomentId)
                .doesNotContain(hidden.getMomentId());
        assertThat(momentService.listMoments(viewer, "hot", null, null))
                .extracting(MomentDto::getMomentId)
                .doesNotContain(hidden.getMomentId());
        assertThat(momentService.listMoments(viewer, "following", null, null))
                .extracting(MomentDto::getMomentId)
                .doesNotContain(hidden.getMomentId());
        assertThat(momentService.listMoments(viewer, "latest", AUTHOR_ID, "CUSTOMER"))
                .extracting(MomentDto::getMomentId)
                .doesNotContain(hidden.getMomentId());
    }

    @Test
    void hiddenMomentDetailIsNotFoundForOtherUserButVisibleToAuthor() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser viewer = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        CurrentUser admin = new CurrentUser(ADMIN_ID, UserRole.ADMIN, true);
        MomentDto hidden = momentService.createMoment(author, newMomentRequest());
        hide(hidden.getMomentId());

        assertThatThrownBy(() -> momentService.getMoment(hidden.getMomentId(), viewer))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(momentService.getMoment(hidden.getMomentId(), author).getModeration().status())
                .isEqualTo(ModerationStatus.HIDDEN);
        assertThat(momentService.getMoment(hidden.getMomentId(), admin).getModeration().status())
                .isEqualTo(ModerationStatus.HIDDEN);
    }

    @Test
    void hiddenMomentAuthorCanEditAndDeleteWithoutRestoringIt() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        MomentDto hidden = momentService.createMoment(author, newMomentRequest());
        hide(hidden.getMomentId());
        CreateMomentRequest update = newMomentRequest();
        update.setTitle("隐藏状态下编辑");

        MomentDto updated = momentService.updateMoment(hidden.getMomentId(), author, update);

        assertThat(updated.getModeration().status()).isEqualTo(ModerationStatus.HIDDEN);
        assertThat(momentPostRepository.findById(hidden.getMomentId()).orElseThrow().getModerationStatus())
                .isEqualTo(ModerationStatus.HIDDEN);

        momentService.deleteMoment(hidden.getMomentId(), author);

        MomentPost deleted = momentPostRepository.findById(hidden.getMomentId()).orElseThrow();
        assertThat(deleted.getStatus()).isEqualTo(MomentStatus.DELETED);
        assertThat(deleted.getModerationStatus()).isEqualTo(ModerationStatus.HIDDEN);
    }

    @Test
    void hiddenMomentRejectsLikeUnlikeFavoriteUnfavoriteAndToggles() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser viewer = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        MomentDto hidden = momentService.createMoment(author, newMomentRequest());
        hide(hidden.getMomentId());

        assertInteractionBlocked(() -> momentService.toggleLike(hidden.getMomentId(), viewer));
        assertInteractionBlocked(() -> momentService.likeMoment(hidden.getMomentId(), viewer));
        assertInteractionBlocked(() -> momentService.unlikeMoment(hidden.getMomentId(), viewer));
        assertInteractionBlocked(() -> momentService.toggleFavorite(hidden.getMomentId(), viewer));
        assertInteractionBlocked(() -> momentService.favoriteMoment(hidden.getMomentId(), viewer));
        assertInteractionBlocked(() -> momentService.unfavoriteMoment(hidden.getMomentId(), viewer));
    }

    @Test
    void hiddenMomentDoesNotDeleteExistingLikeOrFavoriteRows() {
        CurrentUser author = new CurrentUser(AUTHOR_ID, UserRole.CUSTOMER);
        CurrentUser viewer = new CurrentUser(OTHER_USER_ID, UserRole.PROVIDER);
        MomentDto hidden = momentService.createMoment(author, newMomentRequest());
        momentService.likeMoment(hidden.getMomentId(), viewer);
        momentService.favoriteMoment(hidden.getMomentId(), viewer);
        hide(hidden.getMomentId());

        assertInteractionBlocked(() -> momentService.unlikeMoment(hidden.getMomentId(), viewer));
        assertInteractionBlocked(() -> momentService.unfavoriteMoment(hidden.getMomentId(), viewer));

        MomentPost stored = momentPostRepository.findById(hidden.getMomentId()).orElseThrow();
        assertThat(stored.getLikedUserIds()).containsExactly(OTHER_USER_ID);
        assertThat(stored.getFavoritedUserIds()).containsExactly(OTHER_USER_ID);
    }

    private void hide(Long momentId) {
        MomentPost moment = momentPostRepository.findById(momentId).orElseThrow();
        moment.takeDown(ADMIN_ID, "policy violation", LocalDateTime.now());
        momentPostRepository.saveAndFlush(moment);
    }

    private void assertInteractionBlocked(Runnable action) {
        assertThatThrownBy(action::run)
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATUS_CONFLICT);
    }

    private CreateMomentRequest newMomentRequest() {
        CreateMomentRequest request = new CreateMomentRequest();
        request.setTitle("初始标题");
        request.setContent("初始正文");
        request.setImageData("img-a");
        request.setMentions(List.of("@alice"));
        return request;
    }
}
