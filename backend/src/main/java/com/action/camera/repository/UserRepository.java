package com.action.camera.repository;

import com.action.camera.domain.User;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("""
            select new com.action.camera.social.dto.SocialUserBriefResponse(
                u.id, u.nickname, u.avatarFileId, u.currentRole, u.bio,
                case when exists (select f.id from UserFollow f
                    where f.followerId = :viewerId and f.followingUserId = u.id)
                    then true else false end)
            from User u where u.id in :userIds
            """)
    List<com.action.camera.social.dto.SocialUserBriefResponse> findSocialBriefs(
            @Param("viewerId") Long viewerId, @Param("userIds") java.util.Collection<Long> userIds);

    boolean existsByStudentNo(String studentNo);

    Optional<User> findByStudentNo(String studentNo);

    boolean existsByMobileHash(String mobileHash);

    Optional<User> findByMobileHash(String mobileHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.mobileHash = :mobileHash")
    Optional<User> findByMobileHashForUpdate(@Param("mobileHash") String mobileHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select u from User u
            where u.status = 'ACTIVE'
              and exists (
                  select binding.id from UserRoleBinding binding
                  where binding.userId = u.id and binding.role = 'ADMIN'
              )
            order by u.id
            """)
    List<User> findActiveAdministratorsForUpdate();
}
