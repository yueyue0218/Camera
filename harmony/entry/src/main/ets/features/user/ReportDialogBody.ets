import { PortraTheme } from '../../theme/PortraTheme';

/** Presentation only; the shared ReportPanel owns every request and reliability guard. */
@Component
export struct ReportDialogBody {
  @Prop reason: string = ''; @Prop description: string = ''; @Prop busy: boolean = false;
  @Prop error: string = ''; groupKey: string = 'report';
  onReason?: (value:string)=>void;onDescription?: (value:string)=>void;onCancel?:()=>void;onSubmit?:()=>void;
  private readonly reasons: string[] = ['虚假或误导性信息','广告或垃圾信息','侵权或盗用他人作品','骚扰或不当行为','其他违规行为'];
  build() {
    Column() {
      Row({space:12}) {
        Text('举报此内容').fontSize(21).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).layoutWeight(1)
        Button('×').width(44).height(44).padding(0).fontSize(25).fontColor(PortraTheme.secondaryText).backgroundColor(Color.Transparent)
          .accessibilityText('关闭举报').onClick(()=>this.onCancel?.())
      }.width('100%').padding({left:20,right:12,top:14,bottom:12})
      Divider().color(PortraTheme.border)
      Scroll() {
        Column({space:12}) {
          Text('请选择举报原因，平台管理员将根据实际情况核查处理。').fontSize(14).lineHeight(22).fontColor(PortraTheme.secondaryText)
          if(this.error){Text(this.error).width('100%').padding(12).fontSize(13).fontColor(PortraTheme.danger).backgroundColor(PortraTheme.accentSoft).borderRadius(10)}
          Text('举报原因').fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          ForEach(this.reasons,(reason:string)=>{
            Row({space:10}) {
              Radio({value:reason,group:this.groupKey}).checked(this.reason===reason).enabled(!this.busy)
                .onChange((checked:boolean)=>{if(checked){this.onReason?.(reason);}})
              Text(reason).fontSize(14).fontColor(PortraTheme.primaryText).layoutWeight(1)
            }.width('100%').constraintSize({minHeight:48}).onClick(()=>{if(!this.busy){this.onReason?.(reason);}})
          },(reason:string)=>reason)
          Text('补充说明（选填）').fontSize(14).fontColor(PortraTheme.primaryText)
          TextArea({text:this.description,placeholder:'补充说明（选填）'}).width('100%').height(130).maxLength(200).fontSize(15)
            .padding(12).backgroundColor(PortraTheme.surface).border({width:1,color:PortraTheme.border}).borderRadius(12)
            .enabled(!this.busy).onChange((value:string)=>this.onDescription?.(value))
          Text(`还可输入 ${200-this.description.length} 字`).width('100%').textAlign(TextAlign.End).fontSize(12).fontColor(PortraTheme.secondaryText)
          if(this.busy){Text('正在提交，请等待服务器确认…').fontSize(13).fontColor(PortraTheme.secondaryText)}
        }.width('100%').alignItems(HorizontalAlign.Start).padding(20)
      }.width('100%').layoutWeight(1).align(Alignment.TopStart).scrollBar(BarState.Auto)
      Divider().color(PortraTheme.border)
      Row({space:12}) {
        Button('取消').layoutWeight(1).constraintSize({minHeight:48}).fontSize(14).fontColor(PortraTheme.secondaryText)
          .backgroundColor(PortraTheme.surface).border({width:1,color:PortraTheme.border}).borderRadius(12).enabled(!this.busy).onClick(()=>this.onCancel?.())
        Button(this.busy?'提交中…':'提交举报').layoutWeight(1).constraintSize({minHeight:48}).fontSize(14).fontColor(PortraTheme.white)
          .backgroundColor(PortraTheme.primary).borderRadius(12).enabled(!this.busy&&this.reason.length>0).onClick(()=>this.onSubmit?.())
      }.width('100%').padding({left:20,right:20,top:14,bottom:28}).backgroundColor(PortraTheme.pageBackground)
    }.width('100%').height('100%').backgroundColor(PortraTheme.surface)
  }
}
