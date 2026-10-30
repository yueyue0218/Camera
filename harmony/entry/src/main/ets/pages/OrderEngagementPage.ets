import { ReportResultView } from '../features/report/ReportResultView';
import { ReportResultNavigation } from '../features/report/ReportResultNavigation';
import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { EngagementController, EngagementSnapshot, EngagementPolicy } from '../features/engagement/EngagementController';
import { EngagementApiBinding } from '../features/engagement/EngagementApiBinding';
import { EngagementDialogs } from '../features/engagement/EngagementDialogs';
import { ActivitySessionBinding } from '../features/notifications/ActivityApiBindings';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { ReportPanel } from '../features/user/ReportPanel';
import { ReviewSummary, ReviewComplaintSummary, DisputeSummary, DisputeReplySummary } from '../model/ApiModels';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct OrderEngagementPage {
  targetKind: string = 'order'; targetId: number = 0; expectedOrderId: number = 0;
  onBack?: ()=>void; onRequireLogin?: ()=>void;
  @State private state: EngagementSnapshot = new EngagementSnapshot();
  @State private sheetOpen: boolean = false;
  private controller?: EngagementController; private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false; private focusOpened: boolean = false;
  aboutToAppear(): void {
    if(ReportResultNavigation.isReport(this.targetKind)){return;}
    this.controller=new EngagementController(new EngagementApiBinding(AppClient.shared.apiService),new ActivitySessionBinding(AppClient.shared.sessionManager),
      (value: EngagementSnapshot)=>{
        this.state=value;
        if(value.order===undefined&&!value.loading){this.sheetOpen=false;}
        if(value.form.mode){this.sheetOpen=true;}
        if(!this.focusOpened&&this.targetKind!=='order'&&value.order!==undefined&&!value.loading&&!value.error){this.focusOpened=true;this.sheetOpen=true;}
      });
  }
  aboutToDisappear(): void {this.lifecycle?.stop();this.lifecycle=undefined;this.controller?.suspend();}
  private load(): void {this.controller?.loadTarget(this.targetKind,this.targetId,this.expectedOrderId);}
  private observe(): void {
    if(this.lifecycle!==undefined){return;}
    try {
      this.lifecycle=new MomentFeedLifecycle(this.getUIContext(),(update?:uiObserver.NavDestinationInfo)=>{
        const navigation=this.queryNavigationInfo();let destination=this.queryNavDestinationInfo();
        if(navigation===undefined||destination===undefined){throw new Error('Navigation unavailable');}
        if(update?.navDestinationId===destination.navDestinationId){destination=update;}
        return destination.index===navigation.pathStack.size()-1&&destination.state!==uiObserver.NavDestinationState.ON_HIDDEN&&
          destination.state!==uiObserver.NavDestinationState.ON_WILL_HIDE&&destination.state!==uiObserver.NavDestinationState.ON_DISAPPEAR&&destination.state!==uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
      },(visible:boolean)=>{if(this.visible===visible){return;}this.visible=visible;this.sheetOpen=false;
        if(visible){this.controller?.resume();this.load();}else{this.controller?.suspend();}},
      ()=>{this.controller?.suspend();this.state.error='页面状态监听不可用，请返回后重试。';});
      this.lifecycle.start();
    }catch{this.state.error='页面状态监听不可用，请返回后重试。';}
  }
  private reviews(): ReviewSummary[] {
    const focusedReviewId=this.targetKind==='complaint'?
      this.state.complaints.find((c:ReviewComplaintSummary)=>c.complaintId===this.targetId)?.reviewId:this.targetKind==='review'?this.targetId:0;
    return this.state.reviews.slice().sort((a:ReviewSummary,b:ReviewSummary)=>
      (b.reviewId===focusedReviewId?1:0)-(a.reviewId===focusedReviewId?1:0));
  }
  private disputes(): DisputeSummary[] {
    return this.state.disputes.slice().sort((a:DisputeSummary,b:DisputeSummary)=>
      (b.id===this.targetId&&this.targetKind==='dispute'?1:0)-(a.id===this.targetId&&this.targetKind==='dispute'?1:0));
  }
  private statusText(status?: string): string {
    switch(status) {
      case 'PENDING_PAYMENT': return '约定已确认'; case 'PAID_PENDING_SHOOT': return '待拍摄';
      case 'SHOOTING': return '拍摄中'; case 'PENDING_DELIVERY': return '待交付';
      case 'DELIVERED_PENDING_CONFIRM': return '待确认'; case 'COMPLETED': return '已完成';
      case 'CANCELLED': return '已取消'; case 'REFUNDED': return '已退款';
      case 'APPEALING': return '申诉中'; case 'REWORK_REQUIRED': return '待返修'; default: return '状态待同步';
    }
  }
  private complaintResult(result: string): string {
    return result==='REVIEW_HIDDEN'?'申诉通过，评价已隐藏':result==='REJECTED'?'申诉驳回':'处理结果待核实';
  }
  @Builder private SmallAction(label:string,action:()=>void) {
    Button(label).constraintSize({minHeight:44}).fontSize(13).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
      .borderRadius(10).enabled(!this.state.loading&&!this.state.form.busy&&(label==='刷新'||!this.state.recordsError)).onClick(action)
  }
  @Builder private Complaint(item:ReviewComplaintSummary) {
    Column({space:8}) {
      Text(`评价申诉 #${item.complaintId} · ${item.status==='PENDING'?'待处理':item.status==='CANCELLED'?'已取消':'已处理'}`)
        .fontSize(14).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      Text(item.reason).fontSize(14).fontColor(PortraTheme.primaryText)
      if(item.arbitrationComment){Text(`处理说明：${item.arbitrationComment}`).fontSize(13).fontColor(PortraTheme.secondaryText)}
      if(item.arbitrationResult){Text(`裁定结果：${this.complaintResult(item.arbitrationResult)}`).fontSize(13).fontColor(PortraTheme.secondaryText)}
    }.width('100%').alignItems(HorizontalAlign.Start).padding(14).backgroundColor(PortraTheme.pageBackground)
      .border({width:this.targetKind==='complaint'&&this.targetId===item.complaintId?2:1,color:this.targetKind==='complaint'&&this.targetId===item.complaintId?PortraTheme.primary:PortraTheme.border}).borderRadius(12)
  }
  @Builder private Review(item:ReviewSummary) {
    Column({space:12}) {
      Row({space:10}) {
        Text(item.reviewerNickname||`用户 #${item.reviewerId}`).fontSize(14).fontWeight(FontWeight.Bold).layoutWeight(1)
        Text(`${item.rating} ★`).fontSize(16).fontColor(PortraTheme.primary)
      }.width('100%')
      Text(item.content||'对方没有留下文字评价').fontSize(15).fontColor(PortraTheme.primaryText)
      Text(`评价对象：${item.targetUserNickname||`用户 #${item.targetUserId}`}`).fontSize(12).fontColor(PortraTheme.secondaryText)
      if(item.isVisible===false){Text('该评价已隐藏，仅按当前账号权限展示。').fontSize(12).fontColor(PortraTheme.danger)}
      if(item.replyContent){
        Column({space:6}) {
          Text('追加追评').fontWeight(FontWeight.Bold).fontSize(13).fontColor(PortraTheme.primary)
          Text(item.replyContent).fontSize(14).fontColor(PortraTheme.primaryText)
        }.width('100%').alignItems(HorizontalAlign.Start).padding(14).backgroundColor(PortraTheme.primarySoft).borderRadius(12)
      }
      Flex({wrap:FlexWrap.Wrap}) {
        if(item.reviewerId===this.state.userId&&item.isVisible!==false){this.SmallAction('追加追评',()=>this.controller?.open('followup',item.reviewId))}
        if(item.targetUserId===this.state.userId&&item.isVisible!==false){this.SmallAction('发起评价申诉',()=>this.controller?.open('complaint',item.reviewId))}
      }
      ReportPanel({targetType:'REVIEW',targetId:item.reviewId,ownerId:item.reviewerId,currentUserId:this.state.userId,onRequireLogin:this.onRequireLogin})
      ForEach(this.state.complaints.filter((c:ReviewComplaintSummary)=>c.reviewId===item.reviewId&&
        !(this.targetKind==='complaint'&&this.targetId===c.complaintId)),(c:ReviewComplaintSummary)=>{this.Complaint(c)},(c:ReviewComplaintSummary)=>c.complaintId.toString())
    }.width('100%').alignItems(HorizontalAlign.Start).padding(16).backgroundColor(PortraTheme.surface).borderRadius(16)
      .border({width:this.targetKind==='review'&&this.targetId===item.reviewId?2:1,color:this.targetKind==='review'&&this.targetId===item.reviewId?PortraTheme.primary:PortraTheme.border})
  }
  @Builder private Dispute(item:DisputeSummary) {
    Column({space:10}) {
      Text(`订单申诉 #${item.id} · ${item.status==='OPEN'?'待回复':item.status==='REPLIED'?'已回复':'已处理'}`)
        .fontSize(15).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      Text(item.reason).fontSize(14).fontColor(PortraTheme.primaryText)
      ForEach(item.replies||[],(reply:DisputeReplySummary)=>{
        Text(`用户 #${reply.replierId}：${reply.content}`).width('100%').fontSize(14).fontColor(PortraTheme.secondaryText)
          .padding(12).backgroundColor(PortraTheme.pageBackground).borderRadius(10)
      },(reply:DisputeReplySummary)=>reply.id.toString())
      if(item.adminComment){Text(`处理说明：${item.adminComment}`).fontSize(13).fontColor(PortraTheme.secondaryText)}
      if(EngagementPolicy.canReply(item,this.state.userId)){this.SmallAction('回复申诉',()=>this.controller?.open('reply',item.id))}
    }.width('100%').alignItems(HorizontalAlign.Start).padding(16).backgroundColor(PortraTheme.surface).borderRadius(16)
      .border({width:this.targetKind==='dispute'&&this.targetId===item.id?2:1,color:this.targetKind==='dispute'&&this.targetId===item.id?PortraTheme.primary:PortraTheme.border})
  }
  @Builder private SheetBody() {
    if(this.state.form.mode) {
      EngagementDialogs({form:this.state.form,orderId:this.state.order?.orderId??0,
        onContent:(value:string)=>this.controller?.setContent(value),onRating:(value:number)=>this.controller?.setRating(value),
        onReason:(value:string)=>this.controller?.setReason(value),onClose:()=>this.controller?.requestClose(),onSubmit:()=>this.controller?.submit(),
        onVerify:()=>this.controller?.verify(),onKeep:()=>this.controller?.cancelDiscard(),onDiscard:()=>this.controller?.confirmDiscard()})
    } else {
      Column() {
        Row({space:12}) {
          Text('评价与申诉').fontSize(21).fontWeight(FontWeight.Bold).layoutWeight(1).fontColor(PortraTheme.primaryText)
          Button('关闭').constraintSize({minHeight:44}).fontSize(14).backgroundColor(PortraTheme.surface).fontColor(PortraTheme.secondaryText).onClick(()=>this.sheetOpen=false)
        }.width('100%').padding(20)
        Divider().color(PortraTheme.border)
        Scroll() {
          Column({space:16}) {
            Text('这里集中展示本次合作的评价、追加追评与申诉处理记录。').fontSize(13).fontColor(PortraTheme.secondaryText)
            if(this.state.message){Text(this.state.message).fontSize(14).fontColor(PortraTheme.primary)}
            if(this.state.recordsError){Text(this.state.recordsError).fontSize(13).fontColor(PortraTheme.danger)}
            ForEach(this.state.complaints.filter((c:ReviewComplaintSummary)=>this.targetKind==='complaint'&&c.complaintId===this.targetId),(item:ReviewComplaintSummary)=>{
              this.Complaint(item)
            },(item:ReviewComplaintSummary)=>item.complaintId.toString())
            if(this.targetKind==='dispute') {
              ForEach(this.disputes(),(item:DisputeSummary)=>{this.Dispute(item)},(item:DisputeSummary)=>item.id.toString())
            }
            if(this.state.reviews.length===0){Text('暂无可展示的评价').fontSize(14).fontColor(PortraTheme.secondaryText).padding(20)}
            ForEach(this.state.complaints.filter((c:ReviewComplaintSummary)=>!(this.targetKind==='complaint'&&this.targetId===c.complaintId)&&!this.state.reviews.some((r:ReviewSummary)=>r.reviewId===c.reviewId)),(item:ReviewComplaintSummary)=>{
              Text('对应评价暂未在列表展示，以下为当前账号可查看的申诉记录。').fontSize(13).fontColor(PortraTheme.secondaryText)
              this.Complaint(item)
            },(item:ReviewComplaintSummary)=>item.complaintId.toString())
            ForEach(this.reviews(),(item:ReviewSummary)=>{this.Review(item)},(item:ReviewSummary)=>item.reviewId.toString())
            if(this.targetKind!=='dispute') {
              ForEach(this.disputes(),(item:DisputeSummary)=>{this.Dispute(item)},(item:DisputeSummary)=>item.id.toString())
            }
          }.width('100%').alignItems(HorizontalAlign.Start).padding(16)
        }.width('100%').layoutWeight(1).align(Alignment.TopStart).scrollBar(BarState.Auto)
        Row({space:12}) {
          if(this.state.order&&EngagementPolicy.canReview(this.state.order,this.state.userId,this.state.reviews)) {
            this.SmallAction('评价',()=>this.controller?.open('review',this.state.order?.orderId??0))
          }
          if(this.state.order&&EngagementPolicy.canDispute(this.state.order,this.state.disputes)) {
            this.SmallAction('发起订单申诉',()=>this.controller?.open('dispute',this.state.order?.orderId??0))
          }
        }.width('100%').padding({left:20,right:20,top:12,bottom:28}).backgroundColor(PortraTheme.pageBackground)
      }.width('100%').height('100%').backgroundColor(PortraTheme.surface)
    }
  }
  build() {
    if(ReportResultNavigation.isReport(this.targetKind)) {
      ReportResultView({reportId:ReportResultNavigation.id(this.targetKind,this.targetId),onBack:this.onBack,onRequireLogin:this.onRequireLogin})
    } else {
    Column() {
      Row({space:10}) {
        Button('‹').width(44).height(44).padding(0).fontSize(30).fontColor(PortraTheme.primaryText).backgroundColor(Color.Transparent).onClick(()=>this.onBack?.())
        Text('本次约拍').fontSize(19).fontWeight(FontWeight.Bold).layoutWeight(1).fontColor(PortraTheme.primaryText)
        this.SmallAction('刷新',()=>this.load())
      }.width('100%').padding({left:12,right:20,top:12,bottom:14})
      Scroll() {
        Column({space:18}) {
          if(this.state.loginRequired){Text('登录后查看本次约拍的评价与申诉').fontSize(15);Button('去登录').onClick(()=>this.onRequireLogin?.())}
          else if(this.state.loading){LoadingProgress().width(36).height(36);Text('正在读取本次约拍…').fontSize(14)}
          else if(this.state.error){Text(this.state.error).fontSize(14).fontColor(PortraTheme.danger)}
          else if(this.state.order){
            Column({space:14}) {
              Text('ORDER / PORTRA').fontSize(12).fontColor(PortraTheme.primary)
              Text(this.state.order.orderNo||`订单 #${this.state.order.orderId}`).fontSize(24).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Text(`${this.state.order.customerNickname||`用户 #${this.state.order.customerId}`} · ${this.state.order.providerNickname||`用户 #${this.state.order.providerUserId}`}`)
                .fontSize(14).fontColor(PortraTheme.secondaryText)
              Text(`当前进度：${this.statusText(this.state.order.status)}`).fontSize(14).fontColor(PortraTheme.primary)
              Text('查看本次合作的评价、追评与申诉，所有结果以平台实际记录为准。').fontSize(14).fontColor(PortraTheme.secondaryText)
              Button('评价与申诉').width('100%').constraintSize({minHeight:48}).fontSize(15).backgroundColor(PortraTheme.primary).fontColor(PortraTheme.white).onClick(()=>this.sheetOpen=true)
            }.width('100%').alignItems(HorizontalAlign.Start).padding(22).backgroundColor(PortraTheme.surface).borderRadius(20)
            if(this.state.message){Text(this.state.message).fontSize(14).fontColor(PortraTheme.primary)}
            if(this.state.recordsError){Text(this.state.recordsError).fontSize(14).fontColor(PortraTheme.danger)}
          }
        }.width('100%').padding(20).alignItems(HorizontalAlign.Start)
      }.width('100%').layoutWeight(1).align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground).onAppear(()=>this.observe())
      .bindSheet(this.sheetOpen,this.SheetBody(),{height:SheetSize.LARGE,showClose:false,backgroundColor:PortraTheme.surface,
        keyboardAvoidMode:SheetKeyboardAvoidMode.RESIZE_ONLY,
        onWillDismiss:(action:DismissSheetAction)=>{if(!this.state.form.mode||this.controller?.requestClose()){this.sheetOpen=false;action.dismiss();}}})
    }
  }
}
