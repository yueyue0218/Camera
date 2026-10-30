import { DemandSummary, PageResult, ServicePackageSummary } from '../../model/ApiModels';

/** Pure paging helpers shared by the runtime page and host-side contract tests. */
export class HallDataPolicy {
  static mergeServices(current: ServicePackageSummary[], page: ServicePackageSummary[]): ServicePackageSummary[] {
    const seen: Set<number> = new Set<number>();
    const merged: ServicePackageSummary[] = [];
    [...current, ...page].forEach((item: ServicePackageSummary) => {
      if (item !== null && Number.isSafeInteger(item.serviceId) && item.serviceId > 0 && !seen.has(item.serviceId)) {
        seen.add(item.serviceId);
        merged.push(item);
      }
    });
    return merged;
  }

  static mergeDemands(current: DemandSummary[], page: DemandSummary[]): DemandSummary[] {
    const seen: Set<number> = new Set<number>();
    const merged: DemandSummary[] = [];
    [...current, ...page].forEach((item: DemandSummary) => {
      if (item !== null && Number.isSafeInteger(item.demandId) && item.demandId > 0 && !seen.has(item.demandId)) {
        seen.add(item.demandId);
        merged.push(item);
      }
    });
    return merged;
  }

  static validPage<T>(result: PageResult<T>): boolean {
    return result !== null && Array.isArray(result.records) && Number.isSafeInteger(result.page) && result.page > 0 &&
      Number.isSafeInteger(result.size) && result.size > 0 && Number.isSafeInteger(result.total) && result.total >= 0;
  }

  static hasMore(loaded: number, total: number): boolean {
    return Number.isSafeInteger(loaded) && loaded >= 0 && Number.isSafeInteger(total) && total > loaded;
  }
}
