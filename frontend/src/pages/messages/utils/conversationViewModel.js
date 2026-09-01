import { buildConversationWorkbenchViewModel } from './workbenchState.js'
import { canEditQuote, getQuoteEntryHint } from './quoteUtils.js'

export function buildConversationDetailViewModel({
  conversation,
  currentUser,
  messages = [],
  quotes = [],
  currentOrder,
  statusLogs = [],
  deliveryRecords = [],
  photoAuthorizations = [],
  activeQuote,
  editingQuotationId,
  showQuoteForm
}) {
  const workbench = buildConversationWorkbenchViewModel({
    conversation,
    currentUser,
    activeRole: currentUser.role,
    messages,
    quotes,
    order: currentOrder,
    statusLogs,
    deliveries: deliveryRecords,
    authorizations: photoAuthorizations
  })
  const actions = workbench.actions
  const editingQuote = editingQuotationId
    ? quotes.find(quote => String(quote.quotationId) === String(editingQuotationId))
    : null
  const canCreateQuote = actions.canSendQuote
  const canEditSelectedQuote = editingQuote
    && canEditQuote(editingQuote, conversation, currentUser)
  const canSubmitQuoteForm = editingQuotationId ? canEditSelectedQuote : canCreateQuote
  const canSeeQuoteEntry = !currentOrder && (actions.canSendQuote || actions.canEditQuote || showQuoteForm)
  const quoteEntryHint = currentOrder ? '' : getQuoteEntryHint(conversation, currentUser, quotes)
  const activeQuoteIsPending = activeQuote?.status === 'PENDING_CONFIRM'
    && String(activeQuote.quotationId) === String(actions.pendingQuote?.quotationId)

  return {
    ...workbench,
    actions,
    editingQuote,
    canCreateQuote,
    canSubmitQuoteForm,
    canSeeQuoteEntry,
    quoteEntryHint,
    activeQuoteCanConfirm: activeQuoteIsPending && actions.canConfirmQuote,
    activeQuoteCanReject: activeQuoteIsPending && actions.canRejectQuote,
    activeQuoteCanResend: activeQuote?.status === 'REJECTED' && actions.canSendQuote
  }
}
