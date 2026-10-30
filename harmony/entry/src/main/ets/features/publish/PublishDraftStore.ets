import { common } from '@kit.AbilityKit';
import { preferences } from '@kit.ArkData';
import { fileIo } from '@kit.CoreFileKit';
import { EnvironmentConfig } from '../../common/config/EnvironmentConfig';

export class PublishDraftStore {
  private readonly key: string;
  private readonly context: common.UIAbilityContext;
  constructor(context: common.UIAbilityContext, userId: number, role: string, contentId: number) {
    this.context = context;
    const env = EnvironmentConfig.current();
    this.key = `${env.cacheNamespace}:${env.baseUrl}:${userId}:${role}:${contentId}`;
  }
  read(): string {
    const value = preferences.getPreferencesSync(this.context, { name: 'portra_publish_drafts_v47' }).getSync(this.key, '');
    return typeof value === 'string' ? value : '';
  }
  write(value: string): void {
    const store = preferences.getPreferencesSync(this.context, { name: 'portra_publish_drafts_v47' });
    store.putSync(this.key, value);
    store.flushSync();
  }
  clear(): void {
    const store = preferences.getPreferencesSync(this.context, { name: 'portra_publish_drafts_v47' });
    store.deleteSync(this.key);
    store.flushSync();
  }
  async keepPhoto(uri: string): Promise<string> {
    const folder = this.context.filesDir + '/publish-drafts';
    if (!fileIo.accessSync(folder)) { fileIo.mkdirSync(folder, true); }
    const target = folder + '/' + Date.now() + '-' + Math.floor(Math.random() * 100000000) + '.photo';
    const source = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
      const stat = await fileIo.stat(source.fd);
      if (stat.size <= 0 || stat.size > 10 * 1024 * 1024) { throw new Error('请选择不超过 10 MB 的图片'); }
      await fileIo.copyFile(source.fd, target);
      return 'file://' + target;
    } catch (error) {
      this.removePhoto('file://' + target);
      throw new Error((error as Error).message || '图片保存失败，请重新选择');
    } finally { await fileIo.close(source); }
  }
  hasPhoto(uri: string): boolean {
    if (!this.ownsPhoto(uri)) { return false; }
    try { return fileIo.accessSync(uri.slice(7)); } catch { return false; }
  }
  private ownsPhoto(uri: string): boolean {
    const prefix = 'file://' + this.context.filesDir + '/publish-drafts/';
    return uri.startsWith(prefix) && /^\d+-\d+\.photo$/.test(uri.slice(prefix.length));
  }
  removePhoto(uri: string): void {
    if (!this.ownsPhoto(uri)) { return; }
    try { fileIo.unlinkSync(uri.slice(7)); } catch { /* Already removed or retained for a later cleanup. */ }
  }
}
