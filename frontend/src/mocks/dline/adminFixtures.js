export const demoAdminDashboard = {
  totalUsers: 128,
  todayGmvCent: 238800,
  pendingAuditCount: 2,
  pendingArbitrationCount: 1
}

export const demoCertifications = [
  {
    type: 'REAL_NAME',
    id: 601,
    userId: 2003,
    status: 'PENDING',
    realNameMasked: '李*舟',
    university: '南京大学',
    appliedAt: '2026-06-03T09:30:00'
  },
  {
    type: 'STUDENT',
    id: 602,
    userId: 1008,
    status: 'APPROVED',
    realNameMasked: '陈*',
    university: '东南大学',
    appliedAt: '2026-06-02T16:15:00'
  },
  {
    type: 'REAL_NAME',
    id: 603,
    userId: 1012,
    status: 'REJECTED',
    realNameMasked: '周*',
    university: '南京艺术学院',
    appliedAt: '2026-06-01T13:12:00'
  }
]

export const demoAdminComplaints = [
  {
    complaintId: 9001,
    reviewId: 503,
    orderId: 8104,
    complainantId: 2001,
    respondentId: 1003,
    reason: '评价中关于交付延迟的描述与订单记录不一致。',
    status: 'PENDING',
    arbitrationResult: null,
    arbitrationComment: null,
    createdAt: '2026-06-02T15:12:00'
  },
  {
    complaintId: 9002,
    reviewId: 501,
    orderId: 8106,
    complainantId: 1001,
    respondentId: 2001,
    reason: '申请补充处理说明。',
    status: 'REJECTED',
    arbitrationResult: 'REJECTED',
    arbitrationComment: '证据不足，维持原评价。',
    createdAt: '2026-05-29T11:20:00'
  }
]
