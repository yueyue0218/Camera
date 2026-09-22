package com.action.camera.infrastructure.storage;

import com.action.camera.image.ImageVariant;
import com.action.camera.image.RenderedImageVariant;
import com.action.camera.image.StoredImageVariant;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;

/**
 * 文件存储抽象（ADR-002）。
 * 业务代码只认这个接口，不关心文件实际存哪。
 * 现在是本地实现，以后可加云存储实现而不改业务代码。
 */
public interface FileStorage {

    /** 存文件，返回唯一 fileKey（用来以后定位/访问该文件） */
    String store(MultipartFile file);

    /** 按 fileKey 读取文件（下载用） */
    Resource load(String fileKey);

    /** 按 fileKey 删除文件 */
    void delete(String fileKey);

    /** 读取已完整发布的图片派生版本。 */
    Optional<StoredImageVariant> loadVariant(Long fileId, ImageVariant variant);

    /** 在确定性路径中原子发布图片派生版本。 */
    StoredImageVariant storeVariantAtomically(
            Long fileId, ImageVariant variant, RenderedImageVariant rendered);
}
