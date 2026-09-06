import { http } from '@kit.NetworkKit';
import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { ApiEnvelope } from '../model/ApiModels';
import { AuthInterceptor } from './AuthInterceptor';
import { ErrorMapper } from './ErrorMapper';

export class HttpClient {
  private readonly authInterceptor: AuthInterceptor = new AuthInterceptor();
  private readonly requestVersions: Map<string, number> = new Map<string, number>();
  private readonly activeRequests: Map<string, http.HttpRequest> = new Map<string, http.HttpRequest>();

  setAccessToken(token: string): void {
    this.authInterceptor.setAccessToken(token);
  }

  clearAccessToken(): void {
    this.authInterceptor.clearAccessToken();
  }

  async get<T>(path: string, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.GET, path, requestKey);
  }

  /**
   * Cancels the active request with this key and invalidates its result.
   * A later response from that request is never allowed to update a page.
   */
  cancelRequest(requestKey: string): void {
    this.bumpRequestVersion(requestKey);
    const activeRequest = this.activeRequests.get(requestKey);
    if (activeRequest !== undefined) {
      activeRequest.destroy();
      this.activeRequests.delete(requestKey);
    }
  }

  private async request<T>(method: http.RequestMethod, path: string, requestKey: string): Promise<T> {
    const profile = EnvironmentConfig.current();
    if (!profile.enabled || profile.baseUrl.length === 0) {
      throw ErrorMapper.config('当前环境没有可用的服务端地址。');
    }

    const request = http.createHttp();
    const requestVersion = this.beginRequest(requestKey, request);
    const authorization = this.authInterceptor.authorizationHeader();
    const options: http.HttpRequestOptions = authorization.length === 0
      ? {
        method: method,
        header: { 'Content-Type': 'application/json' },
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 10000,
        readTimeout: 15000,
        usingCache: false
      }
      : {
        method: method,
        header: {
          'Content-Type': 'application/json',
          'Authorization': authorization
        },
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 10000,
        readTimeout: 15000,
        usingCache: false
      };

    let response: http.HttpResponse;
    try {
      response = await request.request(this.buildUrl(profile.baseUrl, path), options);
    } catch {
      this.releaseRequest(requestKey, request);
      if (!this.isCurrentRequest(requestKey, requestVersion)) {
        throw ErrorMapper.stale();
      }
      request.destroy();
      throw ErrorMapper.network();
    }
    request.destroy();
    this.releaseRequest(requestKey, request);

    if (!this.isCurrentRequest(requestKey, requestVersion)) {
      throw ErrorMapper.stale();
    }

    if (response.responseCode < 200 || response.responseCode >= 300) {
      throw ErrorMapper.fromHttpStatus(response.responseCode);
    }

    let envelope: ApiEnvelope<T>;
    try {
      envelope = JSON.parse(response.result as string) as ApiEnvelope<T>;
    } catch {
      throw ErrorMapper.parse();
    }

    if (envelope.code !== 200) {
      throw ErrorMapper.fromBusinessCode(envelope.code, envelope.message);
    }

    if (!this.isCurrentRequest(requestKey, requestVersion)) {
      throw ErrorMapper.stale();
    }
    return envelope.data;
  }

  private beginRequest(requestKey: string, request: http.HttpRequest): number {
    const previousRequest = this.activeRequests.get(requestKey);
    if (previousRequest !== undefined) {
      previousRequest.destroy();
    }

    const requestVersion = this.bumpRequestVersion(requestKey);
    this.activeRequests.set(requestKey, request);
    return requestVersion;
  }

  private bumpRequestVersion(requestKey: string): number {
    const previousVersion = this.requestVersions.get(requestKey);
    const requestVersion = (previousVersion === undefined ? 0 : previousVersion) + 1;
    this.requestVersions.set(requestKey, requestVersion);
    return requestVersion;
  }

  private isCurrentRequest(requestKey: string, requestVersion: number): boolean {
    const currentVersion = this.requestVersions.get(requestKey);
    return currentVersion !== undefined && currentVersion === requestVersion;
  }

  private releaseRequest(requestKey: string, request: http.HttpRequest): void {
    const activeRequest = this.activeRequests.get(requestKey);
    if (activeRequest === request) {
      this.activeRequests.delete(requestKey);
    }
  }

  private buildUrl(baseUrl: string, path: string): string {
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBaseUrl}${normalizedPath}`;
  }
}
