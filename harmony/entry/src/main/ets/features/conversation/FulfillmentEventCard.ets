import { image } from '@kit.ImageKit';
import { FulfillmentEvent } from './ConversationTimeline';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct FulfillmentEventCard {
  @Prop event: FulfillmentEvent;
  @Prop thumbnails: Map<number, image.PixelMap> = new Map<number, image.PixelMap>();
  onOpen?: () => void;

  build() {
    Column({ space: 8 }) {
      Text(this.event.title).fontSize(13).fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      if (this.event.detail) Text(this.event.detail).fontSize(12).fontColor(PortraTheme.secondaryText)
      if (this.event.photoIds !== undefined && this.event.photoIds.length > 0) {
        Row({ space: 5 }) {
          ForEach(this.event.photoIds, (fileId: number) => {
            if (this.thumbnails.has(fileId)) {
              Image(this.thumbnails.get(fileId)!).width('31%').height(70)
                .objectFit(ImageFit.Cover).borderRadius(6)
            } else {
              Text('照片').width('31%').height(70).fontSize(11).textAlign(TextAlign.Center)
                .fontColor(PortraTheme.secondaryText).backgroundColor('#EEE9E3').borderRadius(6)
            }
          }, (fileId: number) => fileId.toString())
        }.width('100%')
      }
      Button(this.event.openGallery ? '查看照片 ›' : '查看订单 ›')
        .width('100%').height(36).fontSize(12)
        .backgroundColor('#F2F3F5').fontColor(PortraTheme.primary).borderRadius(8)
        .onClick(() => this.onOpen?.())
    }.width('100%').constraintSize({ maxWidth: 275 }).alignItems(HorizontalAlign.Start).padding(13)
      .backgroundColor(PortraTheme.surface).borderRadius(16)
      .border({ width: 1, color: '#ECE9E3' })
  }
}
