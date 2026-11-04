import { ErrorKind, PortraError } from '../../network/ErrorMapper';

/** A rejected write can be corrected; a transport failure still requires a server read. */
export class MomentWriteFailure {
  static rejected(error: PortraError): boolean {
    if (error.kind === ErrorKind.CONFIG) { return true; }
    if (error.kind === ErrorKind.BUSINESS) {
      return error.businessCode >= 40000 && error.businessCode < 50000;
    }
    return error.kind === ErrorKind.HTTP && [400, 401, 403, 404, 405, 413, 415, 422].includes(error.httpStatus);
  }

  static message(error: PortraError, action: string): string {
    const codes: string[] = [];
    if (error.httpStatus > 0) { codes.push(`HTTP ${error.httpStatus}`); }
    if (error.businessCode > 0) { codes.push(`错误码 ${error.businessCode}`); }
    const evidence = codes.length > 0 ? `（${codes.join('，')}）` : '';
    return `${action}未完成：${error.message || '连接中断，请核实服务器状态。'}${evidence}`;
  }
}
