export const demoReviews = [
  {
    reviewId: 501,
    orderId: 8106,
    reviewerId: 1001,
    targetUserId: 2001,
    direction: 'CUSTOMER_TO_PROVIDER',
    rating: 5,
    content: '沟通顺畅，拍摄时会主动引导动作，交付也很准时。',
    isVisible: true,
    createdAt: '2026-06-03T10:28:00',
    replyContent: '后续补充：成片确认很快，修图风格也符合预期。',
    replyTime: '2026-06-03T18:20:00'
  },
  {
    reviewId: 502,
    orderId: 8105,
    reviewerId: 1002,
    targetUserId: 2001,
    direction: 'CUSTOMER_TO_PROVIDER',
    rating: 5,
    content: '毕业照拍摄体验很好，提前沟通了路线，现场效率高。',
    isVisible: true,
    createdAt: '2026-05-30T18:12:00',
    replyContent: null,
    replyTime: null
  },
  {
    reviewId: 503,
    orderId: 8104,
    reviewerId: 1003,
    targetUserId: 2001,
    direction: 'CUSTOMER_TO_PROVIDER',
    rating: 4,
    content: '整体不错。因为当天临时下雨，拍摄地点调整过一次，但摄影师能比较快给出替代方案，最后成片稳定。希望后续交付预览图时可以再多给一些挑选空间。',
    isVisible: true,
    createdAt: '2026-05-26T13:45:00',
    replyContent: null,
    replyTime: null
  },
  {
    reviewId: 504,
    orderId: 8102,
    reviewerId: 1004,
    targetUserId: 2001,
    direction: 'CUSTOMER_TO_PROVIDER',
    rating: 4,
    content: '拍摄过程比较轻松，沟通清楚。',
    isVisible: true,
    createdAt: '2026-05-20T09:30:00',
    replyContent: null,
    replyTime: null
  }
]

export const demoReviewComplaints = [
  {
    complaintId: 9001,
    reviewId: 503,
    orderId: 8104,
    complainantId: 2001,
    respondentId: 1003,
    reason: '评价中关于交付延迟的描述与订单记录不一致，请平台核查。',
    evidenceFileIds: '',
    status: 'PENDING',
    arbitrationResult: null,
    arbitrationComment: null,
    handledBy: null,
    createdAt: '2026-06-02T15:12:00',
    updatedAt: '2026-06-02T15:12:00',
    handledAt: null
  }
]
