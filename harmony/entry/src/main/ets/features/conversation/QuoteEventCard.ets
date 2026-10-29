import { QuoteSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { QuoteWorkflow } from './QuoteWorkflow';
import { OrderWorkflow } from './OrderWorkflow';

@Component
export struct QuoteEventCard {
  @Prop quote: QuoteSummary;
  onOpen?: () => void;

  build() {
    Column({ space: 8 }) {
      Row() {
        Text('约拍报价').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
        Blank()
        Text(QuoteWorkflow.status(this.quote)).fontSize(12).fontColor(PortraTheme.secondaryText)
      }.width('100%')
      Text(OrderWorkflow.money(this.quote.amountCent)).fontSize(22).fontWeight(FontWeight.Bold)
        .fontColor(PortraTheme.primaryText)
      Text(QuoteWorkflow.dateInput(this.quote.shootStartTime))
        .fontSize(12).fontColor(PortraTheme.secondaryText)
      Text(this.quote.location).fontSize(12).fontColor(PortraTheme.secondaryText)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      Divider().color(PortraTheme.border)
      Row() {
        Blank()
        Text('查看报价  ›').fontSize(13).fontColor(PortraTheme.primary)
      }.width('100%')
    }
    .width('100%').alignItems(HorizontalAlign.Start).padding(14)
    .backgroundColor(PortraTheme.surface).borderRadius(8)
    .border({ width: 1, color: PortraTheme.border })
    .onClick(() => this.onOpen?.())
  }
}
