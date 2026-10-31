import { common } from '@kit.AbilityKit';
import { request } from '@kit.BasicServicesKit';
import { fileIo, picker } from '@kit.CoreFileKit';
import { image } from '@kit.ImageKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { EnvironmentConfig } from '../../common/config/EnvironmentConfig';

export interface SelectedDeliveryFile {
  readonly uri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly size: number;
}

interface TransferHeaders {
  Authorization: string;
}

export class DeliveryTransfer {
  private task?: request.agent.Task;

  static async pickPhotos(remaining: number): Promise<SelectedDeliveryFile[]> {
    const options = new photoAccessHelper.PhotoSelectOptions();
    options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
    options.maxSelectNumber = remaining;
    const result = await new photoAccessHelper.PhotoViewPicker().select(options);
    const files: SelectedDeliveryFile[] = [];
    for (let index = 0; index < result.photoUris.length; index++) {
      files.push(await DeliveryTransfer.inspectImage(result.photoUris[index], index));
    }
    return files;
  }

  static async pickZip(context: common.UIAbilityContext, remaining: number): Promise<SelectedDeliveryFile[]> {
    const options = new picker.DocumentSelectOptions();
    options.fileSuffixFilters = ['.zip'];
    options.maxSelectNumber = remaining;
    const uris = await new picker.DocumentViewPicker(context).select(options);
    return uris.map((uri: string, index: number) => {
      const name = decodeURIComponent(uri.split('/').pop()?.split('?')[0] ?? `works-${index}.zip`);
      const size = fileIo.statSync(uri).size;
      if (!name.toLowerCase().endsWith('.zip') || size <= 0 || size > 200 * 1024 * 1024) {
        throw new Error('请选择不超过 200 MB 的 ZIP 文件');
      }
      return { uri: uri, fileName: name, mimeType: 'application/zip', size: size } as SelectedDeliveryFile;
    });
  }

  private static async inspectImage(uri: string, index: number): Promise<SelectedDeliveryFile> {
    const size = fileIo.statSync(uri).size;
    if (size <= 0 || size > 20 * 1024 * 1024) throw new Error('单张照片不能超过 20 MB');
    const file = fileIo.openSync(uri, fileIo.OpenMode.READ_ONLY);
    const source = image.createImageSource(file.fd);
    let mime = '';
    try {
      mime = (await source.getImageInfo()).mimeType;
    } finally {
      await source.release();
      fileIo.closeSync(file);
    }
    const extension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' :
      mime === 'image/webp' ? 'webp' : '';
    if (!extension) throw new Error('请选择 JPG、PNG 或 WebP 照片');
    return { uri: uri, fileName: `photo-${Date.now()}-${index}.${extension}`,
      mimeType: mime, size: size };
  }

  async upload(context: common.UIAbilityContext, orderId: number, files: SelectedDeliveryFile[],
    accessToken: string, onProgress: (percent: number) => void): Promise<void> {
    const profile = EnvironmentConfig.current();
    if (!EnvironmentConfig.isUsable(profile) || !Number.isSafeInteger(orderId) || orderId <= 0 ||
      !accessToken || files.length === 0 || files.length > 20) throw new Error('暂时无法上传照片');
    const specs: request.agent.FileSpec[] = [];
    files.forEach((file: SelectedDeliveryFile) => {
      const spec: request.agent.FileSpec = {
        path: file.uri, filename: file.fileName, contentType: file.mimeType
      };
      specs.push(spec);
    });
    const form: request.agent.FormItem[] = [{ name: 'files', value: specs }];
    const headers: TransferHeaders = { Authorization: `Bearer ${accessToken}` };
    const config: request.agent.Config = {
      action: request.agent.Action.UPLOAD,
      mode: request.agent.Mode.FOREGROUND,
      method: 'POST',
      url: `${profile.baseUrl}/orders/${orderId}/deliveries`,
      headers: headers,
      data: form
    };
    const task = await request.agent.create(context, config);
    this.task = task;
    let status = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        task.on('response', (response: request.agent.HttpResponse) => status = response.statusCode);
        task.on('progress', (progress: request.agent.Progress) => {
          const total = files.reduce((sum: number, file: SelectedDeliveryFile) => sum + file.size, 0);
          const completed = files.slice(0, progress.index).reduce((sum: number, file: SelectedDeliveryFile) =>
            sum + file.size, 0);
          onProgress(Math.min(99, Math.floor((completed + progress.processed) * 100 / total)));
        });
        task.on('completed', (_progress: request.agent.Progress) => {
          if (status >= 200 && status < 300) resolve();
          else reject(new Error('上传未完成，请查看订单状态'));
        });
        task.on('failed', (_progress: request.agent.Progress) => reject(new Error('上传未完成，请查看订单状态')));
        task.start().catch(() => reject(new Error('上传未完成，请查看订单状态')));
      });
    } finally {
      this.task = undefined;
      request.agent.remove(task.tid).catch(() => {});
    }
  }

  async download(context: common.UIAbilityContext, fileId: number, fileName: string,
    accessToken: string, onProgress: (percent: number) => void): Promise<boolean> {
    const profile = EnvironmentConfig.current();
    if (!EnvironmentConfig.isUsable(profile) || !Number.isSafeInteger(fileId) || fileId <= 0 || !accessToken) {
      throw new Error('暂时无法下载作品');
    }
    const cachePath = `${context.cacheDir}/delivery-${fileId}-${Date.now()}.tmp`;
    const headers: TransferHeaders = { Authorization: `Bearer ${accessToken}` };
    const config: request.agent.Config = {
      action: request.agent.Action.DOWNLOAD,
      mode: request.agent.Mode.FOREGROUND,
      method: 'GET',
      url: `${profile.baseUrl}/files/${fileId}/download`,
      headers: headers,
      saveas: cachePath,
      overwrite: true
    };
    let task: request.agent.Task | undefined;
    try {
      task = await request.agent.create(context, config);
      this.task = task;
      let status = 0;
      await new Promise<void>((resolve, reject) => {
        task!.on('response', (response: request.agent.HttpResponse) => status = response.statusCode);
        task!.on('progress', (progress: request.agent.Progress) => {
          const total = progress.sizes[progress.index];
          if (total > 0) onProgress(Math.min(99, Math.floor(progress.processed * 100 / total)));
        });
        task!.on('completed', (_progress: request.agent.Progress) => {
          if (status >= 200 && status < 300) resolve();
          else reject(new Error('下载未完成，请重试'));
        });
        task!.on('failed', (_progress: request.agent.Progress) => reject(new Error('下载未完成，请重试')));
        task!.start().catch(() => reject(new Error('下载未完成，请重试')));
      });
      const options = new picker.DocumentSaveOptions();
      options.newFileNames = [fileName.replace(/[\\/]/g, '_')];
      const targets = await new picker.DocumentViewPicker(context).save(options);
      if (targets.length === 0) return false;
      fileIo.copyFileSync(cachePath, targets[0]);
      return true;
    } finally {
      this.task = undefined;
      if (task !== undefined) request.agent.remove(task.tid).catch(() => {});
      try { fileIo.unlinkSync(cachePath); } catch { /* The transfer may have stopped before creating a file. */ }
    }
  }

  cancel(): void {
    const task = this.task;
    this.task = undefined;
    if (task !== undefined) task.stop().catch(() => {});
  }
}
