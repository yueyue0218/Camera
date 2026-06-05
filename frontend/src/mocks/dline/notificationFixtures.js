export const demoNotifications = [
  {
    notificationId: 301,
    title: '收到一条新评价',
    content: '对方留下了新的拍摄体验反馈。',
    type: 'REVIEW_RECEIVED',
    relatedType: 'REVIEW',
    relatedId: 8106,
    isRead: false,
    createdAt: '2026-06-03T10:24:00'
  },
  {
    notificationId: 302,
    title: '订单状态更新',
    content: '校园毕业照订单已确认完成。',
    type: 'ORDER_STATUS_CHANGED',
    relatedType: 'ORDER',
    relatedId: 8106,
    isRead: false,
    createdAt: '2026-06-03T09:12:00'
  },
  {
    notificationId: 303,
    title: '评价申诉已受理',
    content: '平台已收到你的评价申诉，处理结果会通过通知同步。',
    type: 'REVIEW_COMPLAINT_CREATED',
    relatedType: 'REVIEW_COMPLAINT',
    relatedId: 9001,
    isRead: true,
    createdAt: '2026-06-02T18:20:00'
  },
  {
    notificationId: 304,
    title: '阿岚发来新消息',
    content: '成片已确认，后续可以在订单里查看评价。',
    type: 'MESSAGE_RECEIVED',
    relatedType: 'CONVERSATION',
    relatedId: 7001,
    isRead: false,
    createdAt: '2026-06-02T17:45:00'
  }
]
