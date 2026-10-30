import { MockPaymentConfirm } from '../../../main/ets/features/conversation/MockPaymentConfirm';
import { OrderEventCard } from '../../../main/ets/features/conversation/OrderEventCard';
import { QuoteDetailContent } from '../../../main/ets/features/conversation/QuoteDetailContent';
import { QuoteEventCard } from '../../../main/ets/features/conversation/QuoteEventCard';
import { OrderSummary, QuoteSummary } from '../../../main/ets/model/ApiModels';
import { PortraTheme } from '../../../main/ets/theme/PortraTheme';

const PENDING_QUOTE: QuoteSummary = {
  quotationId: 11, conversationId: 4, customerId: 1, providerUserId: 2, amountCent: 29900,
  shootStartTime: '2026-11-08T14:00:00', shootEndTime: '2026-11-08T16:00:00',
  deliveryDeadline: '2026-11-15T18:00:00', location: '城市公园南门',
  serviceContent: '双人写真，含 20 张原片及 5 张精修', originalCount: 20, refinedCount: 5,
  photoUsageScope: 'PERSONAL_ONLY', terms: '拍摄后七日内交付', status: 'PENDING_CONFIRM',
  createdAt: '2026-11-01T10:00:00'
};

const PENDING_ORDER: OrderSummary = {
  orderId: 7, quoteId: 11, conversationId: 4, customerId: 1, providerUserId: 2,
  status: 'PENDING_PAYMENT', amountCent: 29900, shootStartTime: '2026-11-08T14:00:00',
  createdAt: '2026-11-01T10:01:00'
};

const CONFIRMED_QUOTE: QuoteSummary = {
  quotationId: 11, conversationId: 4, customerId: 1, providerUserId: 2, amountCent: 29900,
  shootStartTime: '2026-11-08T14:00:00', shootEndTime: '2026-11-08T16:00:00',
  deliveryDeadline: '2026-11-15T18:00:00', location: '城市公园南门',
  serviceContent: '双人写真，含 20 张原片及 5 张精修', originalCount: 20, refinedCount: 5,
  photoUsageScope: 'PERSONAL_ONLY', terms: '拍摄后七日内交付', status: 'CONFIRMED',
  createdAt: '2026-11-01T10:00:00'
};

const REJECTED_QUOTE: QuoteSummary = {
  quotationId: 12, conversationId: 4, customerId: 1, providerUserId: 2, amountCent: 36800,
  shootStartTime: '2026-11-09T10:00:00', shootEndTime: '2026-11-09T12:00:00',
  deliveryDeadline: '2026-11-16T18:00:00', location: '植物园', serviceContent: '个人写真',
  originalCount: 15, refinedCount: 3, photoUsageScope: 'PERSONAL_ONLY',
  status: 'REJECTED', createdAt: '2026-11-02T10:00:00'
};

@Component
export struct CustomerQuotePreview {
  build() {
    Column() { QuoteEventCard({ quote: PENDING_QUOTE }) }
      .width('100%').padding(20).backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct ProviderQuotePreview {
  build() {
    Column() { QuoteEventCard({ quote: PENDING_QUOTE }) }
      .width('100%').padding(20).backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct CustomerOrderPreview {
  build() {
    Column({ space: 16 }) {
      QuoteEventCard({ quote: CONFIRMED_QUOTE })
      OrderEventCard({ order: PENDING_ORDER, userId: 1 })
    }.width('100%').padding(20).backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct ProviderOrderPreview {
  build() {
    Column({ space: 16 }) {
      QuoteEventCard({ quote: CONFIRMED_QUOTE })
      OrderEventCard({ order: PENDING_ORDER, userId: 2 })
    }.width('100%').padding(20).backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct RejectedQuotePreview {
  build() {
    Column() { QuoteEventCard({ quote: REJECTED_QUOTE }) }
      .width('100%').padding(20).backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct QuoteDetailPreview {
  build() {
    Scroll() {
      QuoteDetailContent({ quote: PENDING_QUOTE })
        .padding(20)
    }.width('100%').height('100%').backgroundColor(PortraTheme.pageBackground)
  }
}

@Component
export struct PaymentConfirmPreview {
  build() {
    Column() {
      MockPaymentConfirm({ amountCent: 29900 })
    }.width('100%').padding(20).backgroundColor(PortraTheme.pageBackground)
  }
}
