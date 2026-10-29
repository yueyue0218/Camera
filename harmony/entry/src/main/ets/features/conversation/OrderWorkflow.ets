import { OrderSummary } from '../../model/ApiModels';

export class OrderWorkflow {
  static status(status: string | undefined): string {
    switch (status) {
      case 'PENDING_PAYMENT': return '待支付';
      case 'PAID_PENDING_SHOOT': return '待拍摄';
      case 'SHOOTING': return '拍摄中';
      case 'PENDING_DELIVERY': return '待交付';
      case 'DELIVERED_PENDING_CONFIRM': return '待确认收片';
      case 'REWORK_REQUIRED': return '待返修';
      case 'COMPLETED': return '已完成';
      case 'CANCELLED': return '已取消';
      case 'REFUNDED': return '已退款';
      case 'APPEALING': return '申诉中';
      default: return '待更新';
    }
  }

  static task(order: OrderSummary, userId: number): string {
    if (order.status === 'PENDING_PAYMENT') {
      return order.customerId === userId ? '请确认支付' : '等待客户支付';
    }
    if (order.status === 'PAID_PENDING_SHOOT') return '等待拍摄';
    return OrderWorkflow.status(order.status);
  }

  static canPay(order: OrderSummary, userId: number): boolean {
    return order.status === 'PENDING_PAYMENT' && order.customerId === userId;
  }

  static inConversation(orders: OrderSummary[], conversationId: number): OrderSummary[] {
    return orders.filter((order: OrderSummary) => order.conversationId === conversationId);
  }

  static money(amountCent: number | undefined): string {
    return typeof amountCent === 'number' && Number.isSafeInteger(amountCent) && amountCent >= 0 ?
      `¥${(amountCent / 100).toFixed(2)}` : '费用待更新';
  }
}
