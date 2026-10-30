import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { MomentDetailPanel } from '../features/moments/MomentDetailPanel';
import { MomentInteractions, MomentInteractionSnapshot } from '../features/moments/MomentInteractions';
import { MomentFeedCache } from '../features/moments/MomentFeedModels';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { MomentSummary } from '../model/ApiModels';
import { MomentApiBinding, MomentSessionBinding } from '../features/moments/MomentInteractionBindings';

@Component
export struct NotificationMomentPage {
  @Prop momentId: number = 0;
  @State private state: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  private interactions?: MomentInteractions;
  private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false;
  private visibleSessionVersion: number = -1;
  onBack?: () => void;
  onRequireLogin?: () => void;
  aboutToAppear(): void {
    this.interactions = new MomentInteractions(new MomentApiBinding(AppClient.shared.apiService), new MomentSessionBinding(AppClient.shared.sessionManager),
      MomentFeedCache.shared, (state: MomentInteractionSnapshot) => this.state = state, () => {});
  }
  aboutToDisappear(): void { this.lifecycle?.stop(); this.lifecycle = undefined; this.interactions?.suspend(); }
  private read(): void {
    if (!Number.isSafeInteger(this.momentId) || this.momentId <= 0) {
      this.state.message = '动态编号无效，请返回通知列表。'; return;
    }
    this.interactions?.open(this.momentId);
  }
  private openAuthor(item: MomentSummary): void {
    const current = this.state.item;
    if (this.visibleSessionVersion !== AppClient.shared.sessionManager.getSessionVersion() ||
      !this.visible || this.state.likeBusyId !== 0 || this.state.favoriteBusyId !== 0 || !AppClient.shared.sessionManager.isAuthenticated() ||
      current === undefined || current.momentId !== item.momentId || !['CUSTOMER', 'PROVIDER'].includes(current.authorRole)) { return; }
    const navigation = this.queryNavigationInfo();
    if (navigation === undefined) { return; }
    const param: NavigationRouteParam = { userId: current.authorId, userRole: current.authorRole };
    navigation.pathStack.pushPathByName(AppRoute.PUBLIC_PROFILE, param);
  }
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
        if (this.visible === visible) { return; } this.visible = visible;
        if (visible) { this.visibleSessionVersion = AppClient.shared.sessionManager.getSessionVersion(); this.interactions?.resume(); this.read(); } else { this.interactions?.suspend(); }
      }, () => { this.interactions?.suspend(); this.state.message = '页面状态监听不可用，请返回重试。'; });
      this.lifecycle.start();
    } catch { this.state.message = '页面状态监听不可用，请返回重试。'; }
  }
  build() {
    Column() {
      MomentDetailPanel({ state: this.state, onClose: this.onBack, onRetry: () => this.read(),
        onRequireLogin: this.onRequireLogin,
        onToggleFavorite: (item: MomentSummary) => this.interactions?.toggleFavorite(item), onOpenAuthor: (item: MomentSummary) => this.openAuthor(item), onToggleLike: () => {
          if (this.state.item !== undefined) { this.interactions?.toggleLike(this.state.item); }
        } })
    }.width('100%').height('100%').backgroundColor('#FBF7EF').onAppear(() => this.observe())
  }
}
