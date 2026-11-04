import { DeliveryFileSummary, DeliverySummary, OrderEngagementSummary, OrderSummary,
  PhotoAuthorizationSummary, ReviewComplaintSummary, ReviewSummary } from '../../model/ApiModels';

export class AftercarePolicy {
  static authorizable(order: OrderSummary, actorId: number): boolean {
    return order.status === 'COMPLETED' && order.providerUserId === actorId;
  }

  static availablePhotos(deliveries: DeliverySummary[], authorizations: PhotoAuthorizationSummary[]): DeliveryFileSummary[] {
    const used = new Set<number>();
    authorizations.forEach((authorization: PhotoAuthorizationSummary) =>
      (authorization.files ?? []).forEach(file => used.add(file.fileId)));
    const seen = new Set<number>();
    return deliveries.flatMap((delivery: DeliverySummary) => delivery.files ?? [])
      .filter((file: DeliveryFileSummary) => {
        if (!Number.isSafeInteger(file.fileId) || file.fileId <= 0 ||
          file.fileType !== 'IMAGE' || used.has(file.fileId) || seen.has(file.fileId)) return false;
        seen.add(file.fileId);
        return true;
      });
  }

  static authorizationStatus(authorization: PhotoAuthorizationSummary, actorId: number): string {
    if (authorization.status === 'PENDING') return actorId === authorization.customerId ?
      '待你确认' : '等待客户确认';
    if (authorization.status === 'GRANTED') return '已同意';
    if (authorization.status === 'REJECTED') return '已拒绝';
    return '已结束';
  }

  static canDecide(authorization: PhotoAuthorizationSummary, actorId: number): boolean {
    return authorization.status === 'PENDING' && authorization.customerId === actorId &&
      authorization.photoUsageScope === 'PORTFOLIO_DISPLAY';
  }

  static canReview(order: OrderEngagementSummary, actorId: number, reviews: ReviewSummary[]): boolean {
    if (actorId !== order.customerId && actorId !== order.providerUserId) return false;
    if (reviews.some((review: ReviewSummary) => review.reviewerId === actorId)) return false;
    if (order.status === 'COMPLETED') return true;
    if (order.status !== 'REFUNDED') return false;
    const responsibility = (order.refundStatus ?? '').replace('REFUNDED_', '');
    return responsibility === 'BOTH_FAULT' ||
      (responsibility === 'PROVIDER_FAULT' && actorId === order.customerId) ||
      (responsibility === 'CUSTOMER_FAULT' && actorId === order.providerUserId);
  }

  static canFollowUp(review: ReviewSummary, actorId: number): boolean {
    return review.reviewerId === actorId && review.isVisible !== false;
  }

  static canComplain(review: ReviewSummary, actorId: number,
    complaints: ReviewComplaintSummary[]): boolean {
    return review.targetUserId === actorId && review.isVisible !== false &&
      !complaints.some((item: ReviewComplaintSummary) => item.reviewId === review.reviewId &&
        item.complainantId === actorId && item.status === 'PENDING');
  }

  static canCancelComplaint(complaint: ReviewComplaintSummary, actorId: number): boolean {
    return complaint.complainantId === actorId && complaint.status === 'PENDING';
  }

  static conversationAuthorizations(authorizations: PhotoAuthorizationSummary[]): PhotoAuthorizationSummary[] {
    const latest = new Map<number, PhotoAuthorizationSummary>();
    const pending: PhotoAuthorizationSummary[] = [];
    authorizations.forEach((item: PhotoAuthorizationSummary) => {
      if (item.status === 'PENDING') pending.push(item);
      else if (!latest.has(item.orderId) || latest.get(item.orderId)!.id < item.id) latest.set(item.orderId, item);
    });
    return pending.concat(Array.from(latest.values())).sort((a: PhotoAuthorizationSummary,
      b: PhotoAuthorizationSummary) => b.id - a.id);
  }
}
