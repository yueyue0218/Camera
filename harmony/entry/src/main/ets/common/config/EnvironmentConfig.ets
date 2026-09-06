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
    note: '本机开发后端；真机联调时替换为电脑局域网地址'
  };

  static readonly STAGING: EnvironmentProfile = {
    name: EnvironmentName.STAGING,
    baseUrl: '',
    enabled: false,
    note: '等待 C 提供已验证的 Staging HTTPS 地址'
  };

  static readonly PRODUCTION: EnvironmentProfile = {
    name: EnvironmentName.PRODUCTION,
    baseUrl: '',
    enabled: false,
    note: '第一阶段不连接生产环境'
  };

  static current(): EnvironmentProfile {
    return EnvironmentConfig.DEV;
  }

  static displayName(): string {
    return 'dev';
  }
}
