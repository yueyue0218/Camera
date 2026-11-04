import { DemandListQuery, DemandSummary, PageResult, ServicePackageListQuery, ServicePackageSummary, SessionSummary } from '../../model/ApiModels';
import { ApiService } from '../../network/ApiService';
import { HallSearchApi } from './HallSearchController';

/** Nominal ArkTS adapter; every operation delegates to the existing public API. */
export class HallSearchApiBinding implements HallSearchApi {
  private readonly api: ApiService;
  constructor(api: ApiService) { this.api = api; }
  currentSession(key: string): Promise<SessionSummary> { return this.api.currentSession(key); }
  cancelCurrentSession(key: string): void { this.api.cancelCurrentSession(key); }
  listServicePackagesByQuery(query: ServicePackageListQuery, key: string): Promise<PageResult<ServicePackageSummary>> {
    return this.api.listServicePackagesByQuery(query, key);
  }
  listDemandsByQuery(query: DemandListQuery, key: string): Promise<PageResult<DemandSummary>> {
    return this.api.listDemandsByQuery(query, key);
  }
  cancelServicePackages(key: string): void { this.api.cancelServicePackages(key); }
  cancelDemands(key: string): void { this.api.cancelDemands(key); }
}
