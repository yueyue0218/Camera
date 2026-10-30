import { UiPerf } from '../performance/UiPerf';
import { image } from '@kit.ImageKit';
import { AppClient } from '../../app/AppClient';
import { ImageLease, ImageVariant } from '../../network/FileImageService';
import { PortraError } from '../../network/ErrorMapper';
import { PortraTheme } from '../../theme/PortraTheme';
import { FileImagePolicy, InlineImagePolicy, PublicImagePolicy } from './ComponentPolicy';

/** File IDs use the shared authenticated binary boundary; URL/inline sources retain ArkUI caching. */
@Component
export struct PortraImage {
  @Prop @Watch('reload') source: ResourceStr = '';
  @Prop @Watch('reload') fileId: number = 0;
  @Prop @Watch('reload') variant: ImageVariant = 'thumbnail';
  @Prop contain: boolean = false;
  @Prop imageWidth: Length = 160;
  @Prop imageHeight: Length = 120;
  @Prop cornerRadius: number = PortraTheme.radius;
  @Prop fallbackText: string = '图片暂不可用';
  @Prop contentDescription: string = '图片';
  @Prop allowInlineData: boolean = false;
  @State private loadFailed: boolean = false;

  @State private pixelMap: image.PixelMap | undefined = undefined;
  @State private loading: boolean = false;
  @State private failure: string = '';
  private alive: boolean = false;
  private generation: number = 0;
  private lease?: ImageLease;
  private readonly identityChanged: () => void = () => {
    this.clearImage();
    // HttpClient completes token replacement synchronously before this microtask.
    Promise.resolve().then(() => this.reload());
  };

  aboutToAppear(): void {
    this.alive = true;
    AppClient.shared.fileImages.observe(this.identityChanged);
    this.reload();
  }

  aboutToDisappear(): void {
    this.alive = false;
    AppClient.shared.fileImages.unobserve(this.identityChanged);
    this.clearImage();
  }

  private clearImage(): void {
    this.generation++;
    this.lease?.release();
    this.lease = undefined;
    const old = this.pixelMap;
    this.pixelMap = undefined;
    old?.release().catch(() => {});
  }

  private async reload(): Promise<void> {
    this.clearImage();
    this.loadFailed = false;
    this.failure = '';
    this.loading = false;
    if (!this.alive || this.resolvedFileId() === 0) { return; }
    const version = this.generation;
    const service = AppClient.shared.fileImages;
    const epoch = service.epoch();
    this.loading = true;
    let decoder: image.ImageSource | undefined = undefined;
    let lease: ImageLease | undefined = undefined;
    try {
      lease = service.acquire(this.resolvedFileId(), this.variant);
      this.lease = lease;
      const fetchStart = Date.now();
      const bytes = await lease.promise;
      UiPerf.elapsed('image.bytes.' + this.variant, fetchStart);
      const decodeStart = Date.now();
      if (!this.alive || version !== this.generation || epoch !== service.epoch()) { return; }
      decoder = image.createImageSource(bytes);
      const info = await decoder.getImageInfo();
      // Bound decoded memory, including originals. Preserve aspect ratio.
      const bound = this.variant === 'thumbnail' ? 512 : (this.variant === 'medium' ? 1600 : 2560);
      const scale = Math.min(1, bound / Math.max(info.size.width, info.size.height));
      const pixels = await decoder.createPixelMap({ desiredSize: {
        width: Math.max(1, Math.round(info.size.width * scale)),
        height: Math.max(1, Math.round(info.size.height * scale))
      } });
      if (!this.alive || version !== this.generation || epoch !== service.epoch()) {
        await pixels.release();
        return;
      }
      this.pixelMap = pixels;
      UiPerf.elapsed('image.decode.' + this.variant, decodeStart);
    } catch (error) {
      if (this.alive && version === this.generation && epoch === service.epoch()) {
        const mapped = error as PortraError;
        this.failure = mapped.httpStatus === 403 || mapped.businessCode === 40301 ? '无权限查看图片' :
          (mapped.httpStatus === 404 || mapped.businessCode === 40401 ? '图片不存在' :
          (mapped.httpStatus === 401 || mapped.businessCode === 40101 ? '请登录后查看图片' : '图片加载失败'));
        this.loadFailed = true;
      }
    } finally {
      decoder?.release().catch(() => {});
      lease?.release();
      if (version === this.generation) { this.loading = false; }
    }
  }

  private resolvedFileId(): number {
    return this.fileId !== 0 ? this.fileId :
      (typeof this.source === 'string' ? FileImagePolicy.id(this.source) : 0);
  }

  private canLoad(): boolean {
    if (typeof this.source !== 'string') {
      return true;
    }
    return this.allowInlineData ? InlineImagePolicy.accepts(this.source) : PublicImagePolicy.accepts(this.source);
  }

  build() {
    Stack() {
      if (this.resolvedFileId() !== 0 && this.pixelMap !== undefined) {
        Image(this.pixelMap)
          .width('100%').height('100%')
          .objectFit(this.contain ? ImageFit.Contain : ImageFit.Cover)
          .accessibilityText(this.contentDescription)
      } else if (this.resolvedFileId() === 0 && this.canLoad()) {
        Image(this.source)
          .width('100%')
          .height('100%')
          .objectFit(this.contain ? ImageFit.Contain : ImageFit.Cover)
          .opacity(this.loadFailed ? 0 : 1)
          .accessibilityText(this.contentDescription)
          .onComplete(() => {
            this.loadFailed = false;
          })
          .onError((_error: ImageError) => {
            this.loadFailed = true;
          })
      }

      if (this.loading) {
        Text('图片加载中').fontSize(12).fontColor(PortraTheme.secondaryText)
      } else if (this.resolvedFileId() !== 0 && this.loadFailed) {
        Column({ space: 4 }) {
          Text(this.failure).fontSize(12).fontColor(PortraTheme.secondaryText)
          Button('重试图片').fontSize(11).height(28)
            .onClick(() => this.reload())
        }
      } else if (this.resolvedFileId() === 0 && (!this.canLoad() || this.loadFailed)) {
        Text(this.fallbackText)
          .fontSize(12)
          .fontColor(PortraTheme.secondaryText)
          .textAlign(TextAlign.Center)
          .padding(8)
      }
    }
    .width(this.imageWidth)
    .height(this.imageHeight)
    .backgroundColor(PortraTheme.pageBackground)
    .borderRadius(this.cornerRadius)
    .clip(true)
  }
}
