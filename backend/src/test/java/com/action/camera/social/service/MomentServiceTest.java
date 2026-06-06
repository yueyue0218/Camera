package com.action.camera.social.service;

import com.action.camera.common.ErrorCode;
import com.action.camera.common.exception.BusinessException;
import com.action.camera.common.security.CurrentUser;
import com.action.camera.common.security.UserRole;
import com.action.camera.notification.repository.NotificationRepository;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import com.action.camera.social.dto.CreateMomentRequest;
import com.action.camera.social.dto.MomentDto;
import com.action.camera.social.repository.MomentPostRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("smoke")
@Transactional
class MomentServiceTest {

    private static final Long AUTHOR_ID = 910101L;
    private static final Long OTHER_USER_ID = 910102L;

    @Autowired
    private MomentService momentService;

    @Autowired
    private MomentPostRepository momentPostRepository;

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

    private CreateMomentRequest newMomentRequest() {
        CreateMomentRequest request = new CreateMomentRequest();
        request.setTitle("初始标题");
        request.setContent("初始正文");
        request.setImageData("img-a");
        request.setMentions(List.of("@alice"));
        return request;
    }
}
