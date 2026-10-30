import { MessagePage } from '../../pages/MessagePage';
import { ProfilePage } from '../../pages/ProfilePage';
import { NotificationTarget } from '../notifications/NotificationTargetResolver';
import { uiObserver } from '@kit.ArkUI';
import { HallSearchPanel } from '../search/HallSearchPanel';
import { PortraBottomNav } from '../../common/components/PortraBottomNav';
import { AppRoute } from '../../model/NavigationModels';
import { HallPage } from '../../pages/HallPage';
import { MomentFeedPage } from '../../pages/MomentFeedPage';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraAppShell {
  @Link selectedTab: number;
  @Prop sessionEpoch: number = 0;
  @State private messageVisited: boolean = false;
  @State private profileVisited: boolean = false;
  onRequireTabLogin?: (tab: number) => void;
  onOpenTarget?: (target: NotificationTarget) => void;
  onSignedOut?: () => void;
  onIdentityChanged?: () => void;
  onOpenAuthor?: (userId: number, role: string) => void;
  onRequireMomentLogin?: () => void;

  onEditDemand?: (id: number) => void;
  onEditService?: (id: number) => void;
  onPrivacyConsentWithdrawn?: () => void;
  onOpenRoute?: (route: AppRoute, id?: number) => void;

  @State private hallReselectEpoch: number = 0;

  @State private searchOpen: boolean = false;

  private searchRouteVisible(update?: uiObserver.NavDestinationInfo): boolean {
    const navigation = this.queryNavigationInfo(); let destination = this.queryNavDestinationInfo();
    if (navigation === undefined) { throw new Error('Navigation unavailable'); }
    if (destination === undefined) { return navigation.pathStack.size() === 0; }
    if (update?.navDestinationId === destination.navDestinationId) { destination = update; }
    return destination.index === navigation.pathStack.size() - 1 &&
      destination.state !== uiObserver.NavDestinationState.ON_HIDDEN && destination.state !== uiObserver.NavDestinationState.ON_WILL_HIDE &&
      destination.state !== uiObserver.NavDestinationState.ON_DISAPPEAR && destination.state !== uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
  }
  private openSearch(): void { this.searchOpen = true; }
  private openSearchResult(route: AppRoute, id: number): void {
    this.searchOpen = false;
    this.onOpenRoute?.(route, id);
  }

  private selectTab(index: number): void {
    if (index === 0 && this.selectedTab === 0) {
      this.hallReselectEpoch++;
      return;
    }
    this.selectedTab = index;
  }

  build() {
    Column() {
      Stack() {
        HallPage({ reselectEpoch: this.hallReselectEpoch, sessionEpoch: this.sessionEpoch,
          hallActive: this.selectedTab === 0, onOpenAuthor: this.onOpenAuthor,
          onSearch: () => this.openSearch(),
          onNotice: () => this.onOpenRoute?.(AppRoute.NOTIFICATIONS),
          onPublish: () => this.onOpenRoute?.(AppRoute.PUBLISH),
          onOpenService: (serviceId: number) => this.onOpenRoute?.(AppRoute.SERVICE_DETAIL, serviceId),
          onOpenDemand: (demandId: number) => this.onOpenRoute?.(AppRoute.DEMAND_DETAIL, demandId)
        })
          .visibility(this.selectedTab === 0 ? Visibility.Visible : Visibility.None)
      if (this.selectedTab === 1) {
        MomentFeedPage({ onRequireLogin: () => this.onRequireMomentLogin !== undefined ?
          this.onRequireMomentLogin() : this.onOpenRoute?.(AppRoute.LOGIN), onOpenAuthor: this.onOpenAuthor })
          .layoutWeight(1)
      }
      if (this.messageVisited || this.selectedTab === 2) {
        MessagePage({ activeTab: this.selectedTab === 2, sessionEpoch: this.sessionEpoch,
          onRequireLogin: () => this.onRequireTabLogin?.(2),
          onOpenMoment: (id: number) => this.onOpenRoute?.(AppRoute.MOMENT_DETAIL, id),
          onOpenCredit: () => this.onOpenRoute?.(AppRoute.CREDIT),
          onOpenOrders: () => this.onOpenRoute?.(AppRoute.ORDER), onOpenTarget: this.onOpenTarget,
          onOpenConversation: (id: number) => this.onOpenRoute?.(AppRoute.CONVERSATION_DETAIL, id) })
          .onAppear(() => this.messageVisited = true)
          .visibility(this.selectedTab === 2 ? Visibility.Visible : Visibility.None)
      }
      if (this.profileVisited || this.selectedTab === 3) {
        ProfilePage({ activeTab: this.selectedTab === 3, sessionEpoch: this.sessionEpoch,
          onRequireLogin: () => this.onRequireTabLogin?.(3), onSignedOut: this.onSignedOut,
          onIdentityChanged: this.onIdentityChanged,
          onOpenDemand: (id: number) => this.onOpenRoute?.(AppRoute.DEMAND_DETAIL, id),
          onOpenService: (id: number) => this.onOpenRoute?.(AppRoute.SERVICE_DETAIL, id),
          onOpenMoment: (id: number) => this.onOpenRoute?.(AppRoute.MOMENT_DETAIL, id),
          onOpenAuthor: this.onOpenAuthor,
          onEditDemand: this.onEditDemand, onEditService: this.onEditService,
          onOpenCredit: () => this.onOpenRoute?.(AppRoute.CREDIT),
          onOpenOrders: () => this.onOpenRoute?.(AppRoute.ORDER),
          onOpenMessages: () => this.selectTab(2), onOpenPublish: () => this.onOpenRoute?.(AppRoute.PUBLISH),
          onPrivacyConsentWithdrawn: this.onPrivacyConsentWithdrawn })
          .onAppear(() => this.profileVisited = true)
          .visibility(this.selectedTab === 3 ? Visibility.Visible : Visibility.None)
      }
      }.layoutWeight(1).width('100%')

      PortraBottomNav({ selectedIndex: this.selectedTab, onSelect: (index: number) => this.selectTab(index) })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
    .bindSheet(this.searchOpen, this.SearchBody(), { height: SheetSize.LARGE, showClose: false,
      backgroundColor: PortraTheme.surface, keyboardAvoidMode: SheetKeyboardAvoidMode.RESIZE_ONLY,
      onWillDismiss: (action: DismissSheetAction) => { this.searchOpen = false; action.dismiss(); } })
  }
  @Builder
  private SearchBody() {
    HallSearchPanel({ routeVisible: (update?: uiObserver.NavDestinationInfo) => this.searchRouteVisible(update),
      onRequireLogin: () => { this.searchOpen = false; this.onOpenRoute?.(AppRoute.LOGIN); }, onClose: () => this.searchOpen = false,
      onOpenService: (id: number) => this.openSearchResult(AppRoute.SERVICE_DETAIL, id),
      onOpenDemand: (id: number) => this.openSearchResult(AppRoute.DEMAND_DETAIL, id) })
  }
}
