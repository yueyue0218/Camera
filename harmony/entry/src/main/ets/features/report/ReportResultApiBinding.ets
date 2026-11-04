import { ApiService } from '../../network/ApiService';
import { SessionSummary } from '../../model/ApiModels';
import { ReportResultApi } from './ReportResultController';
import { ReportResultRecord } from './ReportResultModels';
export class ReportResultApiBinding implements ReportResultApi {
  private readonly api: ApiService;
  constructor(api: ApiService){this.api=api;}
  currentSession(key?: string): Promise<SessionSummary>{return this.api.currentSession(key);}
  cancelCurrentSession(key?: string): void{this.api.cancelCurrentSession(key);}
  listMyReports(key: string): Promise<ReportResultRecord[]>{return this.api.listMyReports(key);}
  cancelReports(createKey: string,myKey: string): void{this.api.cancelReports(createKey,myKey);}
}
