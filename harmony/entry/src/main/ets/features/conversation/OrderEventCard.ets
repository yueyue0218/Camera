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

  build() {
    Column({ space: 9 }) {
      Row() {
        Text('约拍订单').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
        Blank()
        Text(OrderWorkflow.status(this.order.status)).fontSize(12)
          .fontColor(this.order.status === 'PENDING_PAYMENT' ? PortraTheme.attention :
            this.order.status === 'COMPLETED' ? PortraTheme.success : PortraTheme.secondaryText)
      }.width('100%')
      Text(OrderWorkflow.money(this.order.amountCent)).fontSize(22).fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      Text(QuoteWorkflow.dateInput(this.order.shootStartTime ?? ''))
        .fontSize(12).fontColor(PortraTheme.secondaryText)
      Divider().color(PortraTheme.border)
      Row({ space: 10 }) {
        Button('查看订单').height(42).backgroundColor(PortraTheme.pageBackgroundDeep)
          .fontColor(PortraTheme.primaryText).onClick(() => this.onOpen?.())
        if (OrderWorkflow.canPay(this.order, this.userId)) {
          Button('确认支付').height(42).backgroundColor(PortraTheme.primary)
            .onClick(() => this.onPay?.())
        }
      }
    }
    .width('100%').alignItems(HorizontalAlign.Start).padding(14)
    .backgroundColor(PortraTheme.surface).borderRadius(8)
    .border({ width: 1, color: PortraTheme.border })
  }
}
