import { ReportSummary } from '../../model/ApiModels';

/** Optional public feedback contract; old servers remain readable without inventing outcomes. */
export interface ReportResultRecord extends ReportSummary {
  readonly resolution?: string;
  readonly publicOutcome?: string;
  readonly publicMessage?: string;
  readonly followUpRecorded?: boolean;
}
export class ReportResultItem {
  reportId: number = 0;
  targetType: string = '';
  targetId: number = 0;
  reason: string = '';
  description: string = '';
  createdAt: string = '';
  resolvedAt: string = '';
  outcome: string = 'pending';
  statusLabel: string = '待核查';
  message: string = '举报已提交，平台将按流程核查，请以实际处理记录为准。';
}
export class ReportResultSnapshot {
  items: ReportResultItem[] = [];
  targetId: number = 0;
  loading: boolean = false;
  loginRequired: boolean = false;
  error: string = '';
}
export class ReportResultFormat {
  static target(type: string): string {
    switch(type) {
      case 'USER': return '用户'; case 'DEMAND': return '需求'; case 'SERVICE_PACKAGE': return '摄影橱窗';
      case 'MOMENT': return '动态'; case 'REVIEW': return '评价'; default: return '内容';
    }
  }
  static time(value: string): string { return value ? value.replace('T', ' ').slice(0, 16) : '时间未提供'; }
  static item(record: ReportResultRecord): ReportResultItem {
    const item = new ReportResultItem();
    item.reportId=record.reportId; item.targetType=record.targetType; item.targetId=record.targetId;
    item.reason=record.reason; item.description=record.description??'';
    item.createdAt=record.createdAt??''; item.resolvedAt=record.resolvedAt??'';
    if(record.status==='PENDING'){return item;}
    if(record.publicOutcome===undefined || record.publicOutcome==='LEGACY') {
      item.outcome='legacy'; item.statusLabel='历史处理信息';
      item.message='这条举报已有处理记录，当前记录未提供公开结论，请以平台后续反馈为准。'; return item;
    }
    const message=typeof record.publicMessage==='string'?record.publicMessage.trim():'';
    if(message.length>0 && message.length<=200 && record.publicOutcome==='ACTION_TAKEN' &&
      ['TAKE_DOWN','REVIEW_HIDDEN','RESTRICT_USER'].includes(record.resolution??'')) {
      item.outcome='action'; item.statusLabel='已处理'; item.message=message; return item;
    }
    if(message.length>0 && message.length<=200 && record.publicOutcome==='FOLLOW_UP' &&
      record.resolution==='IGNORE' && record.followUpRecorded===true) {
      item.outcome='followUp'; item.statusLabel='已反馈'; item.message=message; return item;
    }
    item.outcome='sync'; item.statusLabel='结果待核对';
    item.message='举报已有反馈，公开结果暂未同步完整，请稍后刷新核实。'; return item;
  }
}
