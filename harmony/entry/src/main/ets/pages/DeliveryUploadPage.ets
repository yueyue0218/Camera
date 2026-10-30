import { common } from '@kit.AbilityKit';
import { AppClient } from '../app/AppClient';
import { PortraPageHeading } from '../common/components/PortraPageHeading';
import { DeliveryTransfer, SelectedDeliveryFile } from '../features/delivery/DeliveryTransfer';
import { OrderWorkflow } from '../features/conversation/OrderWorkflow';
import { DeliverySummary, OrderSummary } from '../model/ApiModels';
import { PortraTheme } from '../theme/PortraTheme';

@Component
export struct DeliveryUploadPage {
  @Prop orderId: number = 0;
  @State private order: OrderSummary | null = null;
  @State private userId: number = 0;
  @State private selected: SelectedDeliveryFile[] = [];
  @State private busy: boolean = false;
  @State private progress: number = 0;
  @State private uncertain: boolean = false;
  @State private discardOpen: boolean = false;
  @State private error: string = '';
  private readonly api = AppClient.shared.apiService;
  private readonly transfer = new DeliveryTransfer();
  private previousIds: Set<number> = new Set<number>();
  onBack?: () => void;
  onUploaded?: () => void;

  aboutToAppear(): void {
    this.api.getOrder(this.orderId).then((order: OrderSummary) => this.order = order)
      .catch(() => this.error = '约拍暂时无法查看');
    this.api.currentSession().then((session) => this.userId = session.userId)
      .catch(() => this.error = '请先登录');
  }

  aboutToDisappear(): void {
    if (this.busy) this.transfer.cancel();
  }

  private back(): void {
    if (this.busy) return;
    if (this.selected.length > 0) this.discardOpen = true;
    else this.onBack?.();
  }

  private addFiles(files: SelectedDeliveryFile[]): void {
    const seen = new Set<string>(this.selected.map((file: SelectedDeliveryFile) => file.uri));
    const added = files.filter((file: SelectedDeliveryFile) => !seen.has(file.uri));
    if (this.selected.length + added.length > 20) {
      this.error = '一次最多选择 20 个文件';
      return;
    }
    this.selected = [...this.selected, ...added];
    this.error = '';
  }

  private async pickPhotos(): Promise<void> {
    try {
      this.addFiles(await DeliveryTransfer.pickPhotos(20 - this.selected.length));
    } catch (error) {
      this.error = (error as Error).message || '照片选择未完成';
    }
  }

  private async pickZip(): Promise<void> {
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      this.addFiles(await DeliveryTransfer.pickZip(context, 20 - this.selected.length));
    } catch (error) {
      this.error = (error as Error).message || '文件选择未完成';
    }
  }

  private async reconcile(): Promise<void> {
    try {
      const results = await Promise.all([this.api.getOrder(this.orderId), this.api.listDeliveries(this.orderId)]);
      const order = results[0] as OrderSummary;
      const deliveries = results[1] as DeliverySummary[];
      if (deliveries.some((batch: DeliverySummary) => !this.previousIds.has(batch.deliveryId)) &&
        order.status === 'DELIVERED_PENDING_CONFIRM') {
        this.selected = [];
        this.uncertain = false;
        this.onUploaded?.();
        return;
      }
      this.order = order;
      if (OrderWorkflow.canUpload(order, this.userId)) {
        this.uncertain = false;
        this.error = '尚未上传，可重新尝试';
      } else {
        this.error = '订单状态已更新，请返回查看';
      }
    } catch {
      this.error = '暂时无法核对上传结果，请稍后再试';
    }
  }

  private async upload(): Promise<void> {
    const session = AppClient.shared.sessionManager.getSession();
    if (this.busy || this.uncertain || this.selected.length === 0 || this.order === null ||
      !session || !OrderWorkflow.canUpload(this.order, this.userId)) return;
    this.busy = true;
    this.progress = 0;
    this.error = '';
    try {
      const existing = await this.api.listDeliveries(this.orderId);
      this.previousIds = new Set<number>(existing.map((item: DeliverySummary) => item.deliveryId));
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      await this.transfer.upload(context, this.orderId, this.selected, session.accessToken,
        (percent: number) => this.progress = percent);
      this.uncertain = true;
      await this.reconcile();
    } catch {
      this.uncertain = true;
      this.error = '上传结果待确认，请先核对订单';
    } finally { this.busy = false; }
  }

  build() {
    Stack() {
      Column() {
        PortraPageHeading({ title: '上传照片', eyebrow: '', onBack: () => this.back() })
        Scroll() {
          Column({ space: 16 }) {
            if (this.order !== null) {
              Text(OrderWorkflow.task(this.order!, this.userId))
                .fontSize(15).fontColor(PortraTheme.primaryText)
            }
            Row({ space: 10 }) {
              Button('选择照片').layoutWeight(1).height(48)
                .enabled(!this.busy && !this.uncertain && this.selected.length < 20)
                .onClick(() => this.pickPhotos())
              Button('选择 ZIP').layoutWeight(1).height(48).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.primary).enabled(!this.busy && !this.uncertain && this.selected.length < 20)
                .onClick(() => this.pickZip())
            }.width('100%')
            ForEach(this.selected, (file: SelectedDeliveryFile) => {
              Row({ space: 10 }) {
                if (file.mimeType.startsWith('image/')) {
                  Image(file.uri).width(58).height(58).objectFit(ImageFit.Cover).borderRadius(4)
                } else {
                  Text('ZIP').width(58).height(58).fontColor(PortraTheme.primary)
                    .textAlign(TextAlign.Center).backgroundColor(PortraTheme.primarySoft)
                }
                Text(file.fileName).fontSize(13).fontColor(PortraTheme.primaryText)
                  .layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
                Button('移除').enabled(!this.busy && !this.uncertain).onClick(() =>
                  this.selected = this.selected.filter((item: SelectedDeliveryFile) => item.uri !== file.uri))
              }.width('100%').padding(8).backgroundColor(PortraTheme.surface).borderRadius(6)
            }, (file: SelectedDeliveryFile) => file.uri)
            if (this.busy) Text(`正在上传 ${this.progress}%`).fontSize(13).fontColor(PortraTheme.primary)
            if (this.error) Text(this.error).fontSize(12).fontColor(PortraTheme.danger)
          }.width('100%').padding(18)
        }.layoutWeight(1)
        Button(this.uncertain ? '核对结果' : this.busy ? '上传中' : '确认上传')
          .height(48).width('100%').enabled(!this.busy && (this.uncertain || this.selected.length > 0))
          .onClick(() => this.uncertain ? this.reconcile() : this.upload())
          .padding({ left: 18, right: 18, bottom: 16 })
      }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
      if (this.discardOpen) {
        Column() {
          Blank().layoutWeight(1)
          Column({ space: 16 }) {
            Text('放弃已选照片？').fontSize(17).fontWeight(FontWeight.Bold)
            Row({ space: 12 }) {
              Button('继续编辑').layoutWeight(1).onClick(() => this.discardOpen = false)
              Button('放弃').layoutWeight(1).backgroundColor(PortraTheme.surface)
                .fontColor(PortraTheme.danger).onClick(() => { this.selected = []; this.onBack?.(); })
            }.width('100%')
          }.width('100%').padding(20).backgroundColor(PortraTheme.surface)
        }.width('100%').height('100%').backgroundColor('#66000000')
      }
    }.width('100%').height('100%')
  }
}
