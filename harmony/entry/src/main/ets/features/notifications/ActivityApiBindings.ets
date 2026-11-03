import { ApiService } from '../../network/ApiService';
import { AuthSessionManager } from '../../auth/AuthSessionManager';
import { NotificationSummary, PageResult, SessionSummary, CreditSummary, CreditRecordSummary } from '../../model/ApiModels';
import { NotificationApi, NotificationSession } from './NotificationController';
import { CreditApi } from '../credit/CreditController';

/** ArkTS nominal adapters only. All calls still execute the one shared ApiService/HttpClient. */
export class ActivitySessionBinding implements NotificationSession {
  private readonly session: AuthSessionManager;
  constructor(session: AuthSessionManager) { this.session = session; }
  getSessionVersion(): number { return this.session.getSessionVersion(); }
  isAuthenticated(): boolean { return this.session.isAuthenticated(); }
}
export class NotificationApiBinding implements NotificationApi {
  private readonly api: ApiService;
  constructor(api: ApiService) { this.api = api; }
  currentSession(key?: string): Promise<SessionSummary> { return this.api.currentSession(key); }
  cancelCurrentSession(key?: string): void { this.api.cancelCurrentSession(key); }
  listNotifications(page: number, size: number, key: string): Promise<PageResult<NotificationSummary>> {
    return this.api.listNotifications(page, size, key);
  }
  unreadNotificationCount(key: string): Promise<number> { return this.api.unreadNotificationCount(key); }
  markNotificationRead(id: number, key: string): Promise<NotificationSummary> { return this.api.markNotificationRead(id, key); }
  markAllNotificationsRead(key: string): Promise<NotificationSummary[]> { return this.api.markAllNotificationsRead(key); }
  cancelNotificationRequests(keys: string[]): void { this.api.cancelNotificationRequests(keys); }
}
export class CreditApiBinding implements CreditApi {
  private readonly api: ApiService;
  constructor(api: ApiService) { this.api = api; }
  currentSession(key?: string): Promise<SessionSummary> { return this.api.currentSession(key); }
  cancelCurrentSession(key?: string): void { this.api.cancelCurrentSession(key); }
  getCreditSummary(id: number, key: string): Promise<CreditSummary> { return this.api.getCreditSummary(id, key); }
  listCreditRecords(id: number, key: string): Promise<CreditRecordSummary[]> { return this.api.listCreditRecords(id, key); }
  cancelCreditRequests(keys: string[]): void { this.api.cancelCreditRequests(keys); }
}
