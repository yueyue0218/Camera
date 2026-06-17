package com.action.camera.repository;

import com.action.camera.domain.UserRoleBinding;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRoleBindingRepository extends JpaRepository<UserRoleBinding, Long> {

    boolean existsByUserIdAndRole(Long userId, String role);
}
