package com.action.camera.social.repository;

import com.action.camera.social.domain.UserFollow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserFollowRepository extends JpaRepository<UserFollow, Long> {

    // Legacy (any target_role) — kept for feed/following-scope queries
    boolean existsByFollowerIdAndFollowingUserId(Long followerId, Long followingUserId);

    List<UserFollow> findByFollowerIdOrderByCreatedAtDesc(Long followerId);

    List<UserFollow> findByFollowingUserIdOrderByCreatedAtDesc(Long followingUserId);

    long countByFollowerId(Long followerId);

    long countByFollowingUserId(Long followingUserId);

    @Query("select uf.followingUserId from UserFollow uf where uf.followerId = :followerId")
    List<Long> findFollowingUserIdsByFollowerId(@Param("followerId") Long followerId);

    @Query("select uf.followerId from UserFollow uf where uf.followingUserId = :followingUserId")
    List<Long> findFollowerUserIdsByFollowingUserId(@Param("followingUserId") Long followingUserId);

    // Role-specific variants (STEP 5)
    boolean existsByFollowerIdAndFollowingUserIdAndTargetRole(Long followerId, Long followingUserId, String targetRole);

    Optional<UserFollow> findByFollowerIdAndFollowingUserIdAndTargetRole(Long followerId, Long followingUserId, String targetRole);

    List<UserFollow> findByFollowingUserIdAndTargetRoleOrderByCreatedAtDesc(Long followingUserId, String targetRole);

    List<UserFollow> findByFollowerIdAndTargetRoleOrderByCreatedAtDesc(Long followerId, String targetRole);

    long countByFollowingUserIdAndTargetRole(Long followingUserId, String targetRole);

    long countByFollowerIdAndTargetRole(Long followerId, String targetRole);
}
