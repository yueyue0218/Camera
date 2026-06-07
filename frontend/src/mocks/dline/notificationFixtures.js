export const demoNotifications = [
  {
    notificationId: 301,
    title: 'New review received',
    content: 'The other side left new feedback about the shoot experience.',
    type: 'REVIEW_RECEIVED',
    relatedType: 'REVIEW',
    relatedId: 8106,
    isRead: false,
    createdAt: '2026-06-03T10:24:00'
  },
  {
    notificationId: 302,
    title: 'Order updated',
    content: 'Order #8106 has been marked complete.',
    type: 'ORDER_STATUS_CHANGED',
    relatedType: 'ORDER',
    relatedId: 8106,
    isRead: false,
    createdAt: '2026-06-03T09:12:00'
  },
  {
    notificationId: 303,
    title: 'Review complaint received',
    content: 'The platform received your complaint and will sync the result here.',
    type: 'REVIEW_COMPLAINT_CREATED',
    relatedType: 'REVIEW_COMPLAINT',
    relatedId: 9001,
    isRead: true,
    createdAt: '2026-06-02T18:20:00'
  },
  {
    notificationId: 304,
    title: 'New message',
    content: 'The finished photos are confirmed and the review can be checked from the order.',
    type: 'MESSAGE_RECEIVED',
    relatedType: 'CONVERSATION',
    relatedId: 7001,
    isRead: false,
    createdAt: '2026-06-02T17:45:00'
  },
  {
    notificationId: 305,
    title: 'Order completed',
    content: 'Order #8108 is complete and the credit record has been refreshed.',
    type: 'ORDER_COMPLETED',
    relatedType: 'ORDER',
    relatedId: 8108,
    isRead: false,
    createdAt: '2026-06-02T16:28:00'
  },
  {
    notificationId: 306,
    title: 'Dynamic likes',
    content: 'Your moment received 2 new likes.',
    type: 'MOMENT_LIKED',
    relatedType: 'MOMENT',
    relatedId: 6101,
    isRead: false,
    createdAt: '2026-06-02T15:50:00'
  },
  {
    notificationId: 307,
    title: 'Dynamic likes',
    content: 'Your moment received 1 new like.',
    type: 'MOMENT_LIKED',
    relatedType: 'MOMENT',
    relatedId: 6101,
    isRead: true,
    createdAt: '2026-06-02T15:45:00'
  }
]
