import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { CreditRecordSummary } from '../model/ApiModels';
import { CreditController, CreditFormat, CreditSnapshot } from '../features/credit/CreditController';
import { NotificationFormat } from '../features/notifications/NotificationController';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { PortraTheme } from '../theme/PortraTheme';
import { CreditApiBinding, ActivitySessionBinding } from '../features/notifications/ActivityApiBindings';

@Component
export struct CreditPage {
  @State private snapshot: CreditSnapshot = new CreditSnapshot();
  @State private rulesOpen: boolean = false;
  private controller?: CreditController;
  private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false;
  onBack?: () => void;
  onRequireLogin?: () => void;
  aboutToAppear(): void {
    this.controller = new CreditController(new CreditApiBinding(AppClient.shared.apiService), new ActivitySessionBinding(AppClient.shared.sessionManager),
      (state: CreditSnapshot) => this.snapshot = state);
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
        if (this.visible === visible) { return; } this.visible = visible; this.rulesOpen = false;
        if (visible) { this.controller?.resume(); this.controller?.load(); } else { this.controller?.suspend(); }
      }, () => { this.controller?.suspend(); this.snapshot.error = '页面状态监听不可用，请返回后重试。'; });
      this.lifecycle.start();
    } catch { this.snapshot.error = '页面状态监听不可用，请返回后重试。'; }
  }
  private metricValue(kind: string): string {
    const summary = this.snapshot.summary;
    if (summary === undefined) { return this.snapshot.error.length > 0 ? '加载失败' : '加载中'; }
    if (kind === 'orders') { return CreditFormat.metric(summary.effectiveOrderCount); }
    if (kind === 'risks') { return CreditFormat.metric(summary.riskRecordCount); }
    if (kind === 'reviews') { return summary.goodReviewRate === null ? '暂无评价' : CreditFormat.percent(summary.goodReviewRate); }
    return summary.defaultRate === null ? '暂无计分合作' : CreditFormat.percent(summary.defaultRate);
  }
  @Builder
  private Metric(kind: string, label: string) {
    Column({ space: 8 }) {
      Text(this.metricValue(kind)).fontSize(19).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
      Text(label).fontSize(11).fontColor(PortraTheme.secondaryText)
    }.width('47%').padding({ top: 18, bottom: 18 }).backgroundColor(PortraTheme.surface).borderRadius(16)
  }
  @Builder
  private Record(item: CreditRecordSummary) {
    Row({ space: 12 }) {
      Column({ space: 6 }) {
        Text(item.reason || '分数变化').fontSize(14).fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText)
        Text(NotificationFormat.time(item.createdAt)).fontSize(11).fontColor(PortraTheme.secondaryText)
        if (item.relatedOrderId !== null && item.relatedOrderId !== undefined) {
          Text(`关联订单 #${item.relatedOrderId}`).fontSize(11).fontColor(PortraTheme.secondaryText)
        }
      }.alignItems(HorizontalAlign.Start).layoutWeight(1)
      Text(`${CreditFormat.delta(item) > 0 ? '+' : ''}${CreditFormat.delta(item)}`)
        .fontSize(23).fontWeight(FontWeight.Bold).fontColor(CreditFormat.delta(item) < 0 ? PortraTheme.danger : PortraTheme.primary)
    }.width('100%').padding(18).backgroundColor(PortraTheme.surface).borderRadius(16)
  }
  build() {
    Column() {
      Row({ space: 10 }) {
        Button('‹').width(32).height(40).padding(0).fontSize(30).fontColor(PortraTheme.primaryText).backgroundColor(Color.Transparent)
          .onClick(() => this.onBack?.())
        Text('信用分').fontSize(15).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primary).layoutWeight(1)
        Button('刷新').fontSize(12).height(34).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.surface)
          .enabled(!this.snapshot.loading).onClick(() => this.controller?.load())
      }.width('100%').padding({ left: 12, right: 20, top: 12, bottom: 14 })
      Scroll() {
        Column({ space: 18 }) {
          if (this.snapshot.error.length > 0) {
            Text(this.snapshot.error).width('100%').padding(16).fontSize(13).fontColor(PortraTheme.danger)
              .backgroundColor(PortraTheme.surface).borderRadius(14)
          }
          if (this.snapshot.loginRequired) {
            Text('登录后查看你的信用记录').fontColor(PortraTheme.secondaryText).margin({ top: 40 })
            Button('去登录').onClick(() => this.onRequireLogin?.())
          } else if (this.snapshot.loading) {
            LoadingProgress().width(36).height(36).color(PortraTheme.primary).margin({ top: 50 })
            Text('正在整理信用分…').fontSize(13).fontColor(PortraTheme.secondaryText)
          } else {
            Column({ space: 18 }) {
              Text('CREDIT').fontSize(43).fontFamily('serif').fontColor('#181735B9').width('100%').textAlign(TextAlign.End)
              Stack({ alignContent: Alignment.Center }) {
                Circle().width(158).height(158).fill(Color.Transparent).stroke('#661735B9').strokeWidth(1).strokeDashArray([3, 4])
                Circle().width(138).height(138).fill(Color.Transparent).stroke('#331735B9').strokeWidth(1)
                Circle().width(120).height(120).fill(Color.Transparent).stroke('#221735B9').strokeWidth(1)
                Column({ space: 4 }) {
                  Text(CreditFormat.score(this.snapshot.summary?.creditScore)).fontFamily('serif').fontSize(40)
                    .fontWeight(FontWeight.Bold).fontColor(PortraTheme.primary)
                  Text('信用评分').fontSize(10).letterSpacing(3).fontColor(PortraTheme.primary)
                }
              }.width('100%').height(170)
              Row({ space: 10 }) {
                Text(CreditFormat.level(this.snapshot.summary)).fontSize(27).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
                if (this.snapshot.userId > 0) {
                  Text(`用户 ${this.snapshot.userId}`).fontSize(11).fontColor(PortraTheme.primaryText)
                    .padding({ left: 12, right: 12, top: 7, bottom: 7 }).backgroundColor(PortraTheme.accent).borderRadius(30)
                }
              }.width('100%')
              Text(`最近更新：${this.snapshot.summary?.lastUpdatedAt ? NotificationFormat.time(this.snapshot.summary.lastUpdatedAt) : '暂无分数变更'}`)
                .width('100%').fontSize(11).fontColor(PortraTheme.secondaryText)
              Text('信用分会参考完成合作后的评价、是否按约以及争议处理情况，近期表现越稳定，分数通常也越稳。')
                .width('100%').fontSize(13).lineHeight(23).fontColor(PortraTheme.secondaryText)
              Button(this.rulesOpen ? '收起说明' : '评分说明').fontSize(12).height(34).fontColor(PortraTheme.primary)
                .backgroundColor(PortraTheme.primarySoft).onClick(() => this.rulesOpen = !this.rulesOpen)
              if (this.rulesOpen) {
                Text('信用分由平台根据合作履约、评价及争议处理结果计算。合作或评价不足时显示“新用户 / 待积累”；具体分数及变更以平台实际记录为准。')
                  .width('100%').fontSize(13).lineHeight(23).fontColor(PortraTheme.secondaryText)
              }
            }.width('100%').padding(22).alignItems(HorizontalAlign.Start).backgroundColor(PortraTheme.surface).borderRadius(24)
              .border({ width: { left: 4 }, color: PortraTheme.primary })
            Column({ space: 12 }) {
              Row() {
                this.Metric('orders', '计分合作')
                Blank()
                this.Metric('reviews', '好评率')
              }.width('100%')
              Row() {
                this.Metric('defaults', '未按约占比')
                Blank()
                this.Metric('risks', '争议记录')
              }.width('100%')
            }.width('100%').padding(14).backgroundColor(PortraTheme.pageBackgroundDeep).borderRadius(22)
            Row() {
              Text('分数变化').fontSize(20).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText)
              Blank()
              Text(`${this.snapshot.records.length} 条`).fontSize(12).fontColor(PortraTheme.secondaryText)
            }.width('100%')
            Text('按时间查看每一次分数变化，以及背后的原因。').width('100%').fontSize(12).fontColor(PortraTheme.secondaryText)
            if (this.snapshot.recordsError.length > 0) {
              Text(this.snapshot.recordsError).fontSize(13).fontColor(PortraTheme.danger)
            } else if (this.snapshot.records.length === 0) {
              Column({ space: 12 }) {
                Text('还没有分数变化').fontSize(16).fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText)
                Text('完成合作或收到评价后，这里会出现变化说明。').fontSize(12).fontColor(PortraTheme.secondaryText)
              }.width('100%').padding(28).backgroundColor(PortraTheme.surface).borderRadius(18)
            }
            ForEach(this.snapshot.records, (item: CreditRecordSummary) => { this.Record(item) },
              (item: CreditRecordSummary) => `${item.recordId}`)
          }
        }.width('100%').padding({ left: 20, right: 20, top: 6, bottom: 30 })
      }.width('100%').layoutWeight(1).scrollBar(BarState.Off)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground).onAppear(() => this.observe())
  }
}
