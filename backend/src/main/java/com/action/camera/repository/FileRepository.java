package com.action.camera.repository;

import com.action.camera.domain.FileRecord;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FileRepository extends JpaRepository<FileRecord, Long> {
}