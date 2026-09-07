import { PageResult, DemandSummary, ServicePackageSummary } from '../model/ApiModels';
import { HttpClient } from './HttpClient';

export class ApiService {
  private readonly client: HttpClient;

  constructor(client: HttpClient = new HttpClient()) {
    this.client = client;
  }

  listDemands(page: number = 1, size: number = 10, requestKey: string = 'demands.list'):
    Promise<PageResult<DemandSummary>> {
    return this.client.getPublic<PageResult<DemandSummary>>(
      `/demands?page=${page}&size=${size}`,
      requestKey
    );
  }

  cancelDemands(requestKey: string = 'demands.list'): void {
    this.client.cancelRequest(requestKey);
  }

  listServicePackages(page: number = 1, size: number = 10, requestKey: string = 'servicePackages.list'):
    Promise<PageResult<ServicePackageSummary>> {
    return this.client.getPublic<PageResult<ServicePackageSummary>>(
      `/service-packages?page=${page}&size=${size}`,
      requestKey
    );
  }

  cancelServicePackages(requestKey: string = 'servicePackages.list'): void {
    this.client.cancelRequest(requestKey);
  }
}
