import { NativeSessionApi } from '../auth/NativeSessionApi';
import { DemandSummary, NativeRefreshRequest, NativeSessionResponse, PageResult, SendSmsCodeRequest,
  ServicePackageSummary, SessionSummary, VerifyNativeSmsCodeRequest } from '../model/ApiModels';
import { ErrorMapper } from './ErrorMapper';
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

  sendLoginCode(phone: string, deviceId: string): Promise<void> {
    const request: SendSmsCodeRequest = { phone: phone, purpose: 'LOGIN', deviceId: deviceId };
    return this.client.postPublic<void>('/auth/sms/send', request, 'auth.sms.send');
  }

  cancelSendLoginCode(): void {
    this.client.cancelRequest('auth.sms.send');
  }

  async verifyLoginCode(phone: string, code: string, deviceId: string): Promise<NativeSessionResponse> {
    const request: VerifyNativeSmsCodeRequest = {
      phone: phone, purpose: 'LOGIN', code: code, deviceId: deviceId, deviceName: 'Portra HarmonyOS'
    };
    const response = await this.client.postPublic<NativeSessionResponse>(
      '/auth/native/sms/verify', request, 'auth.sms.verify');
    return this.requireNativeSession(response);
  }

  cancelVerifyLoginCode(): void {
    this.client.cancelRequest('auth.sms.verify');
  }

  async currentSession(): Promise<SessionSummary> {
    const response = await this.client.get<SessionSummary>('/auth/session', 'auth.session');
    if (response === null || !Number.isSafeInteger(response.userId) || response.userId <= 0 ||
      typeof response.nickname !== 'string' || typeof response.role !== 'string') {
      throw ErrorMapper.parse();
    }
    return response;
  }

  cancelCurrentSession(): void {
    this.client.cancelRequest('auth.session');
  }

  async refresh(refreshToken: string): Promise<NativeSessionResponse> {
    const request: NativeRefreshRequest = { refreshToken: refreshToken };
    const response = await this.client.postPublic<NativeSessionResponse>(
      '/auth/native/refresh', request, 'auth.refresh');
    return this.requireNativeSession(response);
  }

  logout(): Promise<boolean> {
    return this.client.post<boolean>('/auth/native/logout', undefined, 'auth.logout');
  }

  private requireNativeSession(response: NativeSessionResponse): NativeSessionResponse {
    if (response === null || typeof response.accessToken !== 'string' ||
      response.accessToken.trim().length === 0 || typeof response.refreshToken !== 'string' ||
      response.refreshToken.trim().length === 0 || !Number.isSafeInteger(response.userId) ||
      response.userId <= 0 || typeof response.nickname !== 'string' || typeof response.role !== 'string') {
      throw ErrorMapper.parse();
    }
    return response;
  }
}
