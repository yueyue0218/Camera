import { HttpClient } from './HttpClient';
import { ErrorMapper } from './ErrorMapper';

export type ImageVariant = 'thumbnail' | 'medium' | 'original';

class PendingImage {
  users: number = 0;
  readonly key: string;
  readonly promise: Promise<ArrayBuffer>;
  constructor(key: string, promise: Promise<ArrayBuffer>) { this.key = key; this.promise = promise; }
}

export class ImageLease {
  readonly promise: Promise<ArrayBuffer>;
  readonly release: () => void;
  constructor(promise: Promise<ArrayBuffer>, release: () => void) {
    this.promise = promise; this.release = release;
  }
}

/** Share only in-flight bytes. No persistent private cache; each view owns its PixelMap. */
export class FileImageService {
  private readonly pending: Map<string, PendingImage> = new Map();
  private readonly http: HttpClient;
  constructor(http: HttpClient) { this.http = http; }

  observe(listener: () => void): void { this.http.observeIdentity(listener); }
  unobserve(listener: () => void): void { this.http.unobserveIdentity(listener); }
  epoch(): number { return this.http.getIdentityEpoch(); }

  acquire(fileId: number, variant: ImageVariant): ImageLease {
    if (!Number.isSafeInteger(fileId) || fileId <= 0 ||
      !['thumbnail', 'medium', 'original'].includes(variant)) {
      throw ErrorMapper.config('无效的图片编号或规格');
    }
    const key = `image:${this.epoch()}:${fileId}:${variant}`;
    let pending = this.pending.get(key);
    if (pending === undefined) {
      pending = new PendingImage(key, this.http.getImage(`/files/${fileId}/${variant}`, key));
      this.pending.set(key, pending);
      const entry = pending;
      pending.promise.then(() => this.remove(entry), () => this.remove(entry));
    }
    pending.users++;
    const entry = pending;
    let released = false;
    return new ImageLease(entry.promise, () => {
      if (released) { return; }
      released = true;
      entry.users--;
      if (entry.users === 0 && this.pending.get(key) === entry) {
        this.http.cancelRequest(key);
        this.pending.delete(key);
      }
    });
  }

  private remove(entry: PendingImage): void {
    if (this.pending.get(entry.key) === entry) { this.pending.delete(entry.key); }
  }
}
