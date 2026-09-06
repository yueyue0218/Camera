/**
 * Client endpoint configuration.
 *
 * Only the local development endpoint is known at this stage. Staging and
 * production remain disabled until the team provides confirmed HTTPS URLs.
 */
export enum EnvironmentName {
  DEV = 'dev',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

export interface EnvironmentProfile {
  readonly name: EnvironmentName;
  readonly baseUrl: string;
  readonly enabled: boolean;
  /** Only the local development endpoint may use plain HTTP. */
  readonly allowsPlainHttp: boolean;
  /** Namespace for environment-scoped credentials and future local caches. */
  readonly cacheNamespace: string;
  readonly note: string;
}

export class EnvironmentConfig {
  /**
   * This address is valid for the development machine itself. A real device
   * must use the computer's reachable LAN address instead of localhost.
   */
  static readonly DEV: EnvironmentProfile = {
    name: EnvironmentName.DEV,
    baseUrl: 'http://127.0.0.1:8080',
    enabled: true,
    allowsPlainHttp: true,
    cacheNamespace: 'portra:dev',
    note: '本机开发后端；真机联调时替换为电脑局域网地址'
  };

  static readonly STAGING: EnvironmentProfile = {
    name: EnvironmentName.STAGING,
    baseUrl: '',
    enabled: false,
    allowsPlainHttp: false,
    cacheNamespace: 'portra:staging',
    note: '等待 C 提供已验证的 Staging HTTPS 地址'
  };

  static readonly PRODUCTION: EnvironmentProfile = {
    name: EnvironmentName.PRODUCTION,
    baseUrl: '',
    enabled: false,
    allowsPlainHttp: false,
    cacheNamespace: 'portra:production',
    note: '第一阶段不连接生产环境'
  };

  static current(): EnvironmentProfile {
    return EnvironmentConfig.DEV;
  }

  static profile(name: EnvironmentName): EnvironmentProfile {
    switch (name) {
      case EnvironmentName.STAGING:
        return EnvironmentConfig.STAGING;
      case EnvironmentName.PRODUCTION:
        return EnvironmentConfig.PRODUCTION;
      case EnvironmentName.DEV:
      default:
        return EnvironmentConfig.DEV;
    }
  }

  static isUsable(profile: EnvironmentProfile = EnvironmentConfig.current()): boolean {
    if (!profile.enabled || profile.baseUrl.length === 0) {
      return false;
    }

    // Restrict configuration to an origin: no embedded credentials, path or query.
    if (!/^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?\/?$/.test(profile.baseUrl)) {
      return false;
    }
    return profile.baseUrl.startsWith('https://') ||
      (profile.name === EnvironmentName.DEV && profile.allowsPlainHttp);
  }

  static displayName(): string {
    return EnvironmentConfig.current().name;
  }
}
