import { NativeSessionApi } from '../auth/NativeSessionApi';
import { PageResult, DemandSummary, NativeSessionResponse, ServicePackageSummary } from '../model/ApiModels';
import { HttpClient } from './HttpClient';

export class ApiService implements NativeSessionApi {
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

  refresh(refreshToken: string): Promise<NativeSessionResponse> {
    return this.client.postPublic<NativeSessionResponse>(
      '/auth/native/refresh', { refreshToken }, 'auth.refresh');
  }

  logout(): Promise<boolean> {
    return this.client.post<boolean>('/auth/native/logout', {}, 'auth.logout');
  }
}
