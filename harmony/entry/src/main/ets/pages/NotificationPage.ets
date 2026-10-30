import { NotificationTarget, NotificationTargetResolver } from '../features/notifications/NotificationTargetResolver';
import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { NotificationSummary } from '../model/ApiModels';
import { NotificationController, NotificationFormat, NotificationSnapshot } from '../features/notifications/NotificationController';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { PortraTheme } from '../theme/PortraTheme';
import { NotificationApiBinding, ActivitySessionBinding } from '../features/notifications/ActivityApiBindings';

@Component
export struct NotificationPage {
  @State private snapshot: NotificationSnapshot = new NotificationSnapshot();
  @State private filter: string = 'all';
  @State private expandedId: number = 0;
  private controller?: NotificationController;
  private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false;
  onBack?: () => void;
  onRequireLogin?: () => void;
  onOpenMoment?: (id: number) => void;
  onOpenCredit?: () => void;
  onOpenOrders?: () => void;
  onOpenTarget?: (target: NotificationTarget) => void;

  aboutToAppear(): void {
    this.controller = new NotificationController(new NotificationApiBinding(AppClient.shared.apiService), new ActivitySessionBinding(AppClient.shared.sessionManager),
      (state: NotificationSnapshot) => this.snapshot = state);
  }
  aboutToDisappear(): void { this.lifecycle?.stop(); this.lifecycle = undefined; this.controller?.suspend(); }
  private observe(): void {
    if (this.lifecycle !== undefined) { return; }
    try {
      this.lifecycle = new MomentFeedLifecycle(this.getUIContext(), (update?: uiObserver.NavDestinationInfo) => {
        const navigation = this.queryNavigationInfo(); let destination = this.queryNavDestinationInfo();
        if (navigation === undefined || destination === undefined) { throw new Error('Navigation unavailable'); }
        if (update?.navDestinationId === destination.navDestinationId) { destination = update; }
        return destination.index === navigation.pathStack.size() - 1 &&
          destination.state !== uiObserver.NavDestinationState.ON_HIDDEN && destination.state !== uiObserver.NavDestinationState.ON_WILL_HIDE &&
          destination.state !== uiObserver.NavDestinationState.ON_DISAPPEAR && destination.state !== uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
      }, (visible: boolean) => {
        if (this.visible === visible) { return; } this.visible = visible; this.expandedId = 0;
        if (visible) { this.controller?.resume(); this.controller?.load(); } else { this.controller?.suspend(); }
      }, () => { this.controller?.suspend(); this.snapshot.error = '页面状态监听不可用，请返回后重试。'; });
      this.lifecycle.start();
    } catch { this.snapshot.error = '页面状态监听不可用，请返回后重试。'; }
  }
  private label(filter: string): string {
    return filter === 'all' ? '全部' : filter === 'unread' ? '未读' : filter === 'order' ? '订单' :
      filter === 'appeal' ? '申诉' : filter === 'review' ? '评价' : filter === 'report' ? '举报' : filter === 'moderation' ? '平台处理' : '动态';
  }
  private count(filter: string): number {
    return this.snapshot.items.filter((item: NotificationSummary) => filter === 'all' ||
      (filter === 'unread' ? !item.isRead : NotificationFormat.category(item) === filter)).length;
  }
  private items(): NotificationSummary[] {
    return this.snapshot.items.filter((item: NotificationSummary) => this.filter === 'all' ||
      (this.filter === 'unread' ? !item.isRead : NotificationFormat.category(item) === this.filter));
  }
  private open(item: NotificationSummary): void {
    this.expandedId = this.expandedId === item.notificationId ? 0 : item.notificationId;
    if (!item.isRead) { this.controller?.markRead(item.notificationId); }
  }
  private openReportHistory(): void {
    if(this.controller?.canOpenReports()){this.onOpenTarget?.(new NotificationTarget('reportList',0));}
  }
  private related(item: NotificationSummary): void {
    if (!this.controller?.canOpen(item.notificationId)) { return; }
    const target = NotificationTargetResolver.resolve(item); if (target === undefined) { return; }
    if (target.kind === 'moment') { this.onOpenMoment?.(target.id); }
    else if (target.kind === 'credit') { this.onOpenCredit?.(); }
    else if (['order','review','complaint','dispute','report'].includes(target.kind)) { this.onOpenTarget?.(target); }
  }
  private canOpen(item: NotificationSummary): boolean {
    const target = NotificationTargetResolver.resolve(item); if (target === undefined) { return false; }
    return target.kind === 'moment' || target.kind === 'credit' ||
      (this.onOpenTarget !== undefined && ['order','review','complaint','dispute','report'].includes(target.kind));
  }
  @Builder
  private Notice(item: NotificationSummary) {
    Column({ space: 10 }) {
      Row({ space: 8 }) {
        Circle().width(7).height(7).fill(item.isRead ? PortraTheme.border : PortraTheme.primary)
        Text(item.title).fontSize(16).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).layoutWeight(1)
        Text(item.isRead ? '已读' : '点击即读').fontSize(10).fontColor(PortraTheme.secondaryText)
      }.width('100%')
      Text(item.content).width('100%').fontSize(14).lineHeight(23).fontColor(PortraTheme.primaryText)
        .maxLines(this.expandedId === item.notificationId ? 30 : 3).textOverflow({ overflow: TextOverflow.Ellipsis })
      Text(`${NotificationFormat.label(item)} · ${NotificationFormat.time(item.createdAt)}`)
        .width('100%').fontSize(11).fontColor(PortraTheme.secondaryText)
      if (this.expandedId === item.notificationId && this.canOpen(item)) {
        Button(NotificationTargetResolver.resolve(item)?.kind==='report'?'查看举报结果':'查看相关内容').fontSize(12).constraintSize({minHeight:44}).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
          .enabled(!this.snapshot.busy && !this.snapshot.loading).onClick(() => this.related(item))
      }
    }.width('100%').alignItems(HorizontalAlign.Start).padding(18)
      .backgroundColor(item.isRead ? PortraTheme.surface : '#F0F4FF').borderRadius(18)
      .border({ width: { left: 4 }, color: item.isRead ? PortraTheme.border : PortraTheme.primary })
      .onClick(() => this.open(item))
  }
  build() {
    Column() {
      Row({ space: 12 }) {
        Button('‹').width(30).height(40).padding(0).fontSize(30).backgroundColor(Color.Transparent).fontColor(PortraTheme.primaryText)
          .onClick(() => this.onBack?.())
        Column({ space: 5 }) {
          Text('消息中心').fontSize(11).fontColor(PortraTheme.primary).letterSpacing(3)
          Text('通知').fontSize(30).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
          Text(this.snapshot.unread > 0 ? `${this.snapshot.unread} 条未读通知` : '当前没有未读通知')
            .fontSize(12).fontColor(PortraTheme.secondaryText)
        }.alignItems(HorizontalAlign.Start).layoutWeight(1)
        Button('全部已读').fontSize(11).height(36).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
          .enabled(this.snapshot.unread > 0 && !this.snapshot.busy && !this.snapshot.loading && !this.snapshot.uncertain)
          .onClick(() => this.controller?.markAllRead())
      }.width('100%').padding({ left: 14, right: 20, top: 18, bottom: 22 })
      Row({space:12}) {
        Text('查看你提交的举报及处理进度').fontSize(12).fontColor(PortraTheme.secondaryText).layoutWeight(1)
        Button('我的举报').constraintSize({minHeight:44}).fontSize(13).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
          .onClick(()=>{if(this.snapshot.loginRequired){this.onRequireLogin?.();}else{this.openReportHistory();}})
      }.width('100%').padding({left:20,right:20,bottom:14})
      Scroll() {
        Row({ space: 8 }) {
          ForEach(['all', 'unread', 'order', 'appeal', 'review', 'dynamic', 'report', 'moderation'], (filter: string) => {
            Button(`${this.label(filter)} ${this.count(filter)}`).height(44).fontSize(12)
              .fontWeight(this.filter === filter ? FontWeight.Bold : FontWeight.Regular)
              .fontColor(this.filter === filter ? PortraTheme.primary : PortraTheme.secondaryText)
              .backgroundColor(this.filter === filter ? PortraTheme.primarySoft : PortraTheme.surface)
              .onClick(() => { this.filter = filter; this.expandedId = 0; })
          })
        }.padding(10)
      }.scrollable(ScrollDirection.Horizontal).scrollBar(BarState.Off).width('100%').backgroundColor('#F8F3EB')
      Scroll() {
        Column({ space: 14 }) {
          if (this.snapshot.error.length > 0) {
            Text(this.snapshot.error).width('100%').fontSize(13).fontColor(PortraTheme.danger).padding(16)
              .backgroundColor(PortraTheme.surface).borderRadius(14)
          }
          if (this.snapshot.loginRequired) {
            Text('登录后查看属于你的通知').fontColor(PortraTheme.secondaryText).margin({ top: 40 })
            Button('去登录').onClick(() => this.onRequireLogin?.())
          } else if (this.snapshot.loading) {
            LoadingProgress().width(32).height(32).color(PortraTheme.primary).margin({ top: 45 })
            Text('正在加载通知…').fontSize(13).fontColor(PortraTheme.secondaryText)
          } else {
            Row() {
              Text(`已加载 ${this.snapshot.items.length} / ${this.snapshot.total} 条`).fontSize(11).fontColor(PortraTheme.secondaryText)
              Blank()
              Button(this.snapshot.busy ? '处理中' : this.snapshot.uncertain ? '刷新核实' : '刷新')
                .fontSize(11).height(32).fontColor(PortraTheme.primary).backgroundColor(Color.Transparent)
                .enabled(!this.snapshot.busy).onClick(() => this.controller?.load())
            }.width('100%')
            if (this.items().length === 0) {
              Text(this.filter === 'all' ? '暂无通知' : `暂无${this.label(this.filter)}通知`)
                .fontSize(18).fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText).margin({ top: 50, bottom: 12 })
              Text('新消息到来后，会在这里与你见面。').fontSize(12).fontColor(PortraTheme.secondaryText)
            }
            ForEach(this.items(), (item: NotificationSummary) => { this.Notice(item) },
              (item: NotificationSummary) => `${item.notificationId}:${item.isRead}:${this.expandedId === item.notificationId}`)
            if (this.snapshot.items.length < this.snapshot.total) {
              Button(this.snapshot.loadingMore ? '加载中' : '加载更多').fontSize(13).height(40)
                .backgroundColor(PortraTheme.primarySoft).fontColor(PortraTheme.primary)
                .enabled(!this.snapshot.loadingMore && !this.snapshot.busy).onClick(() => this.controller?.loadMore())
            }
          }
        }.width('100%').padding(20)
      }.layoutWeight(1).width('100%').scrollBar(BarState.Off).align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground).onAppear(() => this.observe())
  }
}
