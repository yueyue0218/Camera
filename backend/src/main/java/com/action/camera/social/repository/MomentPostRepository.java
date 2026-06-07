package com.action.camera.social.repository;

import com.action.camera.social.domain.MomentPost;
import com.action.camera.social.domain.MomentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MomentPostRepository extends JpaRepository<MomentPost, Long> {

    List<MomentPost> findByStatusOrderByCreatedAtDesc(MomentStatus status);

    List<MomentPost> findByAuthorIdInAndStatusOrderByCreatedAtDesc(Collection<Long> authorIds, MomentStatus status);

    List<MomentPost> findByAuthorIdOrderByCreatedAtDesc(Long authorId);

    List<MomentPost> findByAuthorIdAndStatusOrderByCreatedAtDesc(Long authorId, MomentStatus status);

    Optional<MomentPost> findByIdAndStatus(Long id, MomentStatus status);

    long countByAuthorIdAndStatus(Long authorId, MomentStatus status);

    List<MomentPost> findByAuthorIdAndAuthorRoleAndStatusOrderByCreatedAtDesc(Long authorId, String authorRole, MomentStatus status);

    long countByAuthorIdAndAuthorRoleAndStatus(Long authorId, String authorRole, MomentStatus status);
}
