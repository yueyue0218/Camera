import { PortraBottomNav } from '../../common/components/PortraBottomNav';
import { PortraEmptyView } from '../../common/components/PortraEmptyView';
import { AppRoute } from '../../model/NavigationModels';
import { HallPage } from '../../pages/HallPage';
import { PortraTheme } from '../../theme/PortraTheme';

@Component
export struct PortraAppShell {
  @State private selectedTab: number = 0;
  onOpenRoute?: (route: AppRoute, demandId?: number) => void;

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
          onNotice: () => this.showPending('通知中心将在后续业务接入'),
          onPublish: () => this.onOpenRoute?.(AppRoute.PUBLISH),
          onOpenService: () => this.showPending('摄影橱窗详情将在后续接入'),
          onOpenDemand: (demandId: number) => this.onOpenRoute?.(AppRoute.DEMAND_DETAIL, demandId)
        })
          .layoutWeight(1)
      } else {
        Column() {
          Text('动态')
            .fontSize(24)
            .fontWeight(FontWeight.Bold)
            .fontColor(PortraTheme.primaryText)
          PortraEmptyView({ message: '动态业务不在本轮实现范围内' })
        }
        .layoutWeight(1)
        .width('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .backgroundColor(PortraTheme.pageBackground)
      }

      PortraBottomNav({ selectedIndex: this.selectedTab, onSelect: (index: number) => this.selectTab(index) })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
