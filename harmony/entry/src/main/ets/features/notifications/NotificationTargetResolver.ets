import { NotificationSummary } from '../../model/ApiModels';
interface TargetMetadata { orderId?: number; reviewId?: number; complaintId?: number; disputeId?: number; reportId?: number; }
export class NotificationTarget { kind: string; id: number; orderId: number;
  constructor(kind: string,id: number,orderId: number=0){this.kind=kind;this.id=id;this.orderId=orderId;}
}
export class NotificationTargetResolver {
  static resolve(item: NotificationSummary): NotificationTarget | undefined {
    if(item.navigationPath && (!item.navigationPath.startsWith('/')||item.navigationPath.startsWith('//'))){return undefined;}
    let metadata: TargetMetadata={};
    try {if(item.metadataJson){metadata=JSON.parse(item.metadataJson) as TargetMetadata;if(metadata===null||typeof metadata!=='object'||Array.isArray(metadata)){return undefined;}}}catch{return undefined;}
    const type=(item.eventType||item.type||'').toUpperCase(),related=(item.relatedType??'').toUpperCase();
    const orderId=NotificationTargetResolver.id(metadata.orderId)??0;
    if(type.includes('CREDIT')){return new NotificationTarget('credit',0);}
    let kind='',relation='',id: number|undefined;
    if(type.includes('REVIEW_COMPLAINT')){kind='complaint';relation='REVIEW_COMPLAINT';id=metadata.complaintId;}
    else if(type.includes('DISPUTE')){kind='dispute';relation='DISPUTE';id=metadata.disputeId;}
    else if(type.startsWith('REVIEW_')){kind='review';relation='REVIEW';id=metadata.reviewId;}
    else if(type.startsWith('REPORT_')){kind='report';relation='REPORT';id=metadata.reportId;}
    else if(type.startsWith('MOMENT_')){kind='moment';relation='MOMENT';}
    else if(type.startsWith('ORDER_')){kind='order';relation='ORDER';id=metadata.orderId;}
    else {return undefined;}
    if(related && related!==relation){return undefined;}
    if(id!==undefined && item.relatedId!==undefined&&item.relatedId!==null&&id!==item.relatedId){return undefined;}
    const targetId=NotificationTargetResolver.id(id??item.relatedId);if(targetId===undefined){return undefined;}
    if(metadata.orderId!==undefined&&orderId===0){return undefined;}
    return new NotificationTarget(kind,targetId,kind==='order'?targetId:orderId);
  }
  private static id(value?: number|null): number|undefined {return typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:undefined;}
}
