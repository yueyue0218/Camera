import { SessionSummary } from '../../model/ApiModels';
import { NotificationSession } from '../notifications/NotificationController';
import { ReportResultRecord, ReportResultItem, ReportResultSnapshot, ReportResultFormat } from './ReportResultModels';
export interface ReportResultApi {
  currentSession(key?: string): Promise<SessionSummary>;
  cancelCurrentSession(key?: string): void;
  listMyReports(key: string): Promise<ReportResultRecord[]>;
  cancelReports(createKey: string, myKey: string): void;
}
let nextReportResultInstance: number = 0;
/** Own-report reader. Transport, authorization and report submission remain shared. */
export class ReportResultController {
  private state: ReportResultSnapshot = new ReportResultSnapshot();
  private readonly key: string = `report.result.c.${++nextReportResultInstance}`;
  private active: boolean = false;
  private generation: number = 0;
  private accountVersion: number = -1;
  private pending?: Promise<void>;
  private readonly api: ReportResultApi;
  private readonly session: NotificationSession;
  private readonly changed: (state: ReportResultSnapshot) => void;
  constructor(api: ReportResultApi, session: NotificationSession, changed: (state: ReportResultSnapshot) => void) {
    this.api=api; this.session=session; this.changed=changed;
  }
  resume(): void {
    if(this.accountVersion!==this.session.getSessionVersion()){this.reset();}
    this.active=true; this.accountVersion=this.session.getSessionVersion();
    this.state.loginRequired=!this.session.isAuthenticated(); this.publish();
  }
  suspend(): void { this.active=false; this.reset(); this.publish(); }
  private reset(): void {
    this.generation++; this.pending=undefined;
    this.api.cancelCurrentSession(`${this.key}.session`);
    this.api.cancelReports(`${this.key}.unused-create`,`${this.key}.my`);
    this.state=new ReportResultSnapshot();
  }
  private current(epoch: number, version: number): boolean {
    if(epoch!==this.generation || !this.active){return false;}
    if(version!==this.session.getSessionVersion() || !this.session.isAuthenticated()){
      this.reset(); this.accountVersion=this.session.getSessionVersion();
      this.state.loginRequired=!this.session.isAuthenticated(); this.publish(); return false;
    }
    return true;
  }
  private publish(): void {
    const next=new ReportResultSnapshot(); next.items=this.state.items.slice(); next.targetId=this.state.targetId;
    next.loading=this.state.loading; next.loginRequired=this.state.loginRequired; next.error=this.state.error;
    this.changed(next);
  }
  canOpen(id: number): boolean {
    return this.current(this.generation,this.accountVersion) && !this.state.loading &&
      this.state.items.some((item: ReportResultItem)=>item.reportId===id);
  }
  load(reportId: number = 0): Promise<void> {
    if(!this.active){return Promise.resolve();}
    if(this.accountVersion!==this.session.getSessionVersion()) {this.reset();this.accountVersion=this.session.getSessionVersion();}
    if(!this.session.isAuthenticated()) {
      this.reset();this.state.loginRequired=true;this.publish();return Promise.resolve();
    }
    if(!Number.isSafeInteger(reportId)||reportId<0) {
      this.reset();this.state.error='举报编号无效，请从本人记录重新进入。';this.publish();return Promise.resolve();
    }
    if(this.pending!==undefined&&this.state.targetId===reportId){return this.pending;}
    this.reset(); this.state.targetId=reportId; this.state.loading=true; this.publish();
    const epoch=this.generation,version=this.accountVersion;
    const request=this.read(reportId,epoch,version); this.pending=request; return request;
  }
  private async read(reportId: number, epoch: number, version: number): Promise<void> {
    try {
      const identity=await this.api.currentSession(`${this.key}.session`);
      if(!this.current(epoch,version)){return;}
      if(identity===null||!Number.isSafeInteger(identity.userId)||identity.userId<=0){throw new Error('Invalid identity');}
      const records=await this.api.listMyReports(`${this.key}.my`);
      if(!this.current(epoch,version)){return;}
      const ids: number[]=[];
      if(!Array.isArray(records)||records.some((record:ReportResultRecord)=>{
        if(!this.valid(record,identity.userId)||ids.includes(record.reportId)){return true;}
        ids.push(record.reportId);return false;
      })){throw new Error('Invalid own report response');}
      const visible=records.filter((record:ReportResultRecord)=>reportId===0||record.reportId===reportId);
      if(reportId>0&&visible.length!==1){this.state.error='这条举报不存在，或不属于当前账号。';return;}
      this.state.items=visible.map((record:ReportResultRecord)=>ReportResultFormat.item(record));
    } catch {
      if(this.current(epoch,version)){this.state.error='举报记录暂时读取失败，请稍后重试。';}
    } finally {
      if(this.current(epoch,version)){this.state.loading=false;this.pending=undefined;this.publish();}
    }
  }
  private valid(record: ReportResultRecord, actor: number): boolean {
    return record!==null&&record!==undefined&&Number.isSafeInteger(record.reportId)&&record.reportId>0&&
      record.reporterId===actor&&Number.isSafeInteger(record.targetId)&&record.targetId>0&&
      ['USER','DEMAND','SERVICE_PACKAGE','MOMENT','REVIEW'].includes(record.targetType)&&
      ['PENDING','RESOLVED'].includes(record.status)&&typeof record.reason==='string'&&
      (record.description===undefined||record.description===null||typeof record.description==='string')&&
      (record.createdAt===undefined||record.createdAt===null||typeof record.createdAt==='string')&&
      (record.resolvedAt===undefined||record.resolvedAt===null||typeof record.resolvedAt==='string');
  }
}
