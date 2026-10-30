import { ContentChanges } from '../features/user/ContentChanges';
import { HallFilterState } from '../features/hall/HallFilterState';
import { AppClient } from '../app/AppClient';
import { HallView } from '../features/hall/HallView';
import { HallDataPolicy } from '../features/hall/HallDataPolicy';
import { HallChannel, HallContentState } from '../features/hall/HallUiModels';
import { DemandSummary, PageResult,
  ServicePackageSummary } from '../model/ApiModels';
import { ErrorMapper, PortraError } from '../network/ErrorMapper';

@Component
export struct HallPage {
  @Prop reselectEpoch: number = 0;
  @State private serviceRefreshing: boolean = false;
  @State private demandRefreshing: boolean = false;
  @Prop @Watch('onSessionEpochChanged') sessionEpoch: number = 0;
  @State private serviceState: HallContentState = HallContentState.LOADING;
  @State private demandState: HallContentState = HallContentState.LOADING;
  @State private serviceItems: ServicePackageSummary[] = [];
  @State private demandItems: DemandSummary[] = [];
  @State private serviceError: string = '';
  @State private demandError: string = '';
  @State private serviceFilters: HallFilterState = new HallFilterState();
  @State private demandFilters: HallFilterState = new HallFilterState();
  @State private serviceCities: string[] = [];
  @State private demandCities: string[] = [];
  @State private serviceStyles: string[] = [];
  @State private demandStyles: string[] = [];
  @State private serviceHasMore: boolean = false;
  @State private demandHasMore: boolean = false;
  @State private serviceLoadingMore: boolean = false;
  @State private demandLoadingMore: boolean = false;
  @State private currentRole: string = '';
  @State private roleLoading: boolean = false;
  @State private roleError: string = '';
  private roleLoadVersion: number = 0;
  private readonly apiService = AppClient.shared.apiService;
  private readonly appClient: AppClient = AppClient.shared;
  private readonly pageSize: number = 20;
  private readonly feedSeed: string = Date.now().toString();
  private serviceVersion: number = 0;
  private demandVersion: number = 0;
  private servicePage: number = 0;
  private demandPage: number = 0;
  onSearch?: () => void;
  onNotice?: () => void;
  onPublish?: () => void;
  onOpenAuthor?: (userId: number, role: string) => void;
  onOpenService?: (serviceId: number) => void;
  onOpenDemand?: (demandId: number) => void;

  private readonly changed: () => void = () => this.refreshContent();

  private async refreshContent(): Promise<void> {
    // Each channel invalidates its requests and cursors before reloading page one.
    this.reload();
  }

  aboutToAppear(): void {
    ContentChanges.observe(this.changed);
    this.reload();
    this.loadCurrentRole();
  }

  private onSessionEpochChanged(): void {
    // A role switch, login, or logout must refresh both the role-aware banner and hall data.
    this.serviceFilters = new HallFilterState();
    this.demandFilters = new HallFilterState();
    this.serviceItems = []; this.demandItems = [];
    this.serviceCities = []; this.demandCities = [];
    this.serviceStyles = []; this.demandStyles = [];
    this.reload();
    this.loadCurrentRole();
  }

  // Keep role unknown on a failed authenticated read; show actionable numeric codes.
  private roleFailureLabel(error: Object): string {
    const failure = error as PortraError;
    const message = failure.message || '当前身份读取失败，请重试';
    if (Number.isInteger(failure.businessCode) && failure.businessCode > 0) {
      return `${message}（业务码 ${failure.businessCode}）`;
    }
    if (Number.isInteger(failure.httpStatus) && failure.httpStatus > 0) {
      return `${message}（HTTP ${failure.httpStatus}）`;
    }
    return message;
  }

  private async loadCurrentRole(): Promise<void> {
    const version = ++this.roleLoadVersion;
    this.roleError = '';
    this.currentRole = ''; // Never present an unverified user as CUSTOMER.
    if (!this.appClient.sessionManager.isAuthenticated()) {
      this.roleLoading = false;
      return;
    }
    this.roleLoading = true;
    try {
      const session = await this.apiService.currentSession('hall.identity');
      if (version !== this.roleLoadVersion) { return; }
      const role = session.role.trim().toUpperCase();
      if (role !== 'CUSTOMER' && role !== 'PROVIDER') {
        throw new Error('服务器返回了不支持的账号身份');
      }
      this.currentRole = role;
    } catch (error) {
      if (version !== this.roleLoadVersion) { return; }
      if (!this.appClient.sessionManager.isAuthenticated()) {
        this.currentRole = '';
        this.roleError = '';
      } else {
        this.roleError = this.roleFailureLabel(error);
      }
    } finally {
      if (version === this.roleLoadVersion) { this.roleLoading = false; }
    }
  }

  aboutToDisappear(): void {
    ContentChanges.unobserve(this.changed);
    this.serviceVersion++;
    this.demandVersion++;
    this.serviceRefreshing = false;
    this.demandRefreshing = false;
    this.roleLoadVersion++;
    this.apiService.cancelCurrentSession('hall.identity');
    this.apiService.cancelServicePackages();
    this.apiService.cancelDemands();
  }

  private reload(): void {
    this.startServiceRefresh(false);
    this.startDemandRefresh(false);
  }

  private refreshChannel(channel: HallChannel): void {
    if (channel === HallChannel.SHOWCASES) {
      if (!this.serviceRefreshing) { this.startServiceRefresh(true); }
    } else {
      if (!this.demandRefreshing) { this.startDemandRefresh(true); }
    }
  }

  private startServiceRefresh(preserve: boolean): void {
    const version = ++this.serviceVersion;
    this.apiService.cancelServicePackages();
    this.servicePage = 0;
    this.serviceHasMore = false;
    this.serviceLoadingMore = false;
    this.serviceRefreshing = true;
    if (!preserve) { this.serviceItems = []; }
    this.serviceState = this.serviceItems.length > 0 ? HallContentState.CONTENT : HallContentState.LOADING;
    this.serviceError = '';
    this.loadServices(version, 1, false);
  }

  private startDemandRefresh(preserve: boolean): void {
    const version = ++this.demandVersion;
    this.apiService.cancelDemands();
    this.demandPage = 0;
    this.demandHasMore = false;
    this.demandLoadingMore = false;
    this.demandRefreshing = true;
    if (!preserve) { this.demandItems = []; }
    this.demandState = this.demandItems.length > 0 ? HallContentState.CONTENT : HallContentState.LOADING;
    this.demandError = '';
    this.loadDemands(version, 1, false);
  }

  private async loadServices(version: number, page: number, append: boolean): Promise<void> {
    if (append) {
      if (this.serviceRefreshing || this.serviceLoadingMore || !this.serviceHasMore) {
        return;
      }
      this.serviceLoadingMore = true;
    }
    try {
      const query = this.serviceFilters.serviceQuery(page, this.pageSize, this.feedSeed);
      const result: PageResult<ServicePackageSummary> = await this.apiService.listServicePackagesByQuery(query);
      if (version !== this.serviceVersion) {
        return;
      }
      if (!HallDataPolicy.validPage(result)) {
        this.serviceState = this.serviceItems.length > 0 ? HallContentState.CONTENT : HallContentState.ERROR;
        this.serviceError = '服务器返回的摄影橱窗列表无法识别。';
        return;
      }
      result.records.forEach((item: ServicePackageSummary) => {
        if (item === null) { return; }
        if (typeof item.cityCode === 'string' && item.cityCode && !this.serviceCities.includes(item.cityCode)) { this.serviceCities = this.serviceCities.concat(item.cityCode); }
        (Array.isArray(item.styleTags) ? item.styleTags : []).forEach((tag: string) => {
          if (typeof tag === 'string' && tag.trim().length > 0 && !this.serviceStyles.includes(tag)) { this.serviceStyles = this.serviceStyles.concat(tag); }
        });
      });
      this.serviceItems = append ? HallDataPolicy.mergeServices(this.serviceItems, result.records) :
        HallDataPolicy.mergeServices([], result.records);
      this.serviceError = '';
      this.servicePage = result.page;
      this.serviceHasMore = HallDataPolicy.hasMore(this.serviceItems.length, result.total);
      this.serviceState = this.serviceItems.length === 0 ? HallContentState.EMPTY : HallContentState.CONTENT;
    } catch (error) {
      if (version !== this.serviceVersion) {
        return;
      }
      this.serviceState = this.serviceItems.length > 0 ? HallContentState.CONTENT : HallContentState.ERROR;
      this.serviceError = this.isStale(error) ? '加载已中断，请重试。' : this.messageFor(error);
    } finally {
      if (version === this.serviceVersion) {
        this.serviceLoadingMore = false;
        if (!append) { this.serviceRefreshing = false; }
      }
    }
  }

  private async loadDemands(version: number, page: number, append: boolean): Promise<void> {
    if (append) {
      if (this.demandRefreshing || this.demandLoadingMore || !this.demandHasMore) {
        return;
      }
      this.demandLoadingMore = true;
    }
    try {
      const query = this.demandFilters.demandQuery(page, this.pageSize, this.feedSeed);
      const result: PageResult<DemandSummary> = await this.apiService.listDemandsByQuery(query);
      if (version !== this.demandVersion) {
        return;
      }
      if (!HallDataPolicy.validPage(result)) {
        this.demandState = this.demandItems.length > 0 ? HallContentState.CONTENT : HallContentState.ERROR;
        this.demandError = '服务器返回的约拍需求列表无法识别。';
        return;
      }
      result.records.forEach((item: DemandSummary) => {
        if (item === null) { return; }
        if (typeof item.cityCode === 'string' && item.cityCode && !this.demandCities.includes(item.cityCode)) { this.demandCities = this.demandCities.concat(item.cityCode); }
        (Array.isArray(item.styleTags) ? item.styleTags : []).forEach((tag: string) => {
          if (typeof tag === 'string' && tag.trim().length > 0 && !this.demandStyles.includes(tag)) { this.demandStyles = this.demandStyles.concat(tag); }
        });
      });
      this.demandItems = append ? HallDataPolicy.mergeDemands(this.demandItems, result.records) :
        HallDataPolicy.mergeDemands([], result.records);
      this.demandError = '';
      this.demandPage = result.page;
      this.demandHasMore = HallDataPolicy.hasMore(this.demandItems.length, result.total);
      this.demandState = this.demandItems.length === 0 ? HallContentState.EMPTY : HallContentState.CONTENT;
    } catch (error) {
      if (version !== this.demandVersion) {
        return;
      }
      this.demandState = this.demandItems.length > 0 ? HallContentState.CONTENT : HallContentState.ERROR;
      this.demandError = this.isStale(error) ? '加载已中断，请重试。' : this.messageFor(error);
    } finally {
      if (version === this.demandVersion) {
        this.demandLoadingMore = false;
        if (!append) { this.demandRefreshing = false; }
      }
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
      reselectEpoch: this.reselectEpoch,
      serviceRefreshing: this.serviceRefreshing, demandRefreshing: this.demandRefreshing,
      onRefresh: (channel: HallChannel) => this.refreshChannel(channel),
      serviceState: this.serviceState,
      demandState: this.demandState,
      serviceItems: this.serviceItems,
      demandItems: this.demandItems,
      serviceError: this.serviceError,
      demandError: this.demandError,
      serviceCities: this.serviceCities, demandCities: this.demandCities,
      serviceStyles: this.serviceStyles, demandStyles: this.demandStyles,
      serviceFilters: this.serviceFilters,
      demandFilters: this.demandFilters,
      serviceHasMore: this.serviceHasMore,
      demandHasMore: this.demandHasMore,
      serviceLoadingMore: this.serviceLoadingMore,
      demandLoadingMore: this.demandLoadingMore,
      currentRole: this.currentRole,
      roleLoading: this.roleLoading,
      roleError: this.roleError,
      onRetryRole: () => this.loadCurrentRole(),
      onSearch: this.onSearch,
      onNotice: this.onNotice,
      onPublish: this.onPublish,
      onRetry: () => this.reload(),
      onOpenAuthor: this.onOpenAuthor,
      onOpenService: this.onOpenService,
      onOpenDemand: this.onOpenDemand,
      onServiceFiltersChange: (value: HallFilterState) => { this.serviceFilters = value; this.reload(); },
      onDemandFiltersChange: (value: HallFilterState) => { this.demandFilters = value; this.reload(); },
      onLoadMoreServices: () => this.loadServices(this.serviceVersion, this.servicePage + 1, true),
      onLoadMoreDemands: () => this.loadDemands(this.demandVersion, this.demandPage + 1, true)
    })
  }
}
