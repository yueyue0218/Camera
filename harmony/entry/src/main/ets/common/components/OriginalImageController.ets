import { image } from '@kit.ImageKit';
import { FileImageService, ImageLease } from '../../network/FileImageService';
import { PortraError } from '../../network/ErrorMapper';

export class OriginalImageState {
  fileId: number = 0;
  status: string = 'unavailable';
  message: string = '原图不可用';
  pixels?: image.PixelMap;
}

/** Preview-local decoded cache; all bytes still go through FileImageService authentication. */
export class OriginalImageController {
  private readonly cache: Map<number, image.PixelMap> = new Map();
  private generation: number = 0;
  private fileId: number = 0;
  private lease?: ImageLease;
  private state: OriginalImageState = new OriginalImageState();
  private disposed: boolean = false;
  private readonly identityChanged: () => void = () => {
    if (this.disposed) { return; }
    this.cancel();
    this.clearCache();
    this.publish('idle', '查看原图');
  };

  private readonly service: FileImageService;
  private readonly decode: (bytes: ArrayBuffer) => Promise<image.PixelMap>;
  private readonly onChange: (state: OriginalImageState) => void;

  constructor(service: FileImageService,
    decode: (bytes: ArrayBuffer) => Promise<image.PixelMap>,
    onChange: (state: OriginalImageState) => void) {
    this.service = service; this.decode = decode; this.onChange = onChange;
    service.observe(this.identityChanged);
  }

  select(fileId: number): void {
    if (this.disposed) { return; }
    this.cancel();
    this.fileId = Number.isSafeInteger(fileId) && fileId > 0 ? fileId : 0;
    const cached = this.cache.get(this.fileId);
    if (cached !== undefined) {
      this.cache.delete(this.fileId);
      this.cache.set(this.fileId, cached);
    }
    this.publish(cached ? 'ready' : 'idle', cached ? '已加载原图' : '查看原图', cached);
  }

  async load(): Promise<void> {
    if (this.disposed || this.fileId === 0 || this.state.status === 'loading' || this.state.status === 'ready') { return; }
    const id = this.fileId;
    const version = ++this.generation;
    const epoch = this.service.epoch();
    this.publish('loading', '原图加载中…');
    let lease: ImageLease | undefined;
    let pixels: image.PixelMap | undefined;
    try {
      lease = this.service.acquire(id, 'original');
      this.lease = lease;
      const bytes = await lease.promise;
      if (!this.current(version, epoch)) { return; }
      pixels = await this.decode(bytes);
      if (!this.current(version, epoch)) { pixels.release().catch(() => {}); return; }
      this.cache.set(id, pixels);
      // At most two decoded originals (<= 2560px on the long edge each).
      while (this.cache.size > 2) {
        const oldest: number = Array.from(this.cache.keys())[0];
        this.cache.get(oldest)?.release().catch(() => {});
        this.cache.delete(oldest);
      }
      this.publish('ready', '已加载原图', pixels);
    } catch (error) {
      if (!this.current(version, epoch)) { return; }
      const mapped = error as PortraError;
      const reason = mapped.httpStatus === 401 || mapped.businessCode === 40101 ? '请登录后重试原图' :
        mapped.httpStatus === 403 || mapped.businessCode === 40301 ? '无权限查看原图 · 重试' :
        mapped.httpStatus === 404 || mapped.businessCode === 40401 ? '原图不存在 · 重试' : '原图加载失败，点击重试';
      this.publish('error', reason);
    } finally {
      lease?.release();
      if (version === this.generation) { this.lease = undefined; }
    }
  }

  // Invalidate and cancel immediately; retain displayed pixels until the cover has detached.
  stop(): void {
    if (this.disposed) { return; }
    this.disposed = true;
    this.service.unobserve(this.identityChanged);
    this.cancel();
  }
  dispose(): void {
    this.stop();
    this.clearCache();
  }
  private current(version: number, epoch: number): boolean {
    return !this.disposed && version === this.generation && epoch === this.service.epoch();
  }
  private cancel(): void { this.generation++; this.lease?.release(); this.lease = undefined; }
  private clearCache(): void {
    this.cache.forEach((pixels: image.PixelMap) => pixels.release().catch(() => {}));
    this.cache.clear();
  }
  private publish(status: string, message: string, pixels?: image.PixelMap): void {
    const next = new OriginalImageState();
    next.fileId = this.fileId;
    next.status = this.fileId === 0 ? 'unavailable' : status;
    next.message = this.fileId === 0 ? '原图不可用' : message;
    next.pixels = pixels;
    this.state = next;
    this.onChange(next);
  }
}
