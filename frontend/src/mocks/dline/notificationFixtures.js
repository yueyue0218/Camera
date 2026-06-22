export const demoNotifications = [
  {
    notificationId: 301,
    title: '收到新评价',
    content: '对方留下了新的拍摄体验评价。',
    type: 'REVIEW_RECEIVED',
    relatedType: 'REVIEW',
    relatedId: 8106,
    isRead: false,
    createdAt: '2026-06-03T10:24:00'
  },
  {
    notificationId: 302,
    title: '订单已更新',
    content: '订单 #8106 已完成。',
    type: 'ORDER_STATUS_CHANGED',
    relatedType: 'ORDER',
    relatedId: 8106,
    isRead: false,
    createdAt: '2026-06-03T09:12:00'
  },
  {
    notificationId: 303,
    title: '评价申诉已收到',
    content: '平台已收到你的申诉，结果出来后会显示在这里。',
    type: 'REVIEW_COMPLAINT_CREATED',
    relatedType: 'REVIEW_COMPLAINT',
    relatedId: 9001,
    isRead: true,
    createdAt: '2026-06-02T18:20:00'
  },
  {
    notificationId: 304,
    title: '收到新消息',
    content: '成片已确认，评价可在订单中查看。',
    type: 'MESSAGE_RECEIVED',
    relatedType: 'CONVERSATION',
    relatedId: 7001,
    isRead: false,
    createdAt: '2026-06-02T17:45:00'
  },
  {
    notificationId: 305,
    title: '订单已完成',
    content: '订单 #8108 已完成，信用分也会随之更新。',
    type: 'ORDER_COMPLETED',
    relatedType: 'ORDER',
    relatedId: 8108,
    isRead: false,
    createdAt: '2026-06-02T16:28:00'
  },
  {
    notificationId: 306,
    title: '动态点赞',
    content: '你的动态收到了 2 个新赞。',
    type: 'MOMENT_LIKED',
    relatedType: 'MOMENT',
    relatedId: 6101,
    isRead: false,
    createdAt: '2026-06-02T15:50:00'
  },
  {
    notificationId: 307,
    title: '动态点赞',
    content: '你的动态收到了 1 个新赞。',
    type: 'MOMENT_LIKED',
    relatedType: 'MOMENT',
    relatedId: 6101,
    isRead: true,
    createdAt: '2026-06-02T15:45:00'
  }
]
