import { PortraTheme } from '../../theme/PortraTheme';
import { OrderWorkflow } from './OrderWorkflow';

@Component
export struct MockPaymentConfirm {
  @Prop amountCent: number = 0;
  @Prop busy: boolean = false;
  onCancel?: () => void;
  onConfirm?: () => void;

  build() {
    Column({ space: 16 }) {
      Text('支付').fontSize(18).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      Row() {
        Text('约拍费用').fontSize(14).fontColor(PortraTheme.secondaryText)
        Blank()
        Text(OrderWorkflow.money(this.amountCent)).fontSize(20).fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
      }.width('100%')
      Row({ space: 12 }) {
        Button('取消').height(46).layoutWeight(1).enabled(!this.busy)
          .backgroundColor(PortraTheme.pageBackgroundDeep).fontColor(PortraTheme.primaryText)
          .onClick(() => this.onCancel?.())
        Button(this.busy ? '处理中' : '确认支付').height(46).layoutWeight(1).enabled(!this.busy)
          .backgroundColor(PortraTheme.primary).onClick(() => this.onConfirm?.())
      }.width('100%')
    }
    .width('100%').alignItems(HorizontalAlign.Start).padding(20)
    .backgroundColor(PortraTheme.surface).borderRadius(8)
  }
}
