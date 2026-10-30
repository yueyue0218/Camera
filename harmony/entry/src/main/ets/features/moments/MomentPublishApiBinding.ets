import { CreateMomentPayload, MomentSummary, SessionSummary } from '../../model/ApiModels';
import { ApiService } from '../../network/ApiService';
import { MomentPublishApi } from './MomentPublishController';
import { MomentOwnerApi } from './MomentOwnerActions';
export class MomentPublishApiBinding implements MomentPublishApi, MomentOwnerApi {
  private readonly api: ApiService;
  constructor(api: ApiService) { this.api = api; }
  currentSession(key?: string): Promise<SessionSummary> { return this.api.currentSession(key); }
  cancelCurrentSession(key?: string): void { this.api.cancelCurrentSession(key); }
  createMoment(payload: CreateMomentPayload, key?: string): Promise<MomentSummary> { return this.api.createMoment(payload, key); }
  cancelMomentCreate(key?: string): void { this.api.cancelMomentCreate(key); }
  getMoment(id: number, key?: string): Promise<MomentSummary> { return this.api.getMoment(id, key); }
  cancelMomentDetail(key?: string): void { this.api.cancelMomentDetail(key); }
  updateMoment(id: number, payload: CreateMomentPayload, key?: string): Promise<MomentSummary> { return this.api.updateMoment(id, payload, key); }
  cancelMomentUpdate(id: number, key?: string): void { this.api.cancelMomentUpdate(id, key); }
  deleteMoment(id: number, key?: string): Promise<void> { return this.api.deleteMoment(id, key); }
  cancelMomentDelete(id: number, key?: string): void { this.api.cancelMomentDelete(id, key); }
}