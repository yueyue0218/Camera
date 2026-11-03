import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { fileIo } from '@kit.CoreFileKit';
import { AppClient } from '../app/AppClient';

export class ImageUpload {
  static async pick(bizType: string): Promise<number | undefined> {
    const epoch = AppClient.shared.sessionManager.getSessionVersion();
    const uris = await ImageUpload.select(1);
    if (uris.length === 0) { return undefined; }
    return ImageUpload.upload(uris[0], bizType, epoch);
  }

  static async select(limit: number): Promise<string[]> {
    const picker = new photoAccessHelper.PhotoViewPicker();
    const selection = await picker.select({ MIMEType: photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE,
      maxSelectNumber: Math.max(1, Math.min(9, limit)) });
    return selection.photoUris;
  }

  static async upload(uri: string, bizType: string, epoch: number): Promise<number> {
    if (epoch !== AppClient.shared.sessionManager.getSessionVersion()) { throw new Error('账号已变化，请重新选择'); }
    const file = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
      const stat = await fileIo.stat(file.fd);
      if (stat.size <= 0 || stat.size > 10 * 1024 * 1024) { throw new Error('请选择不超过 10 MB 的图片'); }
      const data = new ArrayBuffer(stat.size);
      let offset = 0;
      while (offset < stat.size) {
        const chunk = new ArrayBuffer(stat.size - offset);
        const count = await fileIo.read(file.fd, chunk);
        if (count <= 0) { throw new Error('图片读取不完整，请重新选择'); }
        new Uint8Array(data).set(new Uint8Array(chunk, 0, count), offset);
        offset += count;
      }
      if (epoch !== AppClient.shared.sessionManager.getSessionVersion()) { throw new Error('账号已变化，请重新选择'); }
      const bytes = new Uint8Array(data);
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = bytes[0] === 82 && bytes[1] === 73 && bytes[8] === 87 && bytes[9] === 69;
      if (!png && !jpg && !webp) { throw new Error('请选择 JPEG、PNG 或 WebP 图片'); }
      const result = await AppClient.shared.apiService.uploadImage(data, bizType,
        png ? 'image/png' : jpg ? 'image/jpeg' : 'image/webp', png ? 'photo.png' : jpg ? 'photo.jpg' : 'photo.webp');
      if (epoch !== AppClient.shared.sessionManager.getSessionVersion() || result === null || !Number.isSafeInteger(result.fileId) || result.fileId <= 0) {
        throw new Error('上传结果已失效，请重试');
      }
      return result.fileId;
    } finally { await fileIo.close(file); }
  }
}
