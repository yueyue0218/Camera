import { AppClient } from '../app/AppClient';
import { HallView } from '../features/hall/HallView';
import { HallContentState } from '../features/hall/HallUiModels';
import { DemandSummary, PageResult, ServicePackageSummary } from '../model/ApiModels';
import { ErrorMapper, PortraError } from '../network/ErrorMapper';

@Component
export struct HallPage {
  @State private serviceState: HallContentState = HallContentState.LOADING;
  @State private demandState: HallContentState = HallContentState.LOADING;
  @State private serviceItems: ServicePackageSummary[] = [];
  @State private demandItems: DemandSummary[] = [];
  @State private serviceError: string = '';
  @State private demandError: string = '';
  private readonly apiService = AppClient.shared.apiService;
  private loadVersion: number = 0;
  onSearch?: () => void;
  onNotice?: () => void;
  onPublish?: () => void;
  onOpenService?: (serviceId: number) => void;
  onOpenDemand?: (demandId: number) => void;

  aboutToAppear(): void {
    this.reload();
  }

  aboutToDisappear(): void {
    this.loadVersion++;
    this.apiService.cancelServicePackages();
    this.apiService.cancelDemands();
  }

  private reload(): void {
    const version = ++this.loadVersion;
    this.serviceState = HallContentState.LOADING;
    this.demandState = HallContentState.LOADING;
    this.serviceError = '';
    this.demandError = '';
    this.loadServices(version);
    this.loadDemands(version);
  }

  private async loadServices(version: number): Promise<void> {
    try {
      const result: PageResult<ServicePackageSummary> = await this.apiService.listServicePackages(1, 20);
      if (version !== this.loadVersion) {
        return;
      }
      if (!Array.isArray(result.records)) {
        this.serviceState = HallContentState.ERROR;
        this.serviceError = '服务器返回的摄影橱窗列表无法识别。';
        return;
      }
      this.serviceItems = result.records;
      this.serviceState = result.records.length === 0 ? HallContentState.EMPTY : HallContentState.CONTENT;
    } catch (error) {
      if (version !== this.loadVersion || this.isStale(error)) {
        return;
      }
      this.serviceState = HallContentState.ERROR;
      this.serviceError = this.messageFor(error);
    }
  }

  private async loadDemands(version: number): Promise<void> {
    try {
      const result: PageResult<DemandSummary> = await this.apiService.listDemands(1, 20);
      if (version !== this.loadVersion) {
        return;
      }
      if (!Array.isArray(result.records)) {
        this.demandState = HallContentState.ERROR;
        this.demandError = '服务器返回的约拍需求列表无法识别。';
        return;
      }
      this.demandItems = result.records;
      this.demandState = result.records.length === 0 ? HallContentState.EMPTY : HallContentState.CONTENT;
    } catch (error) {
      if (version !== this.loadVersion || this.isStale(error)) {
        return;
      }
      this.demandState = HallContentState.ERROR;
      this.demandError = this.messageFor(error);
    }
  }

  private isStale(error: Object): boolean {
    return ErrorMapper.isStale(error as PortraError);
  }

  private messageFor(error: Object): string {
    const mapped = error as PortraError;
    return mapped.message?.length > 0 ? mapped.message : '加载失败，请稍后再试。';
  }

  build() {
    HallView({
      serviceState: this.serviceState,
      demandState: this.demandState,
      serviceItems: this.serviceItems,
      demandItems: this.demandItems,
      serviceError: this.serviceError,
      demandError: this.demandError,
      onSearch: this.onSearch,
      onNotice: this.onNotice,
      onPublish: this.onPublish,
      onRetry: () => this.reload(),
      onOpenService: this.onOpenService,
      onOpenDemand: this.onOpenDemand
    })
  }
}
