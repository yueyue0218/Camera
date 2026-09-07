import { PortraTheme } from '../../theme/PortraTheme';
import { PublicImagePolicy } from './ComponentPolicy';

/**
 * Displays packaged resources or public HTTPS images only.
 * Authenticated file downloads must be fetched by a credential-aware service and must not be passed as a URL here.
 */
@Component
export struct PortraImage {
  @Prop source: ResourceStr = '';
  @Prop imageWidth: number = 160;
  @Prop imageHeight: number = 120;
  @Prop cornerRadius: number = PortraTheme.radius;
  @Prop fallbackText: string = '图片暂不可用';
  @Prop contentDescription: string = '图片';
  @State private loadFailed: boolean = false;

  private canLoad(): boolean {
    if (typeof this.source !== 'string') {
      return true;
    }
    return PublicImagePolicy.accepts(this.source);
  }

  build() {
    Stack() {
      if (this.canLoad()) {
        Image(this.source)
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
          .opacity(this.loadFailed ? 0 : 1)
          .accessibilityText(this.contentDescription)
          .onComplete(() => {
            this.loadFailed = false;
          })
          .onError((_error: ImageError) => {
            this.loadFailed = true;
          })
      }

      if (!this.canLoad() || this.loadFailed) {
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
