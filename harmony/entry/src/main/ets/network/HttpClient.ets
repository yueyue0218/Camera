import { http } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { AuthTokenController } from '../auth/AuthTokenController';
import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { ApiEnvelope } from '../model/ApiModels';
import { AuthInterceptor } from './AuthInterceptor';
import { ErrorMapper, PortraError } from './ErrorMapper';

export interface AuthenticationExpiredHandler {
  onExpired(): Promise<void>;
}

export class HttpClient implements AuthTokenController {
  private readonly authInterceptor: AuthInterceptor;
  private readonly authenticationExpiredHandler?: AuthenticationExpiredHandler;
  private readonly requestVersions: Map<string, number> = new Map<string, number>();
  private readonly activeRequests: Map<string, http.HttpRequest> = new Map<string, http.HttpRequest>();

  constructor(authInterceptor: AuthInterceptor = new AuthInterceptor(),
    authenticationExpiredHandler?: AuthenticationExpiredHandler) {
    this.authInterceptor = authInterceptor;
    this.authenticationExpiredHandler = authenticationExpiredHandler;
  }

  setAccessToken(token: string): void {
    this.cancelAllRequests();
    this.authInterceptor.setAccessToken(token);
  }

  clearAccessToken(): void {
    this.cancelAllRequests();
    this.authInterceptor.clearAccessToken();
  }

  async get<T>(path: string, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.GET, path, requestKey, true);
  }

  async getPublic<T>(path: string, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.GET, path, requestKey, false);
  }

  cancelAllRequests(): void {
    this.activeRequests.forEach((_request: http.HttpRequest, key: string) => {
      this.cancelRequest(key);
    });
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

  private async request<T>(method: http.RequestMethod, path: string, requestKey: string,
    authenticated: boolean): Promise<T> {
    const profile = EnvironmentConfig.current();
    if (!EnvironmentConfig.isUsable(profile)) {
      throw ErrorMapper.config(`当前环境 ${profile.name} 没有可用的服务端地址。`);
    }

    if (!path.startsWith('/') || path.startsWith('//') || /[\\\s#]/.test(path)) {
      throw ErrorMapper.config('接口必须使用以单个 / 开头的相对路径。');
    }
    const request = http.createHttp();
    const requestVersion = this.beginRequest(requestKey, request);
    const authorization = authenticated ? this.authInterceptor.authorizationHeader() : '';
    const options: http.HttpRequestOptions = authorization.length === 0
      ? {
        method: method,
        header: { 'Content-Type': 'application/json' },
        expectDataType: http.HttpDataType.STRING,
        connectTimeout: 10000,
        readTimeout: 15000,
        maxRedirects: 0,
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
        maxRedirects: 0,
        usingCache: false
      };

    let response: http.HttpResponse;
    try {
      response = await request.request(this.buildUrl(profile.baseUrl, path), options);
    } catch (error) {
      this.releaseRequest(requestKey, request);
      if (!this.isCurrentRequest(requestKey, requestVersion)) {
        throw ErrorMapper.stale();
      }
      request.destroy();
      throw ErrorMapper.fromTransportCode((error as BusinessError)?.code);
    }
    request.destroy();
    this.releaseRequest(requestKey, request);

    if (!this.isCurrentRequest(requestKey, requestVersion)) {
      throw ErrorMapper.stale();
    }

    if (response.responseCode < 200 || response.responseCode >= 300) {
      const mappedError = ErrorMapper.fromHttpStatus(response.responseCode);
      await this.handleAuthenticationExpired(mappedError);
      throw mappedError;
    }

    let envelope: ApiEnvelope<T>;
    try {
      if (typeof response.result !== 'string') {
        throw ErrorMapper.parse();
      }
      envelope = JSON.parse(response.result as string) as ApiEnvelope<T>;
      if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope) ||
        !Number.isInteger(envelope.code) || typeof envelope.message !== 'string' ||
        (envelope.code === 200 && envelope.data === undefined)) {
        throw ErrorMapper.parse();
      }
    } catch {
      throw ErrorMapper.parse();
    }

    if (envelope.code !== 200) {
      const mappedError = ErrorMapper.fromBusinessCode(envelope.code, envelope.message);
      await this.handleAuthenticationExpired(mappedError);
      throw mappedError;
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

  private async handleAuthenticationExpired(error: PortraError): Promise<void> {
    if (this.authenticationExpiredHandler !== undefined && ErrorMapper.isAuthenticationExpired(error)) {
      await this.authenticationExpiredHandler.onExpired();
    }
  }
}
