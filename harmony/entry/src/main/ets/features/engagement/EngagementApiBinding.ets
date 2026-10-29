import { ApiService } from '../../network/ApiService';
import { OrderEngagementSummary, ReviewSummary, ReviewComplaintSummary, DisputeSummary, CreateReviewPayload, ReviewTextPayload, CreateReviewComplaintPayload, DisputeReasonPayload, SessionSummary } from '../../model/ApiModels';
import { EngagementApi } from './EngagementController';
export class EngagementApiBinding implements EngagementApi {
  private readonly api: ApiService;
  constructor(api: ApiService) { this.api=api; }
  currentSession(key?: string): Promise<SessionSummary> { return this.api.currentSession(key); }
  cancelCurrentSession(key?: string): void { this.api.cancelCurrentSession(key); }
  cancelEngagementRequests(keys: string[]): void { this.api.cancelEngagementRequests(keys); }
  getOrder(id: number, requestKey: string): Promise<OrderEngagementSummary> { return this.api.getOrder(id, requestKey); }
  listOrderReviews(id: number, requestKey: string): Promise<ReviewSummary[]> { return this.api.listOrderReviews(id, requestKey); }
  getReview(id: number, requestKey: string): Promise<ReviewSummary> { return this.api.getReview(id, requestKey); }
  listReviewComplaints(id: number, requestKey: string): Promise<ReviewComplaintSummary[]> { return this.api.listReviewComplaints(id, requestKey); }
  getReviewComplaint(id: number, requestKey: string): Promise<ReviewComplaintSummary> { return this.api.getReviewComplaint(id, requestKey); }
  listOrderDisputes(id: number, requestKey: string): Promise<DisputeSummary[]> { return this.api.listOrderDisputes(id, requestKey); }
  getDispute(id: number, requestKey: string): Promise<DisputeSummary> { return this.api.getDispute(id, requestKey); }
  createReview(id: number, payload: CreateReviewPayload, requestKey: string): Promise<ReviewSummary> { return this.api.createReview(id, payload, requestKey); }
  followUpReview(id: number, payload: ReviewTextPayload, requestKey: string): Promise<ReviewSummary> { return this.api.followUpReview(id, payload, requestKey); }
  createReviewComplaint(id: number, payload: CreateReviewComplaintPayload, requestKey: string): Promise<ReviewComplaintSummary> { return this.api.createReviewComplaint(id, payload, requestKey); }
  createDispute(id: number, payload: DisputeReasonPayload, requestKey: string): Promise<DisputeSummary> { return this.api.createDispute(id, payload, requestKey); }
  replyDispute(id: number, payload: ReviewTextPayload, requestKey: string): Promise<DisputeSummary> { return this.api.replyDispute(id, payload, requestKey); }
}
