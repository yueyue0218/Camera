export const demoCreditSummary = {
  userId: 2001,
  creditScore: 91.8,
  creditLevel: '信用优秀',
  summary: '近期履约稳定',
  effectiveOrderCount: 13,
  completedOrderCount: 12,
  goodReviewRate: 88.9,
  defaultRate: 7.7,
  riskRecordCount: 1,
  receivedReviewCount: 9,
  averageRating: 4.8,
  recordCount: 4,
  lastUpdatedAt: '2026-06-03T14:20:00'
}

export const demoCreditRecords = [
  {
    recordId: 1,
    userId: 2001,
    relatedOrderId: 8106,
    eventType: 'ORDER_COMPLETED',
    scoreChange: 3,
    appliedScoreChange: 3,
    scoreAfter: 91.8,
    reason: '订单按时完成',
    createdAt: '2026-06-03T14:20:00'
  },
  {
    recordId: 2,
    userId: 2001,
    relatedOrderId: 8105,
    eventType: 'REVIEW_RECEIVED',
    scoreChange: 0,
    appliedScoreChange: 0,
    scoreAfter: 88.8,
    reason: '收到五星评价',
    createdAt: '2026-05-30T19:10:00'
  },
  {
    recordId: 3,
    userId: 2001,
    relatedOrderId: 8103,
    eventType: 'DELIVERY_ON_TIME',
    scoreChange: 1,
    appliedScoreChange: 1,
    scoreAfter: 88.8,
    reason: '交付记录稳定',
    createdAt: '2026-05-24T16:35:00'
  },
  {
    recordId: 4,
    userId: 2001,
    relatedOrderId: 8099,
    eventType: 'COMPLAINT_RESOLVED',
    scoreChange: -1,
    appliedScoreChange: -1,
    scoreAfter: 87.8,
    reason: '风险记录已处理',
    createdAt: '2026-05-18T11:40:00'
  }
]
