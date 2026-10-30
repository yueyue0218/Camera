import { image } from '@kit.ImageKit';
import { MessageSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct MessageMediaBubble {
  @Prop message: MessageSummary;
  @Prop bitmap: image.PixelMap | null = null;
  @Prop imageFailed: boolean = false;
  onOpen?: () => void;
  onSave?: () => void;

  private sizeLabel(): string {
    const size = this.message.size ?? 0;
    return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` :
      size > 0 ? `${Math.ceil(size / 1024)} KB` : '';
  }

  build() {
    if (this.message.messageType === 'IMAGE') {
      Column() {
        if (this.bitmap !== null) {
          Image(this.bitmap).width('100%').height('100%').objectFit(ImageFit.Contain)
        } else if (this.message.localUri) {
          Image(this.message.localUri).width('100%').height('100%').objectFit(ImageFit.Contain)
        } else {
          Text(this.imageFailed || !this.message.fileId ? '照片暂时无法显示' : '正在打开照片')
            .fontSize(12).fontColor(PortraTheme.secondaryText)
        }
      }
      .width(190).height(190).justifyContent(FlexAlign.Center)
      .backgroundColor(PortraTheme.pageBackgroundDeep).borderRadius(8)
      .onClick(() => this.onOpen?.())
    } else {
      Row({ space: 12 }) {
        Text('▤').fontSize(25).fontColor(PortraTheme.primary)
        Column({ space: 5 }) {
          Text(this.message.fileName || '文件').fontSize(13).fontColor(PortraTheme.primaryText)
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(this.message.messageId < 0 ?
            this.message.deliveryStatus === 'failed' ? '发送失败' : '发送中' :
            this.sizeLabel() ? `${this.sizeLabel()} · 保存文件 ›` : '保存文件 ›')
            .fontSize(11).fontColor(PortraTheme.secondaryText)
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      }
      .width(220).padding(12).backgroundColor(PortraTheme.surface).borderRadius(8)
      .border({ width: 1, color: PortraTheme.border }).onClick(() => this.onSave?.())
    }
  }
}
