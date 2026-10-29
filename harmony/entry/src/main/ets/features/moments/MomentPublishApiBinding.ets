import { CreateMomentPayload, MomentSummary, SessionSummary } from '../../model/ApiModels';
import { ApiService } from '../../network/ApiService';
import { MomentPublishApi } from './MomentPublishController';
export class MomentPublishApiBinding implements MomentPublishApi {
  private readonly api: ApiService;
  constructor(api: ApiService) { this.api = api; }
  currentSession(key?: string): Promise<SessionSummary> { return this.api.currentSession(key); }
  cancelCurrentSession(key?: string): void { this.api.cancelCurrentSession(key); }
  createMoment(payload: CreateMomentPayload, key?: string): Promise<MomentSummary> { return this.api.createMoment(payload, key); }
  cancelMomentCreate(key?: string): void { this.api.cancelMomentCreate(key); }
}
