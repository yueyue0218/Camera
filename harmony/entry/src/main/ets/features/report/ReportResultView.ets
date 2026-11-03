import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../../app/AppClient';
import { ActivitySessionBinding } from '../notifications/ActivityApiBindings';
import { MomentFeedLifecycle } from '../moments/MomentFeedLifecycle';
import { ReportResultController } from './ReportResultController';
import { ReportResultApiBinding } from './ReportResultApiBinding';
import { ReportResultSnapshot, ReportResultItem, ReportResultFormat } from './ReportResultModels';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct ReportResultView {
  @Prop @Watch('targetChanged') reportId: number = 0;
  onBack?: () => void;
  onRequireLogin?: () => void;
  @State private state: ReportResultSnapshot = new ReportResultSnapshot();
  @State private expandedId: number = 0;
  private controller?: ReportResultController;
  private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false;
  aboutToAppear(): void {
    this.controller=new ReportResultController(new ReportResultApiBinding(AppClient.shared.apiService),
      new ActivitySessionBinding(AppClient.shared.sessionManager),(state:ReportResultSnapshot)=>this.state=state);
  }
  aboutToDisappear(): void {this.lifecycle?.stop();this.lifecycle=undefined;this.controller?.suspend();}
  private targetChanged(): void {this.expandedId=0;if(this.visible){this.controller?.load(this.reportId);}}
  private observe(): void {
    if(this.lifecycle!==undefined){return;}
    try {
      this.lifecycle=new MomentFeedLifecycle(this.getUIContext(),(update?:uiObserver.NavDestinationInfo)=>{
        const navigation=this.queryNavigationInfo();let destination=this.queryNavDestinationInfo();
        if(navigation===undefined||destination===undefined){throw new Error('Navigation unavailable');}
        if(update?.navDestinationId===destination.navDestinationId){destination=update;}
        return destination.index===navigation.pathStack.size()-1&&destination.state!==uiObserver.NavDestinationState.ON_HIDDEN&&
          destination.state!==uiObserver.NavDestinationState.ON_WILL_HIDE&&destination.state!==uiObserver.NavDestinationState.ON_DISAPPEAR&&
          destination.state!==uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
      },(visible:boolean)=>{
        if(this.visible===visible){return;}this.visible=visible;this.expandedId=0;
        if(visible){this.controller?.resume();this.controller?.load(this.reportId);}else{this.controller?.suspend();}
      },()=>{this.controller?.suspend();this.state.error='页面状态监听不可用，请返回后重试。';});
      this.lifecycle.start();
    }catch{this.state.error='页面状态监听不可用，请返回后重试。';}
  }
  private toggle(item:ReportResultItem): void {
    if(this.controller?.canOpen(item.reportId)){this.expandedId=this.expandedId===item.reportId?0:item.reportId;}
  }
  @Builder private Result(item:ReportResultItem) {
    Column({space:16}) {
      Row({space:12}) {
        Text(`举报 #${item.reportId}`).fontSize(18).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).layoutWeight(1)
        Text(item.statusLabel).fontSize(12).fontColor(PortraTheme.primary).padding({left:10,right:10,top:7,bottom:7})
          .backgroundColor(PortraTheme.primarySoft).borderRadius(10)
      }.width('100%')
      Text(`${ReportResultFormat.target(item.targetType)} #${item.targetId}`).fontSize(13).fontColor(PortraTheme.secondaryText)
      Text(item.message).fontSize(15).lineHeight(25).fontColor(PortraTheme.primaryText).width('100%')
      Column({space:8}) {
        Text(`提交时间：${ReportResultFormat.time(item.createdAt)}`).fontSize(12).fontColor(PortraTheme.secondaryText)
        if(item.resolvedAt){Text(`处理时间：${ReportResultFormat.time(item.resolvedAt)}`).fontSize(12).fontColor(PortraTheme.secondaryText)}
      }.alignItems(HorizontalAlign.Start)
      Button(this.expandedId===item.reportId?'收起提交说明':'查看我的提交说明').constraintSize({minHeight:44})
        .fontSize(13).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft).borderRadius(12)
        .onClick(()=>this.toggle(item))
      if(this.expandedId===item.reportId) {
        Column({space:10}) {
          Text(item.reason).fontSize(14).fontColor(PortraTheme.primaryText)
          if(item.description){Text(item.description).fontSize(14).lineHeight(23).fontColor(PortraTheme.secondaryText)}
        }.width('100%').alignItems(HorizontalAlign.Start).padding(16).backgroundColor(PortraTheme.pageBackground).borderRadius(12)
      }
    }.width('100%').alignItems(HorizontalAlign.Start).padding(20).backgroundColor(PortraTheme.surface).borderRadius(20)
      .border({width:1,color:PortraTheme.border})
  }
  build() {
    Column() {
      Row({space:12}) {
        Button('‹').width(44).height(44).fontSize(30).padding(0).backgroundColor(Color.Transparent)
          .fontColor(PortraTheme.primaryText).accessibilityText('返回').onClick(()=>this.onBack?.())
        Column({space:6}) {
          Text('REPORT / PORTRA').fontSize(10).letterSpacing(2).fontColor(PortraTheme.primary)
          Text(this.reportId===0?'我的举报':'举报进度').fontSize(26).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Button('刷新').constraintSize({minWidth:56,minHeight:44}).fontSize(13).backgroundColor(PortraTheme.primarySoft)
          .fontColor(PortraTheme.primary).enabled(!this.state.loading).onClick(()=>this.controller?.load(this.reportId))
      }.width('100%').padding({left:10,right:20,top:20,bottom:22})
      Scroll() {
        Column({space:18}) {
          if(this.state.loginRequired) {
            Text('登录后查看属于你的举报记录').fontSize(15).fontColor(PortraTheme.secondaryText)
            Button('去登录').constraintSize({minHeight:44}).onClick(()=>this.onRequireLogin?.())
          }else if(this.state.loading) {
            LoadingProgress().width(36).height(36).color(PortraTheme.primary).margin({top:36})
            Text('正在读取举报记录…').fontSize(14).fontColor(PortraTheme.secondaryText)
          }else if(this.state.error) {
            Text(this.state.error).fontSize(14).lineHeight(24).fontColor(PortraTheme.danger).padding(20)
              .width('100%').backgroundColor(PortraTheme.surface).borderRadius(18)
          }else {
            Text('这里仅展示当前账号提交的举报及平台反馈。').fontSize(13).lineHeight(22).fontColor(PortraTheme.secondaryText)
            if(this.state.items.length===0){Text('暂无举报记录').fontSize(18).fontColor(PortraTheme.primaryText).margin({top:40})}
            ForEach(this.state.items,(item:ReportResultItem)=>{this.Result(item)},(item:ReportResultItem)=>`${item.reportId}:${item.outcome}`)
          }
        }.width('100%').alignItems(HorizontalAlign.Start).padding({left:20,right:20,top:6,bottom:32})
      }.width('100%').layoutWeight(1).align(Alignment.TopStart).scrollBar(BarState.Auto)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground).onAppear(()=>this.observe())
  }
}
