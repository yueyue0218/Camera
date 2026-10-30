// Preview fixtures are isolated under ohosTest and this entry is not in main_pages.json.
import { CustomerOrderPreview, CustomerQuotePreview, PaymentConfirmPreview, ProviderOrderPreview,
  ProviderQuotePreview, QuoteDetailPreview, RejectedQuotePreview } from '../../../ohosTest/ets/preview/QuoteOrderPreview';

@Preview({ title: '客户 · 报价与订单', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct QuoteOrderCustomerPreview {
  build() { CustomerQuotePreview() }
}

@Preview({ title: '摄影师 · 报价与订单', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct QuoteOrderProviderPreview {
  build() { ProviderQuotePreview() }
}

@Preview({ title: '客户 · 待支付', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct CustomerPendingPaymentPreview {
  build() { CustomerOrderPreview() }
}

@Preview({ title: '摄影师 · 等待客户支付', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct ProviderPendingPaymentPreview {
  build() { ProviderOrderPreview() }
}

@Preview({ title: '已拒绝报价', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct QuoteRejectedPreview {
  build() { RejectedQuotePreview() }
}

@Preview({ title: '报价详情', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct QuoteDetailContentPreview {
  build() { QuoteDetailPreview() }
}

@Preview({ title: '确认支付', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct PaymentConfirmationPreview {
  build() { PaymentConfirmPreview() }
}
