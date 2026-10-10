package com.action.camera.social.repository;

import com.action.camera.admin.domain.ModerationStatus;
import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
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

    Page<MomentPost> findByAuthorIdAndAuthorRoleAndStatusAndModerationStatusOrderByCreatedAtDescIdDesc(
            Long authorId, String authorRole, MomentStatus status, ModerationStatus moderationStatus, Pageable pageable);

    @Query(value = """
            select m from MomentPost m join m.likedUserIds likedUserId
            where likedUserId = :userId
              and m.status = :status
              and m.moderationStatus = :moderationStatus
            order by m.createdAt desc, m.id desc
            """,
            countQuery = """
            select count(m) from MomentPost m join m.likedUserIds likedUserId
            where likedUserId = :userId
              and m.status = :status
              and m.moderationStatus = :moderationStatus
            """)
    Page<MomentPost> findLikedByUser(@Param("userId") Long userId,
                                     @Param("status") MomentStatus status,
                                     @Param("moderationStatus") ModerationStatus moderationStatus,
                                     Pageable pageable);

    @Query(value = """
            select m from MomentPost m join m.favoritedUserIds favoritedUserId
            where favoritedUserId = :userId
              and m.status = :status
              and m.moderationStatus = :moderationStatus
            order by m.createdAt desc, m.id desc
            """,
            countQuery = """
            select count(m) from MomentPost m join m.favoritedUserIds favoritedUserId
            where favoritedUserId = :userId
              and m.status = :status
              and m.moderationStatus = :moderationStatus
            """)
    Page<MomentPost> findFavoritedByUser(@Param("userId") Long userId,
                                         @Param("status") MomentStatus status,
                                         @Param("moderationStatus") ModerationStatus moderationStatus,
                                         Pageable pageable);

    @Query("""
            select count(m) from MomentPost m join m.likedUserIds likedUserId
            where m.authorId = :authorId
              and m.authorRole = :authorRole
              and m.status = :status
              and m.moderationStatus = :moderationStatus
            """)
    long countLikesReceived(@Param("authorId") Long authorId,
                            @Param("authorRole") String authorRole,
                            @Param("status") MomentStatus status,
                            @Param("moderationStatus") ModerationStatus moderationStatus);

    @Query("""
            select count(m) from MomentPost m join m.favoritedUserIds favoritedUserId
            where m.authorId = :authorId
              and m.authorRole = :authorRole
              and m.status = :status
              and m.moderationStatus = :moderationStatus
            """)
    long countFavoritesReceived(@Param("authorId") Long authorId,
                                @Param("authorRole") String authorRole,
                                @Param("status") MomentStatus status,
                                @Param("moderationStatus") ModerationStatus moderationStatus);

    long countByAuthorIdAndAuthorRoleAndStatus(Long authorId, String authorRole, MomentStatus status);

    long countByAuthorIdAndAuthorRoleAndStatusAndModerationStatus(
            Long authorId, String authorRole, MomentStatus status, ModerationStatus moderationStatus);
}
