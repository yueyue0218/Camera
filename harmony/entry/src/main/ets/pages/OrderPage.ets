import { AppClient } from '../app/AppClient';
import { PortraEmptyView } from '../common/components/PortraEmptyView';
import { PortraErrorView } from '../common/components/PortraErrorView';
import { PortraLoading } from '../common/components/PortraLoading';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { OrderSummary } from '../model/ApiModels';
import { OrderWorkflow } from '../features/conversation/OrderWorkflow';
import { ConversationVisibility } from '../features/conversation/ConversationVisibility';
import { PortraError } from '../network/ErrorMapper';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct OrderPage {
  @Prop @Watch('onReloadRequested') reloadEpoch: number = 0;
  @State private loading: boolean = true;
  @State private errorMessage: string = '';
  @State private orders: OrderSummary[] = [];
  @State private role: string = '';
  @State private filter: number = 0;
  private readonly appClient: AppClient = AppClient.shared;
  private requestVersion: number = 0;
  onBack?: () => void;
  onOpenOrder?: (orderId: number) => void;

  private onReloadRequested(): void {
    // Initial appearance already loads; retained destinations reload on real Navigation show.
    if (!this.loading) { this.load(); }
  }

  aboutToAppear(): void {
    ConversationVisibility.subscribe('orders', (visible: boolean) => {
      if (visible) this.load();
      else this.appClient.apiService.cancelOrders();
    });
  }

  aboutToDisappear(): void {
    ConversationVisibility.unsubscribe('orders');
    this.requestVersion++;
    this.appClient.apiService.cancelOrders();
    this.appClient.apiService.cancelCurrentSession('orders.identity');
  }

  private async load(): Promise<void> {
    const version = ++this.requestVersion;
    const epoch = this.appClient.sessionManager.getSessionVersion();
    this.loading = true;
    this.errorMessage = '';
    this.orders = [];
    this.role = '';
    try {
      const session = await this.appClient.apiService.currentSession('orders.identity');
      if (version !== this.requestVersion || epoch !== this.appClient.sessionManager.getSessionVersion()) { return; }
      if (session.role !== 'CUSTOMER' && session.role !== 'PROVIDER') { throw new Error('当前身份不能查看约拍订单'); }
      this.role = session.role;
      const result = await this.appClient.apiService.listOrders(session.role);
      if (version === this.requestVersion && epoch === this.appClient.sessionManager.getSessionVersion()) {
        if (!Array.isArray(result)) {
          this.errorMessage = '订单暂时无法查看';
        } else {
          this.orders = result.filter((item: OrderSummary) => item !== null &&
            Number.isSafeInteger(item.orderId) && item.orderId > 0);
        }
      }
    } catch (error) {
      if (version === this.requestVersion && epoch === this.appClient.sessionManager.getSessionVersion()) {
        this.errorMessage = (error as PortraError).message || '订单加载失败';
      }
    } finally {
      if (version === this.requestVersion) {
        this.loading = false;
      }
    }
  }

  private isClosed(status: string | undefined): boolean {
    return status === 'COMPLETED' || status === 'CANCELLED' || status === 'REFUNDED';
  }

  private visibleOrders(): OrderSummary[] {
    if (this.filter === 0) {
      return this.orders;
    }
    return this.orders.filter((order: OrderSummary) =>
      this.filter === 2 ? this.isClosed(order.status) : !this.isClosed(order.status));
  }

  @Builder
  private FilterTab(label: string, index: number) {
    Text(label)
      .fontSize(13)
      .fontWeight(this.filter === index ? FontWeight.Bold : FontWeight.Regular)
      .fontColor(this.filter === index ? PortraTheme.white : PortraTheme.secondaryText)
      .padding({ left: 15, right: 15, top: 8, bottom: 8 })
      .backgroundColor(this.filter === index ? PortraTheme.primary : PortraTheme.surface)
      .borderRadius(6)
      .onClick(() => this.filter = index)
  }

  build() {
    Column() {
      PortraPageHeading({ title: this.role === 'PROVIDER' ? '摄影订单' : '我的订单', eyebrow: 'ORDERS / PORTRA', onBack: this.onBack })
      Row({ space: 8 }) {
        this.FilterTab('全部', 0)
        this.FilterTab('进行中', 1)
        this.FilterTab('已结束', 2)
      }
      .width('100%')
      .padding({ left: 20, right: 20, top: 10, bottom: 14 })

      if (this.loading) {
        PortraLoading({ label: '正在读取订单' })
      } else if (this.errorMessage.length > 0) {
        PortraErrorView({ message: this.errorMessage, onRetry: () => this.load() })
      } else if (this.visibleOrders().length === 0) {
        PortraEmptyView({ message: this.orders.length === 0 ? '暂无订单' : '这个状态下没有订单' })
      } else {
        Scroll() {
          Column({ space: 12 }) {
            ForEach(this.visibleOrders(), (item: OrderSummary) => {
              Column({ space: 13 }) {
                Row() {
                  Text([item.customerNickname, item.providerNickname].filter((name: string | undefined) =>
                    typeof name === 'string' && name.trim().length > 0).join(' · ') || '约拍双方')
                    .layoutWeight(1)
                    .fontSize(12)
                    .fontColor(PortraTheme.secondaryText)
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                  Text(OrderWorkflow.status(item.status))
                    .fontSize(12)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(this.isClosed(item.status) ? PortraTheme.secondaryText : PortraTheme.primary)
                }
                .width('100%')
                Row() {
                  Column({ space: 5 }) {
                    Text('约拍')
                      .fontSize(17)
                      .fontWeight(FontWeight.Bold)
                      .fontColor(PortraTheme.primaryText)
                    Text((item.shootStartTime ?? '').replace('T', ' ').slice(0, 16) || '拍摄时间待定')
                      .fontSize(12)
                      .fontColor(PortraTheme.secondaryText)
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })
                  }
                  .layoutWeight(1)
                  Text(OrderWorkflow.money(item.amountCent))
                    .fontSize(17)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(PortraTheme.primaryText)
                    .constraintSize({ maxWidth: 130 })
                    .maxLines(1)
                    .textOverflow({ overflow: TextOverflow.Ellipsis })
                }
                .width('100%')
                Divider().color(PortraTheme.border)
                Row() {
                  Text(item.shootLocation ?? '')
                    .layoutWeight(1)
                    .fontSize(11)
                    .fontColor(PortraTheme.mutedText)
                  Text('查看详情 ›')
                    .fontSize(12)
                    .fontColor(PortraTheme.primary)
                }
                .width('100%')
              }
              .width('100%')
              .padding(16)
              .backgroundColor(PortraTheme.surface)
              .borderRadius(8)
              .border({ width: 1, color: PortraTheme.border })
              .onClick(() => this.onOpenOrder?.(item.orderId))
            }, (item: OrderSummary) => item.orderId.toString())
          }
          .width('100%')
          .padding({ left: 20, right: 20, bottom: 24 })
        }
        .layoutWeight(1)
        .scrollBar(BarState.Off)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(PortraTheme.pageBackground)
  }
}
