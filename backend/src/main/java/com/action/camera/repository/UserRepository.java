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

    boolean existsByStudentNo(String studentNo);

    Optional<User> findByStudentNo(String studentNo);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select u from User u
            where u.status = 'ACTIVE'
              and (u.currentRole = 'ADMIN' or exists (
                  select binding.id from UserRoleBinding binding
                  where binding.userId = u.id and binding.role = 'ADMIN'
              ))
            order by u.id
            """)
    List<User> findActiveAdministratorsForUpdate();
}
