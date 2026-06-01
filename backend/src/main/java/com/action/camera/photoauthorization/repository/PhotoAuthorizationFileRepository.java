package com.action.camera.photoauthorization.repository;

import com.action.camera.photoauthorization.entity.PhotoAuthorizationFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PhotoAuthorizationFileRepository extends JpaRepository<PhotoAuthorizationFile, Long> {

    List<PhotoAuthorizationFile> findByAuthorizationIdIn(Collection<Long> authorizationIds);

    List<PhotoAuthorizationFile> findByFileIdIn(Collection<Long> fileIds);
}
