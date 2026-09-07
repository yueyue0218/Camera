import { BuildEnvironment } from './BuildEnvironment';

/**
 * Product and endpoint are injected by Hvigor. No developer-specific IP or
 * unconfirmed server address is stored in source control.
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
  static current(): EnvironmentProfile {
    return EnvironmentConfig.fromBuildFields(BuildEnvironment.environment(), BuildEnvironment.baseUrl());
  }

  static profile(name: EnvironmentName): EnvironmentProfile {
    const current = EnvironmentConfig.current();
    if (current.name === name) {
      return current;
    }
    return EnvironmentConfig.disabledProfile(name, '当前构建未选择此环境');
  }

  /** Converts generated BuildProfile fields into one validated runtime profile. */
  static fromBuildFields(environment: string, baseUrl: string): EnvironmentProfile {
    const name = EnvironmentConfig.parseName(environment);
    if (name === undefined) {
      return EnvironmentConfig.disabledProfile(EnvironmentName.DEV, '构建环境名称无效');
    }
    const normalizedBaseUrl = baseUrl.trim();
    if (normalizedBaseUrl.length === 0 || normalizedBaseUrl.startsWith('@param:')) {
      return EnvironmentConfig.disabledProfile(name, '构建时尚未提供服务端地址');
    }

    return {
      name: name,
      baseUrl: normalizedBaseUrl,
      enabled: true,
      allowsPlainHttp: name === EnvironmentName.DEV,
      cacheNamespace: `portra:${name}`,
      note: name === EnvironmentName.DEV ? '本地开发环境' : '团队 HTTPS 环境'
    };
  }

  static isUsable(profile: EnvironmentProfile = EnvironmentConfig.current()): boolean {
    if (!profile.enabled || profile.baseUrl.length === 0) {
      return false;
    }

    // Restrict configuration to an origin: no embedded credentials, path, query or fragment.
    if (!/^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?\/?$/.test(profile.baseUrl)) {
      return false;
    }
    if (!EnvironmentConfig.hasValidPort(profile.baseUrl)) {
      return false;
    }
    return profile.baseUrl.startsWith('https://') ||
      (profile.name === EnvironmentName.DEV && profile.allowsPlainHttp);
  }

  static displayName(): string {
    return EnvironmentConfig.current().name;
  }

  private static parseName(value: string): EnvironmentName | undefined {
    switch (value) {
      case EnvironmentName.DEV:
        return EnvironmentName.DEV;
      case EnvironmentName.STAGING:
        return EnvironmentName.STAGING;
      case EnvironmentName.PRODUCTION:
        return EnvironmentName.PRODUCTION;
      default:
        return undefined;
    }
  }

  private static disabledProfile(name: EnvironmentName, note: string): EnvironmentProfile {
    return {
      name: name,
      baseUrl: '',
      enabled: false,
      allowsPlainHttp: name === EnvironmentName.DEV,
      cacheNamespace: `portra:${name}`,
      note: note
    };
  }

  private static hasValidPort(baseUrl: string): boolean {
    const withoutProtocol = baseUrl.startsWith('https://') ? baseUrl.slice(8) : baseUrl.slice(7);
    const normalized = withoutProtocol.endsWith('/') ? withoutProtocol.slice(0, -1) : withoutProtocol;
    const separator = normalized.lastIndexOf(':');
    if (separator < 0) {
      return true;
    }
    const port = Number(normalized.slice(separator + 1));
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }
}
