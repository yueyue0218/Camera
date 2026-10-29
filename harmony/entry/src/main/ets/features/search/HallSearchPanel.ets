import { uiObserver } from '@kit.ArkUI';
import { MomentFeedLifecycle } from '../moments/MomentFeedLifecycle';
import { ActivitySessionBinding } from '../notifications/ActivityApiBindings';
import { AppClient } from '../../app/AppClient';
import { DemandSummary, ServicePackageSummary } from '../../model/ApiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { ShowcaseCard, DemandCard } from '../hall/components/HallCards';
import { HallSearchController, HallSearchSnapshot } from './HallSearchController';
import { HallSearchApiBinding } from './HallSearchApiBinding';

@Component
export struct HallSearchPanel {
  @State private state: HallSearchSnapshot = new HallSearchSnapshot();
  private controller?: HallSearchController;
  private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false;
  @State private observerFailed: boolean = false;
  routeVisible?: (update?: uiObserver.NavDestinationInfo) => boolean;
  onRequireLogin?: () => void;
  onClose?: () => void;
  onOpenService?: (id: number) => void;
  onOpenDemand?: (id: number) => void;
  aboutToAppear(): void {
    this.visible = false; this.observerFailed = false;
    this.controller = new HallSearchController(new HallSearchApiBinding(AppClient.shared.apiService),
      (value: HallSearchSnapshot) => this.state = value, new ActivitySessionBinding(AppClient.shared.sessionManager));
  }
  aboutToDisappear(): void { this.lifecycle?.stop(); this.lifecycle = undefined; this.controller?.close(); this.controller = undefined; }
  private observe(): void {
    if (this.lifecycle !== undefined) { return; }
    try {
      this.lifecycle = new MomentFeedLifecycle(this.getUIContext(), (update?: uiObserver.NavDestinationInfo) => {
        if (this.routeVisible === undefined) { throw new Error('Search host unavailable'); }
        return this.routeVisible(update);
      }, (visible: boolean) => {
        if (this.visible === visible) { return; } this.visible = visible;
        if (visible) { this.controller?.resume(); } else { this.controller?.suspend(); }
      }, () => this.observationFailed());
      this.lifecycle.start();
    } catch { this.observationFailed(); }
  }
  private observationFailed(): void {
    this.observerFailed = true; this.visible = false; this.controller?.suspend();
    this.state.error = '页面状态监听不可用，请关闭后重试。';
  }
  private retryIdentity(): void {
    if (this.observerFailed) { this.close(); return; }
    this.controller?.resume();
  }
  private close(): void { this.controller?.close(); this.onClose?.(); }
  private openService(id: number): void { if (!this.controller?.canOpen('services', id)) { return; } this.close(); this.onOpenService?.(id); }
  private openDemand(id: number): void { if (!this.controller?.canOpen('demands', id)) { return; } this.close(); this.onOpenDemand?.(id); }
  build() {
    Column() {
      Row({ space: 12 }) {
        Text(this.state.role === 'PROVIDER' ? '搜索需求' : this.state.role === 'CUSTOMER' ? '搜索橱窗' : '搜索').fontSize(24).fontWeight(FontWeight.Bold).fontColor(PortraTheme.primaryText).layoutWeight(1)
        Button('×').width(44).height(44).padding(0).fontSize(26).backgroundColor(Color.Transparent)
          .fontColor(PortraTheme.secondaryText).accessibilityText('关闭搜索').onClick(() => this.close())
      }.width('100%').padding({ left: 20, right: 12, top: 12, bottom: 10 })
      Row({ space: 10 }) {
        TextInput({ text: this.state.keyword, placeholder: this.state.role === 'PROVIDER' ? '搜索公开约拍需求' : '搜索摄影橱窗' }).layoutWeight(1).height(48)
          .fontSize(15).maxLength(100).backgroundColor(PortraTheme.pageBackground).borderRadius(12)
          .enabled(this.state.role.length > 0 && !this.state.loadingIdentity && !this.state.loginRequired).enterKeyType(EnterKeyType.Search).onChange((value: string) => this.controller?.setKeyword(value))
          .onSubmit(() => this.controller?.search())
        Button('搜索').constraintSize({ minHeight: 48 }).fontSize(14).fontColor(PortraTheme.white)
          .backgroundColor(PortraTheme.primary).borderRadius(12)
          .enabled(this.state.role.length > 0 && !this.state.loadingIdentity && !this.state.loading && !this.state.loginRequired && this.state.keyword.trim().length > 0).onClick(() => this.controller?.search())
      }.width('100%').padding({ left: 20, right: 20, bottom: 14 })
      if (this.state.role.length > 0) {
        Text(this.state.role === 'PROVIDER' ? '摄影师身份 · 仅搜索公开需求' : '客户身份 · 仅搜索摄影橱窗')
          .width('100%').fontSize(12).fontColor(PortraTheme.secondaryText).padding({ left: 20, right: 20, bottom: 14 })
      }
      Divider().color(PortraTheme.border)
      Scroll() {
        Column({ space: 16 }) {
          if (this.state.loginRequired) {
            Text('登录后按当前身份搜索').fontSize(17).fontColor(PortraTheme.primaryText)
            Button('去登录').constraintSize({ minHeight: 44 }).onClick(() => { this.close(); this.onRequireLogin?.(); })
          } else if (this.state.loadingIdentity && this.state.role.length === 0) {
            Text('正在核对当前身份…').fontSize(15).fontColor(PortraTheme.secondaryText)
          } else if (this.state.role.length === 0 && this.state.error.length > 0) {
            Text(this.state.error).fontSize(14).fontColor(PortraTheme.danger)
            Button(this.observerFailed ? '关闭搜索' : '重新核对身份').constraintSize({ minHeight: 44 }).onClick(() => this.retryIdentity())
          } else if (!this.state.searched) {
            if (this.state.error.length > 0) { Text(this.state.error).fontSize(13).fontColor(PortraTheme.danger) }
            Text('输入关键词，找到想拍的灵感').fontSize(17).fontWeight(FontWeight.Medium).fontColor(PortraTheme.primaryText)
            Text(this.state.role === 'PROVIDER' ? '搜索符合拍摄方向的约拍需求' : '搜索合适的摄影橱窗').fontSize(13).fontColor(PortraTheme.secondaryText)
          } else {
            Text(this.state.loading && this.state.page === 0 ? '正在搜索…' :
              '已加载 ' + (this.state.role === 'CUSTOMER' ? this.state.services.length : this.state.demands.length) +
              ' / ' + this.state.total + ' 条').fontSize(12).fontColor(PortraTheme.secondaryText)
            if (this.state.error.length > 0) {
              Text(this.state.error).width('100%').fontSize(14).fontColor(PortraTheme.danger)
              Button('重试').constraintSize({ minHeight: 44 }).enabled(!this.state.loading)
                .onClick(() => this.state.page > 0 ? this.controller?.loadMore() : this.controller?.search())
            } else if (!this.state.loading && this.state.total === 0) {
              Text('没有找到相关内容').fontSize(18).fontColor(PortraTheme.primaryText)
              Text('换个关键词试试').fontSize(13).fontColor(PortraTheme.secondaryText)
            }
            if (this.state.role === 'CUSTOMER') {
              ForEach(this.state.services, (item: ServicePackageSummary) => {
                ShowcaseCard({ item: item, onOpen: (id: number) => this.openService(id) })
              }, (item: ServicePackageSummary) => item.serviceId + ':' + JSON.stringify(item))
            } else {
              ForEach(this.state.demands, (item: DemandSummary) => {
                DemandCard({ item: item, onOpen: (id: number) => this.openDemand(id) })
              }, (item: DemandSummary) => item.demandId + ':' + JSON.stringify(item))
            }
            if (this.state.hasMore) {
              Button(this.state.loading ? '加载中…' : '加载更多').constraintSize({ minHeight: 44 })
                .enabled(!this.state.loading).onClick(() => this.controller?.loadMore())
            }
          }
        }.width('100%').alignItems(HorizontalAlign.Start).padding({ left: 20, right: 20, top: 20, bottom: 36 })
      }.width('100%').layoutWeight(1).align(Alignment.TopStart).scrollBar(BarState.Auto)
    }.width('100%').height('100%').backgroundColor(PortraTheme.surface).onAppear(() => this.observe())
  }
}
