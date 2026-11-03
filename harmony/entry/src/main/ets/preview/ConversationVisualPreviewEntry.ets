import { ConversationCustomerVisualPreview, ConversationProviderVisualPreview } from
  '../../../ohosTest/ets/preview/ConversationVisualPreview';

@Preview({ title: '聊天 · 客户', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct CustomerConversationFrame {
  build() { ConversationCustomerVisualPreview() }
}

@Preview({ title: '聊天 · 摄影师', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct ProviderConversationFrame {
  build() { ConversationProviderVisualPreview() }
}
