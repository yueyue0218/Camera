import { AppClient } from '../../app/AppClient';
import { DemandInterestSummary } from '../../model/ApiModels';
import { PortraImage } from '../../common/components/PortraImage';
import { HallTextFormatter } from '../hall/HallUiModels';
import { PortraTheme } from '../../theme/PortraTheme';
import { ContentChanges } from './ContentChanges';

@Component
export struct DemandInterestList {
  @Prop @Watch('reload') identityKey: string = '';
  @State private records: DemandInterestSummary[] = [];
  @State private page: number = 0;
  @State private total: number = 0;
  @State private loading: boolean = false;
  @State private error: string = '';
  @State private busyId: number = 0;
  private generation: number = 0;
  private readonly app: AppClient = AppClient.shared;
  private readonly changed: (kind?: string) => void = (kind?: string) => {
    if (kind === 'demand-interest') { this.reload(); }
  };
  onOpenDemand?: (id: number) => void;
  onBrowse?: () => void;

  aboutToAppear(): void { ContentChanges.observe(this.changed); this.reload(); }
  aboutToDisappear(): void {
    this.generation++; ContentChanges.unobserve(this.changed); this.app.apiService.cancelDemandInterests();
  }
  private reload(): void { this.load(); }
  private async load(append: boolean = false): Promise<void> {
    if (append && this.loading) { return; }
    const generation = ++this.generation;
    const epoch = this.app.sessionManager.getSessionVersion();
    const page = append ? this.page + 1 : 1;
    this.loading = true; this.error = '';
    if (!append) { this.records = []; this.page = 0; this.total = 0; }
    try {
      const result = await this.app.apiService.listDemandInterests(page, 10);
      if (generation !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
      if (!result || result.page !== page || !Array.isArray(result.records) ||
        !Number.isSafeInteger(result.total) || result.total < 0 || result.records.some((row: DemandInterestSummary) =>
          !row || row.targetType !== 'DEMAND' || row.interested !== true ||
          !Number.isSafeInteger(row.demandId) || row.demandId <= 0 ||
          (row.demand !== null && row.demand !== undefined && row.demand.demandId !== row.demandId))) {
        throw new Error('需求意向分页数据异常');
      }
      this.records = this.records.concat(result.records.filter((row: DemandInterestSummary) =>
        !this.records.some((old: DemandInterestSummary) => old.demandId === row.demandId)));
      this.page = page; this.total = result.total;
    } catch (error) {
      if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion()) {
        this.error = (error as Error).message || '需求意向读取失败';
      }
    } finally { if (generation === this.generation) { this.loading = false; } }
  }
  private async remove(row: DemandInterestSummary): Promise<void> {
    if (this.busyId > 0) { return; }
    const generation = this.generation;
    const epoch = this.app.sessionManager.getSessionVersion();
    this.busyId = row.demandId; this.error = '';
    try {
      await this.app.apiService.removeDemandInterest(row.demandId);
      if (generation !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
      ContentChanges.publish('demand-interest');
    } catch (error) {
      if (generation === this.generation && epoch === this.app.sessionManager.getSessionVersion()) {
        this.error = (error as Error).message || '移出意向失败';
      }
    } finally { this.busyId = 0; }
  }

  @Builder
  private Card(row: DemandInterestSummary) {
    Column({ space: 10 }) {
      Row({ space: 12 }) {
        PortraImage({ fileId: row.demand?.referenceFileIds?.[0] ?? 0, imageWidth: 72, imageHeight: 88,
          cornerRadius: 10, fallbackText: '需求', contentDescription: '需求封面' })
        Column({ space: 6 }) {
          Text(row.demand?.scene || '需求已删除或不可见').fontSize(14).fontWeight(FontWeight.Medium)
            .fontColor(PortraTheme.primaryText).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
          if (row.demand !== null && row.demand !== undefined) {
            Text(row.demand?.customerNickname || '需求发布者').fontSize(11).fontColor(PortraTheme.secondaryText)
            Text(HallTextFormatter.budget(row.demand?.budgetMinCent, row.demand?.budgetMaxCent))
              .fontSize(12).fontColor(PortraTheme.primary)
            Text(row.demand?.cityCode || row.demand?.location || '地区未填写')
              .fontSize(11).fontColor(PortraTheme.secondaryText).maxLines(1)
          }
          Text(row.status === 'UNAVAILABLE' ? '内容不可用，已隐藏详情' : row.status)
            .fontSize(10).fontColor(PortraTheme.secondaryText)
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
      }.width('100%')
      Row({ space: 10 }) {
        if (row.demand !== null && row.demand !== undefined) {
          Button('查看详情').height(34).fontSize(12).fontColor(PortraTheme.primary)
            .backgroundColor(PortraTheme.primarySoft).onClick(() => this.onOpenDemand?.(row.demandId))
        }
        Button(this.busyId === row.demandId ? '正在移出…' : '移出意向').height(34).fontSize(12)
          .fontColor(PortraTheme.secondaryText).backgroundColor(PortraTheme.pageBackground)
          .enabled(this.busyId === 0).onClick(() => this.remove(row))
      }.width('100%')
    }.width('100%').padding(12).backgroundColor(PortraTheme.surface).borderRadius(15)
      .border({ width: 1, color: PortraTheme.border }).alignItems(HorizontalAlign.Start)
  }

  build() {
    Column({ space: 12 }) {
      if (this.loading) { Text('正在读取需求意向…').fontSize(13).fontColor(PortraTheme.secondaryText) }
      if (this.error.length > 0) {
        Text(this.error).fontSize(12).fontColor(PortraTheme.danger)
        Button('重试').height(36).enabled(!this.loading).onClick(() => this.load())
      }
      if (!this.loading && !this.error && this.records.length === 0) {
        Text('还没有感兴趣的需求').width('100%').padding(22).fontSize(14)
          .fontColor(PortraTheme.secondaryText).textAlign(TextAlign.Center)
        Button('去大厅浏览需求').height(39).fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft).onClick(() => this.onBrowse?.())
      }
      ForEach(this.records, (row: DemandInterestSummary) => { this.Card(row) },
        (row: DemandInterestSummary) => `${row.demandId}:${row.status}`)
      if (this.page * 10 < this.total) {
        Button(this.loading ? '加载中…' : '加载更多').width('100%').height(39)
          .enabled(!this.loading).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
          .onClick(() => this.load(true))
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
  }
}
