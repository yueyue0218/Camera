import { OrderSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { OrderWorkflow } from './OrderWorkflow';
import { QuoteWorkflow } from './QuoteWorkflow';

@Component
export struct OrderEventCard {
  @Prop order: OrderSummary;
  @Prop userId: number = 0;
  onOpen?: () => void;
  onPay?: () => void;
  onOpenGallery?: () => void;
  onOpenUpload?: () => void;

  build() {
    Column({ space: 9 }) {
      Row() {
        Text('约拍订单').fontSize(13).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
        Blank()
        Text(OrderWorkflow.status(this.order.status)).fontSize(12)
          .fontColor(this.order.status === 'PENDING_PAYMENT' ? PortraTheme.attention :
            this.order.status === 'COMPLETED' ? PortraTheme.success : PortraTheme.secondaryText)
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor(PortraTheme.primarySoft).borderRadius(12)
      }.width('100%')
      Text(`${this.order.shootLocation ?? '约拍'} · ${OrderWorkflow.money(this.order.amountCent)} · ${QuoteWorkflow.dateInput(this.order.shootStartTime ?? '')}`)
        .fontSize(12).fontColor(PortraTheme.secondaryText).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
      Button('查看订单 ›').width('100%').height(36).fontSize(12)
        .backgroundColor('#F2F3F5').fontColor(PortraTheme.primary)
        .borderRadius(8).onClick(() => this.onOpen?.())
    }
    .width('100%').constraintSize({ maxWidth: 275 }).alignItems(HorizontalAlign.Start).padding(13)
    .backgroundColor(PortraTheme.surface).borderRadius(16)
    .border({ width: 1, color: '#ECE9E3' })
  }
}
