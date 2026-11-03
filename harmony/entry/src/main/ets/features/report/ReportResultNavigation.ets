import { ReportSubmissionRecord } from '../user/ReportSubmissionStore';
export class ReportResultNavigation {
  static isReport(kind: string): boolean {return kind==='report'||kind==='reportList';}
  static id(kind: string,id: number): number {
    return kind==='reportList'?0:kind==='report'&&Number.isSafeInteger(id)&&id>0?id:-1;
  }
  static receipt(record: ReportSubmissionRecord|undefined, version: number, actorId: number, momentId: number): number {
    const result=record?.report;
    return record?.state==='confirmed' && record.sessionVersion===version && record.actorId===actorId &&
      record.payload.targetType==='MOMENT' && record.payload.targetId===momentId && result!==undefined &&
      result.reporterId===actorId && result.targetType==='MOMENT' && result.targetId===momentId &&
      Number.isSafeInteger(result.reportId)&&result.reportId>0?result.reportId:0;
  }
}
