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

  private showPending(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message: message, duration: 1600 });
    } catch {
      // A missing UI context must not turn a placeholder entry into an app crash.
    }
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
          onSearch: () => this.showPending('搜索功能将在后续业务接入'),
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
  }
}
