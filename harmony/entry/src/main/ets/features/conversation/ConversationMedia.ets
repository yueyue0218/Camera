import { common } from '@kit.AbilityKit';
import { camera, cameraPicker } from '@kit.CameraKit';
import { fileIo, picker } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';

export interface SelectedMessageFile {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
  readonly messageType: string;
}

export class ConversationMedia {
  static async photos(): Promise<SelectedMessageFile[]> {
    const options = new photoAccessHelper.PhotoSelectOptions();
    options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
    options.maxSelectNumber = 9;
    const result = await new photoAccessHelper.PhotoViewPicker().select(options);
    return Promise.all(result.photoUris.map((uri: string, index: number) =>
      ConversationMedia.inspectImage(uri, index)));
  }

  static async camera(context: common.UIAbilityContext): Promise<SelectedMessageFile[]> {
    const result = await cameraPicker.pick(context, [cameraPicker.PickerMediaType.PHOTO],
      { cameraPosition: camera.CameraPosition.CAMERA_POSITION_BACK });
    return result.resultCode === 0 && result.resultUri ?
      [await ConversationMedia.inspectImage(result.resultUri, 0)] : [];
  }

  static async document(context: common.UIAbilityContext): Promise<SelectedMessageFile[]> {
    const options = new picker.DocumentSelectOptions();
    options.maxSelectNumber = 1;
    const uris = await new picker.DocumentViewPicker(context).select(options);
    if (uris.length === 0) return [];
    const uri = uris[0];
    const size = fileIo.statSync(uri).size;
    if (size <= 0 || size > 20 * 1024 * 1024) throw new Error('请选择不超过 20 MB 的文件');
    const raw = uri.split('/').pop()?.split('?')[0] ?? '';
    let name = '文件';
    try { name = decodeURIComponent(raw) || name; } catch { /* Keep the readable fallback. */ }
    name = name.replace(/[\\/\r\n]/g, '_').slice(0, 120);
    const extension = name.split('.').pop()?.toLowerCase() ?? '';
    const mime = extension === 'pdf' ? 'application/pdf' : extension === 'zip' ? 'application/zip' :
      extension === 'txt' ? 'text/plain' : 'application/octet-stream';
    return [{ uri: uri, fileName: name, mimeType: mime, size: size, messageType: 'FILE' }];
  }

  private static async inspectImage(uri: string, index: number): Promise<SelectedMessageFile> {
    const size = fileIo.statSync(uri).size;
    if (size <= 0 || size > 20 * 1024 * 1024) throw new Error('单张照片不能超过 20 MB');
    const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY);
    const source = image.createImageSource(file.fd);
    let mime = '';
    try { mime = (await source.getImageInfo()).mimeType; }
    finally { await source.release(); fileIo.closeSync(file); }
    const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' :
      mime === 'image/webp' ? 'webp' : '';
    if (!extension) throw new Error('请选择 JPG、PNG 或 WebP 照片');
    return { uri: uri, fileName: `photo-${Date.now()}-${index}.${extension}`,
      mimeType: mime, size: size, messageType: 'IMAGE' };
  }

  static async read(file: SelectedMessageFile): Promise<ArrayBuffer> {
    const handle = await fileIo.open(file.uri, fileIo.OpenMode.READ_ONLY);
    try {
      const stat = await fileIo.stat(handle.fd);
      if (stat.size !== file.size || stat.size <= 0 || stat.size > 20 * 1024 * 1024) {
        throw new Error('文件已变化，请重新选择');
      }
      const data = new ArrayBuffer(stat.size);
      const target = new Uint8Array(data);
      let offset = 0;
      while (offset < stat.size) {
        const chunk = new ArrayBuffer(Math.min(256 * 1024, stat.size - offset));
        const count = await fileIo.read(handle.fd, chunk);
        if (count <= 0) throw new Error('文件读取未完成，请重新选择');
        target.set(new Uint8Array(chunk, 0, count), offset);
        offset += count;
      }
      return data;
    } finally { await fileIo.close(handle); }
  }
}
