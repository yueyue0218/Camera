export enum ErrorKind {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  HTTP = 'http',
  BUSINESS = 'business',
  PARSE = 'parse',
  CONFIG = 'config',
  STALE = 'stale'
}

export class PortraError extends Error {
  readonly kind: ErrorKind;
  readonly message: string;
  readonly httpStatus: number;
  readonly businessCode: number;

  constructor(kind: ErrorKind, message: string, httpStatus: number = 0, businessCode: number = 0) {
    super(message);
    this.kind = kind;
    this.message = message;
    this.httpStatus = httpStatus;
    this.businessCode = businessCode;
  }
}

export class ErrorMapper {
  static fromHttpStatus(status: number): PortraError {
    if (status === 401) {
      return new PortraError(ErrorKind.HTTP, '登录状态已失效，请重新登录。', status);
    }
    if (status === 403) {
      return new PortraError(ErrorKind.HTTP, '当前账号没有权限执行此操作。', status);
    }
    if (status === 404) {
      return new PortraError(ErrorKind.HTTP, '请求的内容不存在。', status);
    }
    if (status >= 500) {
      return new PortraError(ErrorKind.HTTP, '服务器暂时不可用，请稍后再试。', status);
    }
    return new PortraError(ErrorKind.HTTP, `网络请求失败（${status}）。`, status);
  }

  static fromBusinessCode(code: number, message: string): PortraError {
    if (code === 40101) {
      return new PortraError(ErrorKind.BUSINESS, '登录状态已失效，请重新登录。', 200, code);
    }
    if (code === 40301) {
      return new PortraError(ErrorKind.BUSINESS, '当前账号没有权限执行此操作。', 200, code);
    }
    if (code === 40401) {
      return new PortraError(ErrorKind.BUSINESS, '请求的内容不存在。', 200, code);
    }
    // Backend error messages can contain SQL and other internal details.
    return new PortraError(ErrorKind.BUSINESS,
      code >= 50000 ? '服务器暂时不可用，请稍后再试。' : `请求未能完成（${code}）。`, 200, code);
  }

  static fromTransportCode(code: number): PortraError {
    if (code === 2300028) {
      return new PortraError(ErrorKind.TIMEOUT, '请求超时，请稍后重试。');
    }
    return ErrorMapper.network();
  }

  static network(): PortraError {
    return new PortraError(ErrorKind.NETWORK, '无法连接服务器，请检查网络或开发环境地址。');
  }

  static parse(): PortraError {
    return new PortraError(ErrorKind.PARSE, '服务器返回的数据格式无法识别。');
  }

  static config(message: string): PortraError {
    return new PortraError(ErrorKind.CONFIG, message);
  }

  static stale(): PortraError {
    return new PortraError(ErrorKind.STALE, '请求已被更新，忽略旧响应。');
  }

  static isStale(error: PortraError): boolean {
    return error.kind === ErrorKind.STALE;
  }

  static isAuthenticationExpired(error: PortraError): boolean {
    return error.httpStatus === 401 || error.businessCode === 40101;
  }
}
