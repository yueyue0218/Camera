export const demoCreditSummary = {
  userId: 2001,
  creditScore: 86,
  creditLevel: '良好',
  summary: '近期交易表现稳定',
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
    scoreAfter: 86,
    reason: '订单按时完成，双方确认交付',
    createdAt: '2026-06-03T14:20:00'
  },
  {
    recordId: 2,
    userId: 2001,
    relatedOrderId: 8105,
    eventType: 'REVIEW_RECEIVED',
    scoreChange: 2,
    scoreAfter: 83,
    reason: '收到五星评价',
    createdAt: '2026-05-30T19:10:00'
  },
  {
    recordId: 3,
    userId: 2001,
    relatedOrderId: 8103,
    eventType: 'DELIVERY_ON_TIME',
    scoreChange: 1,
    scoreAfter: 81,
    reason: '交付记录稳定',
    createdAt: '2026-05-24T16:35:00'
  },
  {
    recordId: 4,
    userId: 2001,
    relatedOrderId: 8099,
    eventType: 'COMPLAINT_RESOLVED',
    scoreChange: -1,
    scoreAfter: 80,
    reason: '一次申诉处理完成，平台已记录',
    createdAt: '2026-05-18T11:40:00'
  }
]
