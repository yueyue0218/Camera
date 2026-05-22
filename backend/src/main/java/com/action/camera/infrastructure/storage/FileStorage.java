package com.action.camera.infrastructure.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * 文件存储抽象（ADR-002）。
 * 业务代码只认这个接口，不关心文件实际存哪。
 * 现在是本地实现，以后可加云存储实现而不改业务代码。
 */
public interface FileStorage {

    /** 存文件，返回唯一 fileKey（用来以后定位/访问该文件） */
    String store(MultipartFile file);

    /** 按 fileKey 删除文件 */
    void delete(String fileKey);
}