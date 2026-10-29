import { EngagementForm, EngagementPolicy } from './EngagementController';
import { PortraTheme } from '../../theme/PortraTheme';

/** Phone sheet body. Header/footer remain reachable while the input region scrolls. */
@Component
export struct EngagementDialogs {
  @Prop form: EngagementForm = new EngagementForm();
  orderId: number = 0;
  onContent?: (value: string)=>void; onRating?: (value: number)=>void; onReason?: (value: string)=>void;
  onClose?: ()=>void; onSubmit?: ()=>void; onVerify?: ()=>void; onKeep?: ()=>void; onDiscard?: ()=>void;
  private title(): string {
    return this.form.mode==='review'?'评价本次合作':this.form.mode==='followup'?'追加追评':
      this.form.mode==='complaint'?'发起评价申诉':this.form.mode==='dispute'?'发起订单申诉':'回复订单申诉';
  }
  private help(): string {
    return this.form.mode==='review'?'评分会影响对方在平台上的合作信用，请基于真实履约体验填写。':
      this.form.mode==='followup'?'补充你对这次合作的后续感受，追评会直接展示在原评价下方。':
      this.form.mode==='complaint'?'请说明你认为评价不实或存在争议的原因，处理结果会记录在本次约拍的评价区。':
      this.form.mode==='dispute'?'请说明本次订单的争议和诉求，平台将按实际情况核查处理。':'请基于真实合作情况补充说明，回复会保留在本次订单申诉记录中。';
  }
  private submitLabel(): string {
    return this.form.mode==='review'?'提交评价':this.form.mode==='followup'?'提交追评':this.form.mode==='reply'?'提交回复':'提交申诉';
  }
  build() {
    Column() {
      Row({space:8}) {
        Text(this.form.discardPrompt?'放弃填写？':this.title()).fontSize(21).fontWeight(FontWeight.Bold)
          .fontColor(PortraTheme.primaryText).layoutWeight(1)
        Button('×').width(44).height(44).padding(0).fontSize(25).fontColor(PortraTheme.secondaryText)
          .backgroundColor(Color.Transparent).accessibilityText('关闭表单').onClick(()=>this.onClose?.())
      }.width('100%').padding({left:20,right:12,top:14,bottom:12})
      Divider().color(PortraTheme.border)
      Scroll() {
        Column({space:16}) {
          if(this.form.discardPrompt) {
            Text('当前内容尚未提交，关闭后将丢弃已填写内容。确定关闭吗？').fontSize(15).fontColor(PortraTheme.primaryText)
            Text('提交结果待核实时，关闭仍会保留防重记录，之后请先核实。').fontSize(13).fontColor(PortraTheme.secondaryText)
          } else {
            Text(`本次约拍 · 订单 #${this.orderId}`).fontSize(12).fontColor(PortraTheme.secondaryText)
            Text(this.help()).width('100%').fontSize(13).lineHeight(21).fontColor(PortraTheme.primary)
              .padding(14).backgroundColor(PortraTheme.primarySoft).borderRadius(12)
            if(this.form.mode==='review') {
              Text('评分').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Row({space:0}) {
                ForEach([1,2,3,4,5],(star:number)=>{
                  Button(star<=this.form.rating?'★':'☆').layoutWeight(1).constraintSize({minHeight:48})
                    .padding(0).fontSize(30).fontColor(PortraTheme.accent).backgroundColor(Color.Transparent)
                    .enabled(!this.form.busy&&!this.form.uncertain).accessibilityText(`${star}星`).onClick(()=>this.onRating?.(star))
                },(star:number)=>star.toString())
              }.width('100%')
            }
            if(this.form.mode==='complaint') {
              Text('申诉原因').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              ForEach(EngagementPolicy.complaintReasons,(reason:string)=>{
                Row({space:10}) {
                  Radio({value:reason,group:'engagement-complaint-reason'}).checked(this.form.reason===reason)
                    .enabled(!this.form.busy&&!this.form.uncertain).onChange((checked:boolean)=>{if(checked){this.onReason?.(reason);}})
                  Text(reason).fontSize(14).fontColor(PortraTheme.primaryText).layoutWeight(1)
                }.width('100%').constraintSize({minHeight:48})
                  .onClick(()=>{if(!this.form.busy&&!this.form.uncertain){this.onReason?.(reason);}})
              },(reason:string)=>reason)
            }
            Text(this.form.mode==='review'?'评价内容':this.form.mode==='followup'?'追评内容':this.form.mode==='complaint'?'补充说明':'申诉说明')
              .fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
            TextArea({text:this.form.content,placeholder:'请基于真实合作情况填写'}).width('100%').height(156)
              .fontSize(15).padding(12).backgroundColor(PortraTheme.surface).borderRadius(12)
              .border({width:1,color:PortraTheme.border}).maxLength(EngagementPolicy.maxLength(this.form.mode,this.form.reason)).enabled(!this.form.busy&&!this.form.uncertain)
              .onChange((value:string)=>this.onContent?.(value))
            Text(`还可输入 ${Math.max(0,EngagementPolicy.maxLength(this.form.mode,this.form.reason)-this.form.content.length)} 字`).fontSize(12).fontColor(PortraTheme.secondaryText).width('100%').textAlign(TextAlign.End)
            if(this.form.error) {
              Text(this.form.error).width('100%').fontSize(13).lineHeight(20).fontColor(PortraTheme.danger)
                .padding(12).backgroundColor(PortraTheme.accentSoft).borderRadius(10)
            }
            if(this.form.busy) { Text('正在提交，请等待服务器确认…').fontSize(13).fontColor(PortraTheme.secondaryText) }
          }
        }.width('100%').alignItems(HorizontalAlign.Start).padding(20)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart).scrollBar(BarState.Auto).edgeEffect(EdgeEffect.Spring)
      Divider().color(PortraTheme.border)
      Row({space:12}) {
        Button(this.form.discardPrompt?'继续填写':'取消').layoutWeight(1).constraintSize({minHeight:48}).fontSize(14)
          .fontColor(PortraTheme.primaryText).backgroundColor(PortraTheme.surface)
          .border({width:1,color:PortraTheme.border}).borderRadius(12).enabled(this.form.discardPrompt||!this.form.busy)
          .onClick(()=>{if(this.form.discardPrompt){this.onKeep?.();}else{this.onClose?.();}})
        Button(this.form.discardPrompt?'放弃填写':this.form.busy?'提交中…':this.form.uncertain?'核实结果':this.submitLabel())
          .layoutWeight(1).constraintSize({minHeight:48}).fontSize(14).fontWeight(FontWeight.Medium).fontColor(PortraTheme.white)
          .backgroundColor(this.form.discardPrompt||this.form.mode==='complaint'?PortraTheme.danger:PortraTheme.primary).borderRadius(12)
          .enabled(this.form.discardPrompt||(!this.form.busy&&(this.form.uncertain||this.form.content.trim().length>0)))
          .onClick(()=>{if(this.form.discardPrompt){this.onDiscard?.();}else if(this.form.uncertain){this.onVerify?.();}else{this.onSubmit?.();}})
      }.width('100%').padding({left:20,right:20,top:14,bottom:28}).backgroundColor(PortraTheme.pageBackground)
    }.width('100%').height('100%').backgroundColor(PortraTheme.surface)
  }
}
