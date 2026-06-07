export const demoCreditSummary = {
  userId: 2001,
  creditScore: 100,
  creditLevel: '信用优秀',
  summary: 'Recent activity stays stable',
  completedOrderCount: 12,
  receivedReviewCount: 9,
  averageRating: 4.8,
  onTimeRate: 96,
  recordCount: 5,
  lastUpdatedAt: '2026-06-03T14:20:00'
}

export const demoCreditRecords = [
  {
    recordId: 1,
    userId: 2001,
    relatedOrderId: 8106,
    eventType: 'ORDER_COMPLETED',
    scoreChange: 3,
    scoreAfter: 100,
    reason: 'Order completed on time and both sides confirmed the handoff.',
    createdAt: '2026-06-03T14:20:00'
  },
  {
    recordId: 2,
    userId: 2001,
    relatedOrderId: 8105,
    eventType: 'REVIEW_RECEIVED',
    scoreChange: 0,
    scoreAfter: 97,
    reason: 'Received a five-star review.',
    createdAt: '2026-05-30T19:10:00'
  },
  {
    recordId: 3,
    userId: 2001,
    relatedOrderId: 8103,
    eventType: 'DELIVERY_ON_TIME',
    scoreChange: 1,
    scoreAfter: 95,
    reason: 'Delivery record stayed stable.',
    createdAt: '2026-05-24T16:35:00'
  },
  {
    recordId: 4,
    userId: 2001,
    relatedOrderId: 8099,
    eventType: 'COMPLAINT_RESOLVED',
    scoreChange: -1,
    scoreAfter: 94,
    reason: 'A complaint was resolved by the platform.',
    createdAt: '2026-05-18T11:40:00'
  }
]

