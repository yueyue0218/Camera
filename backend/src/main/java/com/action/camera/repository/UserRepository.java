package com.action.camera.repository;

import com.action.camera.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    boolean existsByStudentNo(String studentNo);

    Optional<User> findByStudentNo(String studentNo);
}
