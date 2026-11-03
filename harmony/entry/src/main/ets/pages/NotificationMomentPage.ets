import { uiObserver } from '@kit.ArkUI';
import { AppClient } from '../app/AppClient';
import { MomentDetailPanel } from '../features/moments/MomentDetailPanel';
import { MomentPublishPanel } from '../features/moments/MomentPublishPanel';
import { MomentPublishApiBinding } from '../features/moments/MomentPublishApiBinding';
import { MomentOwnerActions, MomentOwnerSnapshot } from '../features/moments/MomentOwnerActions';
import { MomentInteractions, MomentInteractionSnapshot } from '../features/moments/MomentInteractions';
import { MomentFeedCache } from '../features/moments/MomentFeedModels';
import { MomentFeedLifecycle } from '../features/moments/MomentFeedLifecycle';
import { AppRoute, NavigationRouteParam } from '../model/NavigationModels';
import { MomentSummary } from '../model/ApiModels';
import { MomentApiBinding, MomentSessionBinding } from '../features/moments/MomentInteractionBindings';

@Component
export struct NotificationMomentPage {
  @Prop @Watch('targetChanged') momentId: number = 0;
  @State private state: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  @State private ownerState: MomentOwnerSnapshot = new MomentOwnerSnapshot();
  @State private editorOpen: boolean = false;
  @State private deleteOpen: boolean = false;
  private interactions?: MomentInteractions;
  private owner?: MomentOwnerActions;
  private lifecycle?: MomentFeedLifecycle;
  private visible: boolean = false;
  private visibleSessionVersion: number = -1;
  private readVersion: number = 0;
  onBack?: () => void;
  onRequireLogin?: () => void;
  aboutToAppear(): void {
    const session = new MomentSessionBinding(AppClient.shared.sessionManager);
    this.owner = new MomentOwnerActions(new MomentPublishApiBinding(AppClient.shared.apiService), session, MomentFeedCache.shared,
      (value: MomentOwnerSnapshot) => { this.ownerState = value; this.deleteOpen = value.confirmation; },
      (_id: number) => { this.editorOpen = false; this.owner?.close(); this.interactions?.close(); this.onBack?.(); },
      (_item: MomentSummary) => this.read());
    this.interactions = new MomentInteractions(new MomentApiBinding(AppClient.shared.apiService), session,
      MomentFeedCache.shared, (state: MomentInteractionSnapshot) => {
        this.state = state;
        if (state.authenticationRequired) { this.editorOpen = false; this.owner?.close(); }
      }, () => {});
  }
  aboutToDisappear(): void { this.lifecycle?.stop(); this.lifecycle = undefined; this.hide(); }
  private hide(): void {
    this.readVersion++; this.editorOpen = false; this.deleteOpen = false;
    this.owner?.close(); this.interactions?.suspend();
  }
  private targetChanged(): void { this.hide(); if (this.visible) { this.interactions?.resume(); this.read(); } }
  private async read(): Promise<void> {
    const read = ++this.readVersion, id = this.momentId, version = AppClient.shared.sessionManager.getSessionVersion();
    this.owner?.close(); this.editorOpen = false;
    if (!Number.isSafeInteger(id) || id <= 0) { this.state.message = '动态编号无效，请返回通知列表。'; return; }
    await this.interactions?.open(id);
    if (!this.visible || read !== this.readVersion || id !== this.momentId || version !== AppClient.shared.sessionManager.getSessionVersion()) { return; }
    if (this.state.item !== undefined && this.state.item.momentId === id && this.state.message.length === 0) { await this.owner?.open(this.state.item); }
  }
  private openEditor(): void {
    if (this.state.likeBusyId === 0 && this.state.favoriteBusyId === 0 && this.owner?.beginEdit()) { this.editorOpen = true; }
  }
  private openAuthor(item: MomentSummary): void {
    const current = this.state.item;
    if (this.visibleSessionVersion !== AppClient.shared.sessionManager.getSessionVersion() ||
      !this.visible || this.ownerState.deleting || this.ownerState.verifying || this.state.likeBusyId !== 0 || this.state.favoriteBusyId !== 0 ||
      !AppClient.shared.sessionManager.isAuthenticated() || current === undefined || current.momentId !== item.momentId ||
      !['CUSTOMER', 'PROVIDER'].includes(current.authorRole)) { return; }
    const navigation = this.queryNavigationInfo(); if (navigation === undefined) { return; }
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
        if (destination.index !== navigation.pathStack.size() - 1) { return false; }
        return destination.state !== uiObserver.NavDestinationState.ON_HIDDEN && destination.state !== uiObserver.NavDestinationState.ON_WILL_HIDE &&
          destination.state !== uiObserver.NavDestinationState.ON_DISAPPEAR && destination.state !== uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
      }, (visible: boolean) => {
        if (this.visible === visible) { return; } this.visible = visible;
        if (visible) { this.visibleSessionVersion = AppClient.shared.sessionManager.getSessionVersion(); this.interactions?.resume(); this.read(); }
        else { this.hide(); }
      }, () => { this.hide(); this.state.message = '页面状态监听不可用，请返回重试。'; });
      this.lifecycle.start();
    } catch { this.state.message = '页面状态监听不可用，请返回重试。'; }
  }
  @Builder
  private Editor() {
    MomentPublishPanel({ editingId: this.momentId, onClose: () => this.editorOpen = false,
      onRequireLogin: () => { this.editorOpen = false; this.onRequireLogin?.(); }, onPublished: (_item: MomentSummary) => this.read() })
  }
  @Builder
  private DeleteConfirmation() {
    Column() {
      Row() { Blank(); Row().width(34).height(4).borderRadius(2).backgroundColor('#D8D1C5'); Blank() }.width('100%')
      Text('删除这条动态？').width('100%').fontSize(20).fontWeight(FontWeight.Bold).fontColor('#242529').margin({ top: 26 })
      Text('删除后，这条动态将从列表中移除。').width('100%').fontSize(14).lineHeight(23).fontColor('#77736F').margin({ top: 10 })
      Row({ space: 14 }) {
        Button('取消', { type: ButtonType.Normal }).height(50).layoutWeight(1).borderRadius(16).fontSize(16)
          .backgroundColor('#F0EBE4').fontColor('#67615A').onClick(() => this.owner?.cancelDelete())
        Button('删除', { type: ButtonType.Normal }).height(50).layoutWeight(1).borderRadius(16).fontSize(16)
          .backgroundColor('#B65745').fontColor('#FFFFFF').onClick(() => this.owner?.deleteConfirmed())
      }.width('100%').margin({ top: 28 })
    }.width('100%').padding({ left: 24, right: 24, top: 22, bottom: 24 }).backgroundColor('#FFFDF9')
      .borderRadius(24).shadow({ radius: 18, color: '#22000000' })
  }
  build() {
    Stack() {
      if (this.editorOpen) { this.Editor(); }
      else {
      MomentDetailPanel({ state: this.state, onClose: this.onBack, onRetry: () => this.read(), onRequireLogin: this.onRequireLogin,
        canManage: this.ownerState.canManage, managementEnabled: this.ownerState.canWrite,
        managementBusy: this.ownerState.deleting || this.ownerState.verifying,
        managementMessage: this.ownerState.message, canVerifyManagement: this.ownerState.canVerify,
        onEdit: () => this.openEditor(), onDelete: () => this.owner?.requestDelete(), onVerifyManagement: () => this.owner?.verify(),
        onToggleFavorite: (item: MomentSummary) => { if (!this.ownerState.deleting && !this.ownerState.verifying) { this.interactions?.toggleFavorite(item); } },
        onOpenAuthor: (item: MomentSummary) => this.openAuthor(item), onToggleLike: () => {
          if (this.state.item !== undefined && !this.ownerState.deleting && !this.ownerState.verifying) { this.interactions?.toggleLike(this.state.item); }
        } })
      }
      if (this.deleteOpen) {
        Column() {
          Blank()
          this.DeleteConfirmation()
        }.width('100%').height('100%').padding({ left: 16, right: 16, bottom: 20 }).backgroundColor('#66000000').onClick(() => {})
      }
    }.width('100%').height('100%').backgroundColor('#FBF7EF').onAppear(() => this.observe())
  }
}