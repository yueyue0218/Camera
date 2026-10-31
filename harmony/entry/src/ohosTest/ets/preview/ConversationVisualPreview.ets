import { ConversationDetailPage, ConversationVisualPreview } from '../../../main/ets/pages/ConversationDetailPage';
import { DeliverySummary, MessageSummary, OrderSummary, QuoteSummary } from '../../../main/ets/model/ApiModels';

const QUOTE: QuoteSummary = { quotationId: 7, conversationId: 12, customerId: 1,
  providerUserId: 2, amountCent: 29800, shootStartTime: '2026-10-20T14:00:00',
  shootEndTime: '2026-10-20T16:00:00', deliveryDeadline: '2026-10-23T18:00:00',
  location: '校园人像', serviceContent: '校园写真', status: 'CONFIRMED',
  createdAt: '2026-10-20T14:51:00' };
const ORDER: OrderSummary = { orderId: 9, conversationId: 12, customerId: 1,
  providerUserId: 2, status: 'DELIVERED_PENDING_CONFIRM', amountCent: 29800,
  shootLocation: '南京 · 校园写真', shootStartTime: '2026-10-20T14:00:00',
  createdAt: '2026-10-20T15:02:00' };
const DELIVERY: DeliverySummary = { deliveryId: 4, orderId: 9, deliveryRound: 1,
  uploadTime: '2026-10-20T16:06:00', files: [
    { fileId: 31, fileType: 'IMAGE', fileName: '校园写真1.jpg' },
    { fileId: 32, fileType: 'IMAGE', fileName: '校园写真2.jpg' },
    { fileId: 33, fileType: 'IMAGE', fileName: '校园写真3.jpg' }
  ] };
const MESSAGES: MessageSummary[] = [
  { messageId: 1, conversationId: 12, senderId: 1, messageType: 'TEXT',
    content: '你好，周六下午方便拍摄吗？', createdAt: '2026-10-20T14:40:00' },
  { messageId: 2, conversationId: 12, senderId: 2, messageType: 'TEXT',
    content: '可以的，拍摄地点我们再确认一下。', createdAt: '2026-10-20T14:42:00' }
];
const CUSTOMER: ConversationVisualPreview = { peerName: '摄影爱好者', userId: 1,
  messages: MESSAGES, quotes: [QUOTE], orders: [ORDER], deliveries: [DELIVERY] };
const PROVIDER: ConversationVisualPreview = { peerName: '木禾', userId: 2,
  messages: MESSAGES, quotes: [QUOTE], orders: [ORDER], deliveries: [DELIVERY] };

@Component
export struct ConversationCustomerVisualPreview {
  build() { ConversationDetailPage({ conversationId: 12, previewState: CUSTOMER }) }
}

@Component
export struct ConversationProviderVisualPreview {
  build() { ConversationDetailPage({ conversationId: 12, previewState: PROVIDER }) }
}
