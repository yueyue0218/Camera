package com.action.camera.social.repository;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MomentPostRepository extends JpaRepository<MomentPost, Long> {

    List<MomentPost> findByStatusOrderByCreatedAtDesc(MomentStatus status);

    List<MomentPost> findByStatusAndModerationStatusOrderByCreatedAtDesc(
            MomentStatus status, ModerationStatus moderationStatus);

    long countByModerationStatus(ModerationStatus moderationStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from MomentPost m where m.id = :id")
    Optional<MomentPost> findByIdForUpdate(@Param("id") Long id);

    List<MomentPost> findByAuthorIdInAndStatusOrderByCreatedAtDesc(Collection<Long> authorIds, MomentStatus status);

    List<MomentPost> findByAuthorIdInAndStatusAndModerationStatusOrderByCreatedAtDesc(
            Collection<Long> authorIds, MomentStatus status, ModerationStatus moderationStatus);

    List<MomentPost> findByAuthorIdOrderByCreatedAtDesc(Long authorId);

    List<MomentPost> findByAuthorIdAndStatusOrderByCreatedAtDesc(Long authorId, MomentStatus status);

    List<MomentPost> findByAuthorIdAndStatusAndModerationStatusOrderByCreatedAtDesc(
            Long authorId, MomentStatus status, ModerationStatus moderationStatus);

    Optional<MomentPost> findByIdAndStatus(Long id, MomentStatus status);

    long countByAuthorIdAndStatus(Long authorId, MomentStatus status);

    long countByAuthorIdAndStatusAndModerationStatus(
            Long authorId, MomentStatus status, ModerationStatus moderationStatus);

    List<MomentPost> findByAuthorIdAndAuthorRoleAndStatusOrderByCreatedAtDesc(Long authorId, String authorRole, MomentStatus status);

    List<MomentPost> findByAuthorIdAndAuthorRoleAndStatusAndModerationStatusOrderByCreatedAtDesc(
            Long authorId, String authorRole, MomentStatus status, ModerationStatus moderationStatus);

    long countByAuthorIdAndAuthorRoleAndStatus(Long authorId, String authorRole, MomentStatus status);

    long countByAuthorIdAndAuthorRoleAndStatusAndModerationStatus(
            Long authorId, String authorRole, MomentStatus status, ModerationStatus moderationStatus);
}
