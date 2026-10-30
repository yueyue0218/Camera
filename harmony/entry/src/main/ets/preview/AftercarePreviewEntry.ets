// Preview fixtures are isolated under ohosTest; this entry is not a navigable app page.
import { AuthorizationCardPreview, AuthorizationDetailPreview, AuthorizationSelectionPreview,
  ComplaintFormPreview, ReviewDetailPreview, ReviewFormPreview } from '../../../ohosTest/ets/preview/AftercarePreview';

@Preview({ title: '照片展示申请卡', width: 1170, height: 900, dpi: 480, locale: 'zh_CN' })
@Component
struct AuthorizationCardFrame { build() { AuthorizationCardPreview() } }

@Preview({ title: '展示授权 · 选择照片', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct AuthorizationSelectionFrame { build() { AuthorizationSelectionPreview() } }

@Preview({ title: '展示授权 · 查看申请', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct AuthorizationDetailFrame { build() { AuthorizationDetailPreview() } }

@Preview({ title: '评价这次约拍', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct ReviewFormFrame { build() { ReviewFormPreview() } }

@Preview({ title: '查看评价', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct ReviewDetailFrame { build() { ReviewDetailPreview() } }

@Preview({ title: '投诉这条评价', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct ComplaintFormFrame { build() { ComplaintFormPreview() } }
