import { FulfillmentEvent } from './ConversationTimeline';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct FulfillmentEventCard {
  @Prop event: FulfillmentEvent;
  onOpen?: () => void;

  build() {
    Column({ space: 8 }) {
      Text(this.event.title).fontSize(14).fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      if (this.event.detail) Text(this.event.detail).fontSize(12).fontColor(PortraTheme.secondaryText)
      Button(this.event.openGallery ? '查看照片' : '查看订单')
        .height(40).backgroundColor(PortraTheme.surface).fontColor(PortraTheme.primary)
        .onClick(() => this.onOpen?.())
    }.width('100%').alignItems(HorizontalAlign.Start).padding(12)
      .backgroundColor(PortraTheme.surface).borderRadius(8)
      .border({ width: 1, color: PortraTheme.border })
  }
}
