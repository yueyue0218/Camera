# Harmony C module stage 2: quote and order flow

## Product surfaces

- Conversation: one chronological stream. Text stays lightweight; quote and order entries show only amount, schedule, current state, and one clear action.
- Quote form: a separate mobile page with shooting, service, delivery, and optional notes. Empty fields by default. Keep edits until a successful server response; warn before discarding.
- Quote detail: full terms and customer decision. Only the customer can confirm or decline a pending, unexpired quote. The provider can edit a pending quote or start a new one after rejection.
- Order detail: one-column status, next action, schedule, amount, progress dots, and return-to-conversation. No delivery/rework controls in this stage.
- Payment confirmation: a short sheet stating the amount and that this is a simulation with no real charge. Never display success before the server confirms it.

User-facing labels are centralized where states are mapped. Raw enum values, transport terms, and internal identifiers must not appear in product copy.

## Navigation

`ConversationDetail(conversationId)` -> `QuoteForm(conversationId, optional quotationId)` -> pop on confirmed save.

`ConversationDetail(conversationId)` -> `QuoteDetail(conversationId, quotationId)` -> pop after a confirmed decision.

`ConversationDetail(conversationId)` -> `OrderDetail(orderId)` -> return to the existing conversation stack.

`OrderList` -> `OrderDetail(orderId)` -> return to the existing list stack; a separate "返回会话" action may open `ConversationDetail(conversationId)`.

All routes carry entity IDs. A missing or unauthorized record renders an actionable error, never a guessed local object. Navigation does not imply server success.

## Backend preflight

- `orders.quote_id` and `payment_records.order_id` already have unique constraints in `V1_baseline.sql` and matching legacy migration scripts. No new schema migration is planned.
- Quote confirmation uses a pessimistic quote-row lock; create, edit, and reject must be checked against the same state rules. Concurrent create in one conversation currently lacks a shared lock.
- Provider schedule checking is a read-before-write query; confirmation of two quotes in different conversations currently lacks a shared provider lock.
- Mock payment locks the order row; cancellation currently loads it without a lock. Both paths must serialize on the order row.
- H2 concurrency tests can exercise transaction overlap and repository constraints, but they cannot prove MySQL's exact lock behavior. MySQL integration remains a separate acceptance item.
