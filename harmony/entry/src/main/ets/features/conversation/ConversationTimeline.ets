import { DeliverySummary, MessageSummary, OrderStatusLogSummary, OrderSummary, QuoteSummary } from '../../model/ApiModels';

export enum TimelineKind {
  MESSAGE = 'message',
  QUOTE = 'quote',
  ORDER = 'order',
  FULFILLMENT = 'fulfillment'
}

export interface FulfillmentEvent {
  readonly orderId: number;
  readonly title: string;
  readonly detail: string;
  readonly openGallery: boolean;
}

export interface ConversationTimelineItem {
  readonly key: string;
  readonly kind: TimelineKind;
  readonly createdAt: string;
  readonly senderId: number;
  readonly message?: MessageSummary;
  readonly quote?: QuoteSummary;
  readonly order?: OrderSummary;
  readonly event?: FulfillmentEvent;
}

/** One stable chronological stream; no synthetic backend events. */
export class ConversationTimeline {
  static build(messages: MessageSummary[], quotes: QuoteSummary[], orders: OrderSummary[] = [],
    logs: OrderStatusLogSummary[] = [], deliveries: DeliverySummary[] = []): ConversationTimelineItem[] {
    const items: ConversationTimelineItem[] = [];
    const knownQuotes = new Set<number>();
    quotes.forEach((quote: QuoteSummary) => {
      if (quote !== null && Number.isSafeInteger(quote.quotationId) && quote.quotationId > 0 &&
        !knownQuotes.has(quote.quotationId)) {
        knownQuotes.add(quote.quotationId);
        items.push({ key: `quote:${quote.quotationId}`, kind: TimelineKind.QUOTE,
          createdAt: quote.createdAt ?? '', senderId: quote.providerUserId, quote: quote });
      }
    });
    const knownOrders = new Set<number>();
    orders.forEach((order: OrderSummary) => {
      if (order !== null && Number.isSafeInteger(order.orderId) && order.orderId > 0 &&
        !knownOrders.has(order.orderId)) {
        knownOrders.add(order.orderId);
        items.push({ key: `order:${order.orderId}`, kind: TimelineKind.ORDER,
          createdAt: order.createdAt ?? '', senderId: order.providerUserId ?? 0, order: order });
      }
    });
    const knownDeliveries = new Set<number>();
    deliveries.forEach((batch: DeliverySummary) => {
      const order = orders.find((item: OrderSummary) => item.orderId === batch.orderId);
      if (order === undefined || !Number.isSafeInteger(batch.deliveryId) || batch.deliveryId <= 0 ||
        knownDeliveries.has(batch.deliveryId)) return;
      knownDeliveries.add(batch.deliveryId);
      const imageCount = (batch.files ?? []).filter(file => file.fileType === 'IMAGE').length;
      items.push({ key: `delivery:${batch.deliveryId}`, kind: TimelineKind.FULFILLMENT,
        createdAt: batch.uploadTime ?? '', senderId: order.providerUserId ?? 0,
        event: { orderId: order.orderId, title: batch.deliveryRound > 1 ? '返修作品已上传' : '作品已上传',
          detail: `${imageCount} 张照片`, openGallery: true } });
    });
    const knownLogs = new Set<number>();
    logs.forEach((log: OrderStatusLogSummary) => {
      const order = orders.find((item: OrderSummary) => item.orderId === log.orderId);
      if (order === undefined || !Number.isSafeInteger(log.logId) || log.logId! <= 0 ||
        knownLogs.has(log.logId!)) return;
      knownLogs.add(log.logId!);
      const title = log.toStatus === 'REWORK_REQUIRED' ? '客户申请返修' :
        log.toStatus === 'COMPLETED' ? '约拍已完成' :
        log.toStatus === 'CANCELLED' || log.toStatus === 'REFUNDED' ? '约拍已取消' : '';
      if (!title) return;
      items.push({ key: `status:${log.logId}`, kind: TimelineKind.FULFILLMENT,
        createdAt: log.createdAt ?? '', senderId: log.operatorId ?? 0,
        event: { orderId: order.orderId, title: title, detail: '',
          openGallery: log.toStatus === 'REWORK_REQUIRED' } });
    });
    const knownMessages = new Set<string>();
    messages.forEach((message: MessageSummary) => {
      if (message === null || message.messageId === undefined || message.messageId === null) return;
      const key = `message:${message.messageId}`;
      if (knownMessages.has(key)) return;
      knownMessages.add(key);
      if (message.messageType === 'QUOTE' && message.quotationId !== undefined &&
        knownQuotes.has(message.quotationId)) return;
      if (message.messageType === 'ORDER' && message.orderId !== undefined &&
        knownOrders.has(message.orderId)) return;
      items.push({ key: key, kind: TimelineKind.MESSAGE,
        createdAt: message.createdAt ?? '', senderId: message.senderId, message: message });
    });
    return items.sort((left: ConversationTimelineItem, right: ConversationTimelineItem) => {
      const a = Date.parse(left.createdAt);
      const b = Date.parse(right.createdAt);
      if (Number.isNaN(a) && Number.isNaN(b)) return left.key.localeCompare(right.key);
      if (Number.isNaN(a)) return 1;
      if (Number.isNaN(b)) return -1;
      return a - b || left.key.localeCompare(right.key);
    });
  }
}
