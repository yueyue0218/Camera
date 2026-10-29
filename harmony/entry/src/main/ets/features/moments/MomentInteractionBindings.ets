import { AuthSessionManager } from '../../auth/AuthSessionManager';
import { MomentSummary } from '../../model/ApiModels';
import { ApiService } from '../../network/ApiService';
import { MomentInteractionApi, MomentInteractionSession } from './MomentInteractions';

/** Nominal adapters for ArkTS: delegate to the single shared authenticated client. */
export class MomentApiBinding implements MomentInteractionApi {
  private readonly api: ApiService;

  constructor(api: ApiService) {
    this.api = api;
  }

  getMoment(id: number, key?: string): Promise<MomentSummary> {
    return this.api.getMoment(id, key);
  }

  cancelMomentDetail(key?: string): void {
    this.api.cancelMomentDetail(key);
  }

  likeMoment(id: number, key?: string): Promise<MomentSummary> {
    return this.api.likeMoment(id, key);
  }

  unlikeMoment(id: number, key?: string): Promise<MomentSummary> {
    return this.api.unlikeMoment(id, key);
  }

  cancelMomentLike(id: number, key?: string): void {
    this.api.cancelMomentLike(id, key);
  }
}

export class MomentSessionBinding implements MomentInteractionSession {
  private readonly session: AuthSessionManager;

  constructor(session: AuthSessionManager) {
    this.session = session;
  }

  getSessionVersion(): number {
    return this.session.getSessionVersion();
  }

  isAuthenticated(): boolean {
    return this.session.isAuthenticated();
  }
}
