import { QuoteSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { QuoteWorkflow } from './QuoteWorkflow';
import { OrderWorkflow } from './OrderWorkflow';

@Component
export struct QuoteEventCard {
  @Prop quote: QuoteSummary;
  onOpen?: () => void;

  build() {
    Column({ space: 9 }) {
      Row() {
        Text('正式报价').fontSize(13).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
        Blank()
        Text(QuoteWorkflow.status(this.quote)).fontSize(12)
          .fontColor(this.quote.status === 'PENDING_CONFIRM' ? PortraTheme.attention :
            this.quote.status === 'CONFIRMED' ? PortraTheme.success : PortraTheme.secondaryText)
          .padding({ left: 8, right: 8, top: 4, bottom: 4 })
          .backgroundColor(PortraTheme.primarySoft).borderRadius(12)
      }.width('100%')
      Text(`${this.quote.location} · ${OrderWorkflow.money(this.quote.amountCent)} · ${QuoteWorkflow.dateInput(this.quote.shootStartTime)}`)
        .fontSize(12).fontColor(PortraTheme.secondaryText)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
      Button('查看报价 ›').width('100%').height(36).fontSize(12)
        .backgroundColor('#F2F3F5').fontColor(PortraTheme.primary)
        .borderRadius(8).onClick(() => this.onOpen?.())
    }
    .width('100%').constraintSize({ maxWidth: 275 }).alignItems(HorizontalAlign.Start).padding(13)
    .backgroundColor(PortraTheme.surface).borderRadius(16)
    .border({ width: 1, color: '#ECE9E3' })
  }
}
