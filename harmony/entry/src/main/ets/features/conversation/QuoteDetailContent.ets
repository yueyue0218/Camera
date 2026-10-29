import { QuoteSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { OrderWorkflow } from './OrderWorkflow';
import { QuoteWorkflow } from './QuoteWorkflow';

@Component
export struct QuoteDetailContent {
  @Prop quote: QuoteSummary;

  @Builder
  private Detail(label: string, value: string) {
    Row({ space: 12 }) {
      Text(label).fontSize(13).fontColor(PortraTheme.secondaryText).width(72)
      Text(value).fontSize(14).fontColor(PortraTheme.primaryText).layoutWeight(1)
    }.width('100%').alignItems(VerticalAlign.Top)
  }

  build() {
    Column({ space: 18 }) {
      Column({ space: 4 }) {
        Text('约拍报价').fontSize(13).fontColor(PortraTheme.secondaryText)
        Text(OrderWorkflow.money(this.quote.amountCent)).fontSize(30).fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText)
        Text(QuoteWorkflow.status(this.quote)).fontSize(13).fontColor(PortraTheme.primary)
      }.alignItems(HorizontalAlign.Start).width('100%')
      Divider().color(PortraTheme.border)
      Text('拍摄安排').fontSize(16).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      this.Detail('开始', QuoteWorkflow.dateInput(this.quote.shootStartTime))
      this.Detail('结束', QuoteWorkflow.dateInput(this.quote.shootEndTime))
      this.Detail('地点', this.quote.location)
      Divider().color(PortraTheme.border)
      Text('服务内容').fontSize(16).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      Text(this.quote.serviceContent).fontSize(14).fontColor(PortraTheme.primaryText)
      this.Detail('原片', `${this.quote.originalCount ?? 0} 张`)
      this.Detail('精修', `${this.quote.refinedCount ?? 0} 张`)
      Divider().color(PortraTheme.border)
      Text('交付约定').fontSize(16).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      this.Detail('最晚交付', QuoteWorkflow.dateInput(this.quote.deliveryDeadline))
      this.Detail('图片使用', this.quote.photoUsageScope === 'PERSONAL_ONLY' ? '仅供个人使用' : '双方另行约定')
      if (this.quote.terms) this.Detail('服务条款', this.quote.terms)
      if (this.quote.contractTerms) this.Detail('其他约定', this.quote.contractTerms)
      if (this.quote.remark) this.Detail('备注', this.quote.remark)
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}
