import { http } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { AuthTokenController } from '../auth/AuthTokenController';
import { EnvironmentConfig } from '../common/config/EnvironmentConfig';
import { ApiEnvelope } from '../model/ApiModels';
import { AuthInterceptor } from './AuthInterceptor';
import { ErrorMapper, PortraError } from './ErrorMapper';
import { PrivacyRequestGuard } from '../privacy/PrivacyRequestGuard';

export interface UploadedImage { fileId: number; originalName: string; }

export interface AuthenticationExpiredHandler {
  refreshSession(): Promise<boolean>;
}

export class HttpClient implements AuthTokenController {
  private readonly authInterceptor: AuthInterceptor;
  private readonly authenticationExpiredHandler?: AuthenticationExpiredHandler;
  private readonly requestVersions: Map<string, number> = new Map<string, number>();
  private readonly activeRequests: Map<string, http.HttpRequest> = new Map<string, http.HttpRequest>();
  private readonly requestScopes: Map<string, boolean> = new Map<string, boolean>();
  private sessionEpoch: number = 0;
  private tokenRevision: number = 0;
  private readonly identityListeners: Set<() => void> = new Set<() => void>();
  private readonly privacyGuard?: PrivacyRequestGuard;

  observeIdentity(listener: () => void): void { this.identityListeners.add(listener); }
  unobserveIdentity(listener: () => void): void { this.identityListeners.delete(listener); }
  getIdentityEpoch(): number { return this.sessionEpoch; }

  getImage(path: string, requestKey: string): Promise<ArrayBuffer> {
    return this.request<ArrayBuffer>(http.RequestMethod.GET, path, requestKey, true, undefined, true);
  }
  // Keep even a failed recovery while requests sent with that token are pending.
  // A late 401 in the same wave must share its outcome, not rotate again.
  private readonly revisionUsers: Map<number, number> = new Map<number, number>();
  private readonly recoveries: Map<number, Promise<boolean>> = new Map<number, Promise<boolean>>();

  constructor(authInterceptor: AuthInterceptor = new AuthInterceptor(),
    authenticationExpiredHandler?: AuthenticationExpiredHandler,
    privacyGuard?: PrivacyRequestGuard) {
    this.privacyGuard = privacyGuard;
    this.authInterceptor = authInterceptor;
    this.authenticationExpiredHandler = authenticationExpiredHandler;
  }

  setAccessToken(token: string): void {
    if (this.authInterceptor.authorizationHeader() !== `Bearer ${token}`) { this.privacyGuard?.identityChanged(); }
    this.invalidateSessionRequests();
    this.replaceAccessToken(token);
  }

  clearAccessToken(): void {
    this.privacyGuard?.identityChanged();
    this.invalidateSessionRequests();
    this.tokenRevision++;
    this.authInterceptor.clearAccessToken();
  }

  replaceAccessToken(token: string): void {
    this.tokenRevision++;
    this.authInterceptor.setAccessToken(token);
  }

  private invalidateSessionRequests(): void {
    this.sessionEpoch++;
    this.identityListeners.forEach((listener: () => void) => listener());
    // Public GETs carry no account state. In particular, startup restore must
    // not cancel the hall feed. Pending refresh waiters are invalidated too.
    this.requestScopes.forEach((scoped: boolean, key: string) => {
      if (scoped) {
        this.cancelRequest(key);
      }
    });
  }

  uploadImage(data: ArrayBuffer, bizType: string, mime: string, filename: string): Promise<UploadedImage> {
    const parts: http.MultiFormData[] = [
      { name: 'file', contentType: mime, remoteFileName: filename, data: data },
      { name: 'bizType', contentType: 'text/plain', data: bizType },
      { name: 'visibility', contentType: 'text/plain', data: bizType === 'REVIEW_EVIDENCE' ? 'PRIVATE' : 'PUBLIC' }
    ];
    return this.request<UploadedImage>(http.RequestMethod.POST, '/files/upload', 'files.upload', true, undefined, false, parts);
  }

  async get<T>(path: string, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.GET, path, requestKey, true);
  }

  async getPublic<T>(path: string, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.GET, path, requestKey, false);
  }

  async getBinary(path: string, requestKey: string = path, maxBytes: number = 2 * 1024 * 1024): Promise<ArrayBuffer> {
    const result = await this.request<ArrayBuffer>(http.RequestMethod.GET, path, requestKey, true,
      undefined, true);
    if (result.byteLength > maxBytes) throw ErrorMapper.parse();
    return result;
  }

  async post<T>(path: string, body?: Object, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.POST, path, requestKey, true, body);
  }

  async postPublic<T>(path: string, body: Object, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.POST, path, requestKey, false, body);
  }

  async delete<T>(path: string, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.DELETE, path, requestKey, true);
  }

  async put<T>(path: string, body?: Object, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.PUT, path, requestKey, true, body);
  }

  async patch<T>(path: string, body?: Object, requestKey: string = path): Promise<T> {
    return this.request<T>(http.RequestMethod.PATCH, path, requestKey, true, body);
  }

  cancelAllRequests(): void {
    this.requestScopes.forEach((_scoped: boolean, key: string) => {
      this.cancelRequest(key);
    });
  }

  /**
   * Cancels the active request with this key and invalidates its result.
   * A later response from that request is never allowed to update a page.
   */
  cancelRequest(requestKey: string): void {
    this.bumpRequestVersion(requestKey);
    this.requestScopes.delete(requestKey);
    const activeRequest = this.activeRequests.get(requestKey);
    if (activeRequest !== undefined) {
      activeRequest.destroy();
      this.activeRequests.delete(requestKey);
    }
  }

  private async request<T>(method: http.RequestMethod, path: string, requestKey: string,
    authenticated: boolean, body?: Object, binary: boolean = false, parts?: http.MultiFormData[]): Promise<T> {
    this.privacyGuard?.assertRequest(path, this.authInterceptor.authorizationHeader().length > 0);
    const profile = EnvironmentConfig.current();
    if (!EnvironmentConfig.isUsable(profile)) {
      throw ErrorMapper.config('暂时无法连接服务。');
    }

    if (!path.startsWith('/') || path.startsWith('//') || /[\\\s#]/.test(path)) {
      throw ErrorMapper.config('暂时无法完成请求。');
    }
    const requestVersion = this.beginRequest(requestKey);
    const epoch = this.sessionEpoch;
    // Logout captures the old bearer before local sign-out, but cannot mutate
    // local session state or renew. Allow that best-effort revocation to finish.
    const logout = path === '/auth/native/logout';
    const scoped = !(method === http.RequestMethod.GET && !authenticated) && !logout;
    this.requestScopes.set(requestKey, scoped);
    const startingRevision = this.tokenRevision;
    const recoveryEligible = authenticated && !logout;
    if (recoveryEligible) {
      this.revisionUsers.set(startingRevision, (this.revisionUsers.get(startingRevision) ?? 0) + 1);
    }
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        this.assertCurrent(requestKey, requestVersion, epoch, scoped);
        this.privacyGuard?.assertRequest(path, this.authInterceptor.authorizationHeader().length > 0);
        const revision = this.tokenRevision;
        const authorization = authenticated ? this.authInterceptor.authorizationHeader() : '';
        try {
          const result = await this.requestOnce<T>(method, path, requestKey, requestVersion,
            profile.baseUrl, authorization, body, binary, parts);
          this.assertCurrent(requestKey, requestVersion, epoch, scoped);
          return result;
        } catch (error) {
          this.assertCurrent(requestKey, requestVersion, epoch, scoped);
          const mapped = error as PortraError;
          if (mapped.businessCode === 40302) {
            this.privacyGuard?.violate();
            this.cancelAllRequests();
            throw mapped;
          }
          if (attempt > 0 || !authenticated || logout || authorization.length === 0 ||
            !ErrorMapper.isAuthenticationExpired(mapped)) {
            throw this.normalizeThrownError(error);
          }
          let recovered = revision !== this.tokenRevision;
          if (!recovered && this.authenticationExpiredHandler !== undefined) {
            try {
              recovered = await this.recoverSession(revision);
            } catch (refreshError) {
              this.assertCurrent(requestKey, requestVersion, epoch, scoped);
              throw this.normalizeThrownError(refreshError);
            }
          }
          this.assertCurrent(requestKey, requestVersion, epoch, scoped);
          if (!recovered) {
            throw this.normalizeThrownError(error);
          }
          if (method !== http.RequestMethod.GET) {
            // POST/PUT/DELETE may already have side effects. Never replay them.
            throw ErrorMapper.writeNotRetried();
          }
        }
      }
      throw ErrorMapper.stale();
    } finally {
      if (recoveryEligible) {
        const remaining = (this.revisionUsers.get(startingRevision) ?? 1) - 1;
        if (remaining === 0) {
          this.revisionUsers.delete(startingRevision);
          this.recoveries.delete(startingRevision);
        } else {
          this.revisionUsers.set(startingRevision, remaining);
        }
      }
      if (this.isCurrentRequest(requestKey, requestVersion)) {
        this.requestScopes.delete(requestKey);
      }
    }
  }

  private recoverSession(revision: number): Promise<boolean> {
    const existing = this.recoveries.get(revision);
    if (existing !== undefined) {
      return existing;
    }
    const recovery = this.authenticationExpiredHandler === undefined ? Promise.resolve(false) :
      this.authenticationExpiredHandler.refreshSession();
    this.recoveries.set(revision, recovery);
    return recovery;
  }

  private async requestOnce<T>(method: http.RequestMethod, path: string, requestKey: string,
    requestVersion: number, baseUrl: string, authorization: string, body?: Object,
    binary: boolean = false, parts?: http.MultiFormData[]): Promise<T> {
    const request = http.createHttp();
    this.activeRequests.set(requestKey, request);
    const content = body === undefined ? undefined : JSON.stringify(body);
    const headers: Record<string, string> = {
      'Content-Type': parts === undefined ? 'application/json' : 'multipart/form-data'
    };
    if (authorization.length > 0) {
      headers['Authorization'] = authorization;
    }
    const consentHeaders = this.privacyGuard?.headers();
    if (consentHeaders !== undefined) {
      Object.keys(consentHeaders).forEach((key: string) => { headers[key] = consentHeaders[key]; });
    }
    const options: http.HttpRequestOptions = {
      method: method,
      header: headers,
      expectDataType: binary ? http.HttpDataType.ARRAY_BUFFER : http.HttpDataType.STRING,
      connectTimeout: 10000,
      readTimeout: 15000,
      maxLimit: binary ? 32 * 1024 * 1024 : 5 * 1024 * 1024,
      maxRedirects: 0,
      usingCache: false,
      extraData: content
    };
    // Only provide the multipart field when this is actually an upload.
    // Passing `multiFormDataList: undefined` crosses the native bridge as an
    // invalid type and emits ParseMultiFormData errors for ordinary requests.
    if (parts !== undefined) {
      options.multiFormDataList = parts;
    }

    let response: http.HttpResponse;
    try {
      response = await request.request(this.buildUrl(baseUrl, path), options);
    } catch (error) {
      this.releaseRequest(requestKey, request);
      if (!this.isCurrentRequest(requestKey, requestVersion)) {
        throw ErrorMapper.stale();
      }
      request.destroy();
      const transportCode = (error as BusinessError)?.code ?? 0;
      throw ErrorMapper.fromTransportCode(transportCode);
    }
    request.destroy();
    this.releaseRequest(requestKey, request);

    if (!this.isCurrentRequest(requestKey, requestVersion)) {
      throw ErrorMapper.stale();
    }

    if (response.responseCode < 200 || response.responseCode >= 300) {
      throw ErrorMapper.fromHttpStatus(response.responseCode);
    }

    if (binary) {
      const headers = (response.header ?? {}) as Record<string, string>;
      const type = Object.keys(headers).find((key: string) => key.toLowerCase() === 'content-type');
      const mime = type === undefined ? '' : String(headers[type]).split(';')[0].trim().toLowerCase();
      // FileAccessPolicy errors use the global HTTP-200 JSON envelope too.
      if (mime === 'application/json' || mime.endsWith('+json')) {
        let failure: ApiEnvelope<Object>;
        try {
          if (!(response.result instanceof ArrayBuffer) || response.result.byteLength > 65536) {
            throw ErrorMapper.parse();
          }
          const encoded = Array.from(new Uint8Array(response.result))
            .map((value: number) => '%' + value.toString(16).padStart(2, '0')).join('');
          failure = JSON.parse(decodeURIComponent(encoded)) as ApiEnvelope<Object>;
          if (failure === null || !Number.isInteger(failure.code) || failure.code === 200) {
            throw ErrorMapper.parse();
          }
        } catch { throw ErrorMapper.parse(); }
        throw ErrorMapper.fromBusinessCode(failure.code, '');
      }
      if (type === undefined || !String(headers[type]).toLowerCase().startsWith('image/') ||
        !(response.result instanceof ArrayBuffer) || response.result.byteLength === 0 ||
        response.result.byteLength > 32 * 1024 * 1024) {
        throw ErrorMapper.parse();
      }
      return response.result as T;
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
      throw ErrorMapper.fromBusinessCode(envelope.code, envelope.message);
    }

    if (!this.isCurrentRequest(requestKey, requestVersion)) {
      throw ErrorMapper.stale();
    }
    return envelope.data;
  }

  private beginRequest(requestKey: string): number {
    const previousRequest = this.activeRequests.get(requestKey);
    if (previousRequest !== undefined) {
      previousRequest.destroy();
      this.activeRequests.delete(requestKey);
    }

    const requestVersion = this.bumpRequestVersion(requestKey);
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

  private assertCurrent(requestKey: string, version: number, epoch: number, scoped: boolean): void {
    if (!this.isCurrentRequest(requestKey, version) || (scoped && epoch !== this.sessionEpoch)) {
      throw ErrorMapper.stale();
    }
  }

  private normalizeThrownError(error: Object): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
