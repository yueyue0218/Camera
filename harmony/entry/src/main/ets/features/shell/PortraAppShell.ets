import { uiObserver } from '@kit.ArkUI';
import { HallSearchPanel } from '../search/HallSearchPanel';
import { PortraBottomNav } from '../../common/components/PortraBottomNav';
import { AppRoute } from '../../model/NavigationModels';
import { HallPage } from '../../pages/HallPage';
import { MomentFeedPage } from '../../pages/MomentFeedPage';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraAppShell {
  @Prop initialTab: number = 0;
  onOpenAuthor?: (userId: number, role: string) => void;
  onRequireMomentLogin?: () => void;

  aboutToAppear(): void {
    this.selectedTab = this.initialTab === 1 ? 1 : 0;
  }
  @State private selectedTab: number = 0;
  onOpenRoute?: (route: AppRoute, id?: number) => void;

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
    if (index === 0 || index === 1) {
      this.selectedTab = index;
      return;
    }
    if (index === 2) {
      this.onOpenRoute?.(AppRoute.MESSAGE);
      return;
    }
    this.onOpenRoute?.(AppRoute.PROFILE);
  }

  build() {
    Column() {
      if (this.selectedTab === 0) {
        HallPage({
          onSearch: () => this.openSearch(),
          onNotice: () => this.onOpenRoute?.(AppRoute.NOTIFICATIONS),
          onPublish: () => this.onOpenRoute?.(AppRoute.PUBLISH),
          onOpenService: (serviceId: number) => this.onOpenRoute?.(AppRoute.SERVICE_DETAIL, serviceId),
          onOpenDemand: (demandId: number) => this.onOpenRoute?.(AppRoute.DEMAND_DETAIL, demandId)
        })
          .layoutWeight(1)
      } else {
        MomentFeedPage({ onRequireLogin: () => this.onRequireMomentLogin !== undefined ?
          this.onRequireMomentLogin() : this.onOpenRoute?.(AppRoute.LOGIN), onOpenAuthor: this.onOpenAuthor })
          .layoutWeight(1)
      }

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
