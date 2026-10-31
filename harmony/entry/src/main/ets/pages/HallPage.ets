import { HallFilterState } from '../features/hall/HallFilterState';
import { ContentChanges } from '../features/user/ContentChanges';
import { AppClient } from '../app/AppClient';
import { HallView } from '../features/hall/HallView';
import { HallDataPolicy } from '../features/hall/HallDataPolicy';
import { HallContentState } from '../features/hall/HallUiModels';
import { DemandListQuery, DemandSummary, PageResult, ServicePackageListQuery,
  ServicePackageSummary } from '../model/ApiModels';
import { ErrorMapper, PortraError } from '../network/ErrorMapper';

@Component
export struct HallPage {
  @State private filters: HallFilterState = new HallFilterState();
  private readonly contentChanged: () => void = () => this.reload();
  @State private serviceState: HallContentState = HallContentState.LOADING;
  @State private demandState: HallContentState = HallContentState.LOADING;
  @State private serviceItems: ServicePackageSummary[] = [];
  @State private demandItems: DemandSummary[] = [];
  @State private serviceError: string = '';
  @State private demandError: string = '';
  @State private serviceSort: string = 'recommend';
  @State private demandSort: string = 'latest';
  @State private serviceHasMore: boolean = false;
  @State private demandHasMore: boolean = false;
  @State private serviceLoadingMore: boolean = false;
  @State private demandLoadingMore: boolean = false;
  private readonly apiService = AppClient.shared.apiService;
  private readonly pageSize: number = 20;
  private readonly feedSeed: string = Date.now().toString();
  private loadVersion: number = 0;
  private servicePage: number = 0;
  private demandPage: number = 0;
  onSearch?: () => void;
  onNotice?: () => void;
  onPublish?: () => void;
  onOpenService?: (serviceId: number) => void;
  onOpenDemand?: (demandId: number) => void;

  aboutToAppear(): void {
    ContentChanges.observe(this.contentChanged);
    this.reload();
  }

  aboutToDisappear(): void {
    ContentChanges.unobserve(this.contentChanged);
    this.loadVersion++;
    this.apiService.cancelServicePackages();
    this.apiService.cancelDemands();
  }

  private reload(): void {
    const version = ++this.loadVersion;
    this.servicePage = 0;
    this.demandPage = 0;
    this.serviceHasMore = false;
    this.demandHasMore = false;
    this.serviceLoadingMore = false;
    this.demandLoadingMore = false;
    this.serviceState = HallContentState.LOADING;
    this.demandState = HallContentState.LOADING;
    this.serviceError = '';
    this.demandError = '';
    this.loadServices(version, 1, false);
    this.loadDemands(version, 1, false);
  }

  private async loadServices(version: number, page: number, append: boolean): Promise<void> {
    if (append) {
      if (this.serviceLoadingMore || !this.serviceHasMore) {
        return;
      }
      this.serviceLoadingMore = true;
    }
    try {
      const query: ServicePackageListQuery = {
        page: page, size: this.pageSize, cityCode: this.filters.city || undefined, sort: this.serviceSort, feedSeed: this.feedSeed
      };
      const result: PageResult<ServicePackageSummary> = await this.apiService.listServicePackagesByQuery(query);
      if (version !== this.loadVersion) {
        return;
      }
      if (!HallDataPolicy.validPage(result)) {
        this.serviceState = HallContentState.ERROR;
        this.serviceError = '服务器返回的摄影橱窗列表无法识别。';
        return;
      }
      this.serviceItems = append ? HallDataPolicy.mergeServices(this.serviceItems, result.records) :
        HallDataPolicy.mergeServices([], result.records);
      this.servicePage = result.page;
      this.serviceHasMore = HallDataPolicy.hasMore(this.serviceItems.length, result.total);
      this.serviceState = this.serviceItems.length === 0 ? HallContentState.EMPTY : HallContentState.CONTENT;
    } catch (error) {
      if (version !== this.loadVersion) {
        return;
      }
      this.serviceState = HallContentState.ERROR;
      this.serviceError = this.isStale(error) ? '加载已中断，请重试。' : this.messageFor(error);
    } finally {
      if (version === this.loadVersion) {
        this.serviceLoadingMore = false;
      }
    }
  }

  private async loadDemands(version: number, page: number, append: boolean): Promise<void> {
    if (append) {
      if (this.demandLoadingMore || !this.demandHasMore) {
        return;
      }
      this.demandLoadingMore = true;
    }
    try {
      const query: DemandListQuery = {
        page: page, size: this.pageSize, cityCode: this.filters.city || undefined, status: 'OPEN', sort: this.demandSort, feedSeed: this.feedSeed
      };
      const result: PageResult<DemandSummary> = await this.apiService.listDemandsByQuery(query);
      if (version !== this.loadVersion) {
        return;
      }
      if (!HallDataPolicy.validPage(result)) {
        this.demandState = HallContentState.ERROR;
        this.demandError = '服务器返回的约拍需求列表无法识别。';
        return;
      }
      this.demandItems = append ? HallDataPolicy.mergeDemands(this.demandItems, result.records) :
        HallDataPolicy.mergeDemands([], result.records);
      this.demandPage = result.page;
      this.demandHasMore = HallDataPolicy.hasMore(this.demandItems.length, result.total);
      this.demandState = this.demandItems.length === 0 ? HallContentState.EMPTY : HallContentState.CONTENT;
    } catch (error) {
      if (version !== this.loadVersion) {
        return;
      }
      this.demandState = HallContentState.ERROR;
      this.demandError = this.isStale(error) ? '加载已中断，请重试。' : this.messageFor(error);
    } finally {
      if (version === this.loadVersion) {
        this.demandLoadingMore = false;
      }
    }
  }

  private changeServiceSort(sort: string): void {
    if (sort === this.serviceSort || (sort !== 'latest' && sort !== 'recommend')) {
      return;
    }
    this.serviceSort = sort;
    this.reload();
  }

  private changeDemandSort(sort: string): void {
    if (sort === this.demandSort || (sort !== 'latest' && sort !== 'recommend')) {
      return;
    }
    this.demandSort = sort;
    this.reload();
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
      filters: this.filters, onFilterChange: (filters: HallFilterState) => {
        if (filters.validate()) { return; }
        this.filters = filters; this.reload();
      },
      serviceState: this.serviceState,
      demandState: this.demandState,
      serviceItems: this.serviceItems,
      demandItems: this.demandItems,
      serviceError: this.serviceError,
      demandError: this.demandError,
      serviceSort: this.serviceSort,
      demandSort: this.demandSort,
      serviceHasMore: this.serviceHasMore,
      demandHasMore: this.demandHasMore,
      serviceLoadingMore: this.serviceLoadingMore,
      demandLoadingMore: this.demandLoadingMore,
      onSearch: this.onSearch,
      onNotice: this.onNotice,
      onPublish: this.onPublish,
      onRetry: () => this.reload(),
      onOpenService: this.onOpenService,
      onOpenDemand: this.onOpenDemand,
      onServiceSortChange: (sort: string) => this.changeServiceSort(sort),
      onDemandSortChange: (sort: string) => this.changeDemandSort(sort),
      onLoadMoreServices: () => this.loadServices(this.loadVersion, this.servicePage + 1, true),
      onLoadMoreDemands: () => this.loadDemands(this.loadVersion, this.demandPage + 1, true)
    })
  }
}
