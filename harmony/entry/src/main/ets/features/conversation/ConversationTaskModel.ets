import { AftercarePolicy } from '../aftercare/AftercarePolicy';
import { DeliverySummary, OrderSummary, PhotoAuthorizationSummary, QuoteSummary } from '../../model/ApiModels';
import { OrderWorkflow } from './OrderWorkflow';
import { QuoteWorkflow } from './QuoteWorkflow';

export interface ConversationTask {
  readonly label: string;
  readonly button: string;
  readonly action: string;
  readonly targetId: number;
  readonly authorizationId?: number;
}

export class ConversationTaskModel {
  static current(orders: OrderSummary[], quotes: QuoteSummary[], authorizations: PhotoAuthorizationSummary[],
    deliveries: DeliverySummary[], userId: number, providerId: number): ConversationTask | null {
    const order = orders.slice().sort((a: OrderSummary, b: OrderSummary) => b.orderId - a.orderId)[0];
    if (order !== undefined) {
      if (userId !== order.customerId && userId !== order.providerUserId) return null;
      const id = order.orderId;
      if (OrderWorkflow.canPay(order, userId)) return { label: '待支付', button: '支付', action: 'pay', targetId: id };
      if (OrderWorkflow.canUpload(order, userId)) return { label: OrderWorkflow.task(order, userId),
        button: order.status === 'REWORK_REQUIRED' ? '重新上传' : '上传照片', action: 'upload', targetId: id };
      if (OrderWorkflow.hasGallery(order) && order.status !== 'COMPLETED') return {
        label: OrderWorkflow.task(order, userId), button: '查看照片', action: 'gallery', targetId: id };
      if (order.status === 'COMPLETED') {
        const pending = authorizations.find((item: PhotoAuthorizationSummary) =>
          item.orderId === id && AftercarePolicy.canDecide(item, userId));
        if (pending !== undefined) return { label: '展示申请待确认', button: '查看申请',
          action: 'authorization', targetId: id, authorizationId: pending.id };
        if (AftercarePolicy.authorizable(order, userId) &&
          AftercarePolicy.availablePhotos(deliveries.filter((item: DeliverySummary) => item.orderId === id),
            authorizations.filter((item: PhotoAuthorizationSummary) => item.orderId === id)).length > 0) {
          return { label: '作品已交付', button: '申请展示', action: 'authorization', targetId: id };
        }
        return { label: '约拍已完成', button: '查看评价', action: 'reviews', targetId: id };
      }
      return { label: OrderWorkflow.task(order, userId), button: '查看订单', action: 'order', targetId: id };
    }
    const quote = QuoteWorkflow.active(quotes);
    if (quote !== undefined) return { label: userId === quote.customerId ? '报价待你确认' : '等待客户确认报价',
      button: '查看报价', action: 'quote', targetId: quote.quotationId };
    const confirmed = quotes.find((item: QuoteSummary) => item.status === 'CONFIRMED');
    if (confirmed !== undefined) return { label: '约拍已确认', button: '查看报价',
      action: 'quote', targetId: confirmed.quotationId };
    if (userId === providerId) return { label: '还没有约定', button: '发送报价', action: 'createQuote', targetId: 0 };
    return null;
  }
}
