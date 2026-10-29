import { SessionSummary, OrderEngagementSummary, ReviewSummary, ReviewComplaintSummary, DisputeSummary,
  CreateReviewPayload, ReviewTextPayload, CreateReviewComplaintPayload, DisputeReasonPayload, DisputeReplySummary } from '../../model/ApiModels';
import { NotificationSession } from '../notifications/NotificationController';

export interface EngagementApi {
  currentSession(key?: string): Promise<SessionSummary>;
  cancelCurrentSession(key?: string): void;
  getOrder(id: number, key: string): Promise<OrderEngagementSummary>;
  listOrderReviews(id: number, key: string): Promise<ReviewSummary[]>;
  listReviewComplaints(id: number, key: string): Promise<ReviewComplaintSummary[]>;
  listOrderDisputes(id: number, key: string): Promise<DisputeSummary[]>;
  getReview(id: number, key: string): Promise<ReviewSummary>;
  getReviewComplaint(id: number, key: string): Promise<ReviewComplaintSummary>;
  getDispute(id: number, key: string): Promise<DisputeSummary>;
  createReview(id: number, payload: CreateReviewPayload, key: string): Promise<ReviewSummary>;
  followUpReview(id: number, payload: ReviewTextPayload, key: string): Promise<ReviewSummary>;
  createReviewComplaint(id: number, payload: CreateReviewComplaintPayload, key: string): Promise<ReviewComplaintSummary>;
  createDispute(id: number, payload: DisputeReasonPayload, key: string): Promise<DisputeSummary>;
  replyDispute(id: number, payload: ReviewTextPayload, key: string): Promise<DisputeSummary>;
  cancelEngagementRequests(keys: string[]): void;
}
export class EngagementForm {
  mode: string = ''; targetId: number = 0; rating: number = 5; content: string = ''; reason: string = '评价内容不实';
  error: string = ''; busy: boolean = false; uncertain: boolean = false; discardPrompt: boolean = false;
}
export class EngagementSnapshot {
  order?: OrderEngagementSummary; userId: number = 0; reviews: ReviewSummary[] = [];
  complaints: ReviewComplaintSummary[] = []; disputes: DisputeSummary[] = [];
  loading: boolean = false; error: string = ''; recordsError: string = ''; loginRequired: boolean = false;
  message: string = ''; form: EngagementForm = new EngagementForm();
}
class Submission {
  baselineRevision: string = ''; baselineIds: number[] = [];
  key: string; mode: string; targetId: number; orderId: number; actorId: number; content: string; reason: string; rating: number;
  constructor(key: string, form: EngagementForm, orderId: number, actorId: number) {
    this.key=key; this.mode=form.mode; this.targetId=form.targetId; this.orderId=orderId; this.actorId=actorId;
    this.content=form.content.trim(); this.reason=form.reason; this.rating=form.rating;
  }
}
export class EngagementPendingStore {
  static readonly shared: EngagementPendingStore = new EngagementPendingStore();
  readonly entries: Map<string, Submission> = new Map<string, Submission>();
}
export class EngagementPolicy {
  static readonly complaintReasons: string[] = ['评价内容不实','评价包含攻击性表述','评价与订单无关','其他评价争议'];
  static maxLength(mode: string, reason: string=''): number { return 200; }
  static validate(mode: string, rating: number, content: string, reason: string): string {
    if (!['review','followup','complaint','dispute','reply'].includes(mode)) { return '无效的表单'; }
    if (content.trim().length === 0) { return '请填写内容，不能只包含空白字符。'; }
    if (content.trim().length > EngagementPolicy.maxLength(mode,reason)) { return '内容不能超过 200 字。'; }
    if (mode === 'review' && (!Number.isInteger(rating) || rating < 1 || rating > 5)) { return '请选择 1 至 5 星评分。'; }
    if (mode === 'complaint' && !EngagementPolicy.complaintReasons.includes(reason)) { return '请选择申诉原因。'; }
    return '';
  }
  static canReview(order: OrderEngagementSummary, actor: number, reviews: ReviewSummary[]): boolean {
    if (![order.customerId,order.providerUserId].includes(actor) || order.customerId === order.providerUserId ||
      reviews.some((item: ReviewSummary)=>item.reviewerId === actor)) { return false; }
    if (order.status === 'COMPLETED') { return true; }
    if (order.status !== 'REFUNDED') { return false; }
    const status = (order.refundStatus ?? '').replace('REFUNDED_','');
    return status === 'BOTH_FAULT' || (status === 'PROVIDER_FAULT' && actor === order.customerId) ||
      (status === 'CUSTOMER_FAULT' && actor === order.providerUserId);
  }
  static canDispute(order: OrderEngagementSummary, disputes: DisputeSummary[]): boolean {
    return !['COMPLETED','CANCELLED','REFUNDED','APPEALING'].includes(order.status ?? '') &&
      !disputes.some((item: DisputeSummary)=>['OPEN','REPLIED'].includes(item.status));
  }
  static canReply(dispute: DisputeSummary, actor: number): boolean {
    return actor > 0 && dispute.status === 'OPEN' && dispute.initiatorId !== actor;
  }
}
let nextEngagementInstance: number = 0;
export class EngagementController {
  private state: EngagementSnapshot = new EngagementSnapshot();
  private readonly api: EngagementApi; private readonly session: NotificationSession;
  private readonly changed: (value: EngagementSnapshot)=>void;
  private active: boolean = false; private generation: number = 0; private loadedVersion: number = -1;
  private readonly key: string = `engagement.c.${++nextEngagementInstance}`;
  private keys: string[] = []; private readonly pending: Map<string,Submission> = EngagementPendingStore.shared.entries;
  constructor(api: EngagementApi, session: NotificationSession, changed: (value: EngagementSnapshot)=>void) {
    this.api=api; this.session=session; this.changed=changed;
  }
  resume(): void { this.active=true; this.state.loginRequired=!this.session.isAuthenticated(); this.publish(); }
  suspend(): void {
    this.active=false; this.generation++; this.api.cancelEngagementRequests(this.keys.slice());
    this.api.cancelCurrentSession(`${this.key}.session`); this.keys=[]; this.state=new EngagementSnapshot(); this.publish();
  }
  private publish(): void {
    const next=new EngagementSnapshot(); next.order=this.state.order; next.userId=this.state.userId;
    next.reviews=this.state.reviews.slice();next.complaints=this.state.complaints.slice();next.disputes=this.state.disputes.slice();
    next.loading=this.state.loading;next.error=this.state.error;next.recordsError=this.state.recordsError;
    next.loginRequired=this.state.loginRequired;next.message=this.state.message;
    const f=this.state.form,copy=new EngagementForm();copy.mode=f.mode;copy.targetId=f.targetId;copy.rating=f.rating;
    copy.content=f.content;copy.reason=f.reason;copy.error=f.error;copy.busy=f.busy;copy.uncertain=f.uncertain;copy.discardPrompt=f.discardPrompt;
    next.form=copy; this.changed(next);
  }
  private current(epoch: number, version: number): boolean {
    if(epoch!==this.generation){return false;}
    if(version!==this.session.getSessionVersion()){this.suspend();this.resume();return false;}
    return this.active;
  }
  private identity(): boolean {
    if(!this.active){return false;}
    if(!this.session.isAuthenticated() || this.loadedVersion!==this.session.getSessionVersion()){
      this.suspend();this.resume();return false;
    }
    return true;
  }
  private requestKey(suffix: string): string { const key=`${this.key}.${suffix}`;this.keys.push(key);return key; }
  async loadTarget(kind: string,id: number,expectedOrderId: number=0): Promise<void> {
    if(!this.active||this.state.loading||!this.session.isAuthenticated()){return;}
    if(!Number.isSafeInteger(id)||id<=0){this.state.error='无效的通知对象';this.publish();return;}
    if(kind==='order'){await this.load(id);return;}
    const epoch=++this.generation,version=this.session.getSessionVersion();this.state.loading=true;this.publish();
    let orderId=0; let targetReview: ReviewSummary | undefined; let targetComplaint: ReviewComplaintSummary | undefined;
    try {
      if(kind==='review') {const item=await this.api.getReview(id,this.requestKey(`target.${epoch}`));if(item.reviewId!==id){throw new Error('评价对象不一致');}orderId=item.orderId;targetReview=item;}
      else if(kind==='complaint'){const item=await this.api.getReviewComplaint(id,this.requestKey(`target.${epoch}`));if(item.complaintId!==id){throw new Error('申诉对象不一致');}orderId=item.orderId;targetComplaint=item;}
      else if(kind==='dispute'){const item=await this.api.getDispute(id,this.requestKey(`target.${epoch}`));if(item.id!==id){throw new Error('订单申诉对象不一致');}orderId=item.orderId;}
      else {throw new Error('暂不支持此通知对象');}
      if(!this.current(epoch,version)){return;}
      if(!Number.isSafeInteger(orderId)||orderId<=0||(expectedOrderId>0&&expectedOrderId!==orderId)){throw new Error('关联订单信息不一致');}
      this.state.loading=false;await this.load(orderId,targetReview,targetComplaint);
    }catch(error){if(this.current(epoch,version)){this.state.error=(error as Error).message||'对应内容暂时无法打开';this.state.loading=false;this.publish();}}
  }
  async load(orderId: number, targetReview?: ReviewSummary, targetComplaint?: ReviewComplaintSummary): Promise<void> {
    if(!this.active || this.state.loading || this.state.form.busy){return;}
    if(!this.session.isAuthenticated()){this.suspend();this.resume();return;}
    if(!Number.isSafeInteger(orderId)||orderId<=0){this.state.error='无效的订单';this.publish();return;}
    const epoch=++this.generation,version=this.session.getSessionVersion();
    const sameContext=this.state.order?.orderId===orderId&&this.loadedVersion===version;
    const form=sameContext?this.state.form:new EngagementForm();const message=sameContext?this.state.message:'';
    this.state=new EngagementSnapshot();this.state.form=form;this.state.message=message;this.state.loading=true;this.publish();
    try {
      const actor=await this.api.currentSession(`${this.key}.session`);if(!this.current(epoch,version)){return;}
      const order=await this.api.getOrder(orderId,this.requestKey(`order.${epoch}`));if(!this.current(epoch,version)){return;}
      if(order?.orderId!==orderId||!Number.isSafeInteger(actor.userId)||actor.userId<=0||
        ![order.customerId,order.providerUserId].includes(actor.userId)){throw new Error('无权查看这笔订单');}
      this.state.order=order;this.state.userId=actor.userId;this.loadedVersion=version;
      const reviews=await this.api.listOrderReviews(orderId,this.requestKey(`reviews.${epoch}`));if(!this.current(epoch,version)){return;}
      if(!Array.isArray(reviews)||reviews.some((r: ReviewSummary)=>r.orderId!==orderId||!Number.isSafeInteger(r.reviewId)||r.reviewId<=0)){throw new Error('评价数据异常');}
      this.state.reviews=reviews;
      if(targetReview!==undefined&&!reviews.some((r:ReviewSummary)=>r.reviewId===targetReview.reviewId)) {
        if(targetReview.orderId!==orderId){throw new Error('评价关联订单不一致');}
        this.state.reviews.push(targetReview);
      }
      if(targetComplaint!==undefined) {
        if(targetComplaint.orderId!==orderId||!Number.isSafeInteger(targetComplaint.reviewId)||targetComplaint.reviewId<=0||
          ![targetComplaint.complainantId,targetComplaint.respondentId].includes(actor.userId)){throw new Error('无权查看这条申诉');}
        this.state.complaints.push(targetComplaint);
      }
      try {
        const disputes=await this.api.listOrderDisputes(orderId,this.requestKey(`disputes.${epoch}`));if(!this.current(epoch,version)){return;}
        if(!Array.isArray(disputes)||disputes.some((d: DisputeSummary)=>d.orderId!==orderId||!Number.isSafeInteger(d.id)||d.id<=0)){throw new Error('订单申诉数据异常');}
        this.state.disputes=disputes;
        for(const review of reviews){
          const list=await this.api.listReviewComplaints(review.reviewId,this.requestKey(`complaints.${epoch}.${review.reviewId}`));
          if(!this.current(epoch,version)){return;}
          if(!Array.isArray(list)||list.some((r: ReviewComplaintSummary)=>r.orderId!==orderId||r.reviewId!==review.reviewId||!Number.isSafeInteger(r.complaintId)||r.complaintId<=0)){throw new Error('评价申诉数据异常');}
          list.forEach((item:ReviewComplaintSummary)=>{
            if(!this.state.complaints.some((r:ReviewComplaintSummary)=>r.complaintId===item.complaintId)){this.state.complaints.push(item);}
          });
        }
      }catch(error){if(this.current(epoch,version)){this.state.recordsError='申诉记录暂时加载失败，请刷新后再操作。';}}
    }catch(error){if(this.current(epoch,version)){this.state.error=(error as Error).message||'订单评价暂时打不开';}}
    finally {if(this.current(epoch,version)){this.state.loading=false;this.publish();}}
  }
  private ledgerKey(mode: string,targetId: number): string { return `${this.state.userId}:${this.state.order?.orderId}:${mode}:${targetId}`; }
  open(mode: string, targetId: number): void {
    if(!this.identity()||this.state.form.busy||this.state.loading){return;}
    this.generation++;const form=new EngagementForm();form.mode=mode;form.targetId=targetId;this.state.form=form;this.state.message='';
    if(this.pending.has(this.ledgerKey(mode,targetId))){form.uncertain=true;form.error='上次提交结果待核实，请先刷新核实，勿重复提交。';}
    this.publish();
  }
  setContent(value: string): void {if(this.identity()&&!this.state.form.busy){this.state.form.content=value.slice(0,EngagementPolicy.maxLength(this.state.form.mode,this.state.form.reason));this.state.form.error='';this.publish();}}
  setRating(value: number): void {if(this.identity()&&!this.state.form.busy){this.state.form.rating=value;this.publish();}}
  setReason(value: string): void {if(this.identity()&&!this.state.form.busy){this.state.form.reason=value;this.publish();}}
  requestClose(): boolean {
    if((this.state.form.content.trim().length>0||this.state.form.rating!==5||this.state.form.reason!=='评价内容不实')&&!this.state.form.busy){this.state.form.discardPrompt=true;this.publish();return false;}
    this.confirmDiscard();return true;
  }
  cancelDiscard(): void {this.state.form.discardPrompt=false;this.publish();}
  confirmDiscard(): void {
    const reading=this.state.loading;
    this.generation++;this.api.cancelEngagementRequests(this.keys.slice());this.keys=[];
    this.state.loading=false;
    if(reading){this.state.order=undefined;this.state.reviews=[];this.state.complaints=[];this.state.disputes=[];this.state.error='已停止读取，请刷新后继续。';}
    this.state.form=new EngagementForm();this.publish();
  }
  private permitted(mode: string,targetId: number): boolean {
    const order=this.state.order,actor=this.state.userId;if(order===undefined||this.state.error.length>0||this.state.recordsError.length>0){return false;}
    if(mode==='review'){return targetId===order.orderId&&EngagementPolicy.canReview(order,actor,this.state.reviews);}
    const review=this.state.reviews.find((r: ReviewSummary)=>r.reviewId===targetId);
    if(mode==='followup'){return review!==undefined&&review.reviewerId===actor&&review.isVisible!==false;}
    if(mode==='complaint'){return review!==undefined&&review.targetUserId===actor&&review.isVisible!==false&&
      !this.state.complaints.some((r: ReviewComplaintSummary)=>r.reviewId===targetId&&r.status==='PENDING');}
    if(mode==='dispute'){return targetId===order.orderId&&EngagementPolicy.canDispute(order,this.state.disputes);}
    if(mode==='reply'){return this.state.disputes.some((r: DisputeSummary)=>r.id===targetId&&EngagementPolicy.canReply(r,actor));}
    return false;
  }
  async submit(): Promise<void> {
    if(!this.identity()||this.state.form.busy||this.state.loading){return;}
    const form=this.state.form,key=this.ledgerKey(form.mode,form.targetId);
    if(this.pending.has(key)){form.uncertain=true;form.error='提交结果待核实，请先核实，勿重复提交。';this.publish();return;}
    form.error=EngagementPolicy.validate(form.mode,form.rating,form.content,form.reason);
    if(!this.permitted(form.mode,form.targetId)){form.error='当前账号或对象状态不允许此操作，请刷新核实。';}
    if(form.error.length>0){this.publish();return;}
    const epoch=++this.generation,version=this.session.getSessionVersion();
    const command=new Submission(this.requestKey(`write.${epoch}`),form,this.state.order!.orderId,this.state.userId);
    const previous=this.state.reviews.find((r:ReviewSummary)=>r.reviewId===form.targetId);
    command.baselineRevision=JSON.stringify([previous?.replyContent??'',previous?.replyTime??'']);
    command.baselineIds=form.mode==='complaint'?this.state.complaints.map((r:ReviewComplaintSummary)=>r.complaintId):
      form.mode==='reply'?(this.state.disputes.find((r:DisputeSummary)=>r.id===form.targetId)?.replies??[]).map((r:DisputeReplySummary)=>r.id):this.state.disputes.map((r:DisputeSummary)=>r.id);
    this.pending.set(key,command);form.busy=true;this.publish();
    try {
      await this.send(command);if(this.pending.get(key)===command){this.pending.delete(key);}
      if(!this.current(epoch,version)){return;}
      this.state.form=new EngagementForm();this.state.message=command.mode==='review'?'评价已提交':command.mode==='followup'?'追评已提交':command.mode==='complaint'?'评价申诉已提交':command.mode==='dispute'?'订单申诉已提交':'申诉回复已提交';
      this.publish();await this.load(command.orderId);
    }catch(error){
      const mapped=error as FormFailure;
      const rejected=(mapped.httpStatus??0)>=400&&(mapped.httpStatus??0)<500||mapped.kind==='business'&&(mapped.businessCode??0)>=40000&&(mapped.businessCode??0)<50000;
      if(rejected&&this.pending.get(key)===command){this.pending.delete(key);}
      if(!this.current(epoch,version)){return;}
      form.uncertain=!rejected;form.error=rejected?(mapped.message||'提交未被接受，请核对内容。'):'结果未确认，服务器可能已写入。请先核实，勿重复提交。';
    }finally {if(this.current(epoch,version)){this.state.form.busy=false;this.publish();}}
  }
  private async send(c: Submission): Promise<void> {
    if(c.mode==='review'||c.mode==='followup'){
      const r=c.mode==='review'?await this.api.createReview(c.targetId,{rating:c.rating,content:c.content},c.key):
        await this.api.followUpReview(c.targetId,{content:c.content},c.key);
      if(!r||!Number.isSafeInteger(r.reviewId)||r.reviewId<=0||r.orderId!==c.orderId||r.reviewerId!==c.actorId||
        (c.mode==='review'&&(r.content!==c.content||r.rating!==c.rating))||
        (c.mode==='followup'&&(r.reviewId!==c.targetId||r.replyContent!==c.content))){throw new Error('评价响应异常');}
    }else if(c.mode==='complaint'){
      const r=await this.api.createReviewComplaint(c.targetId,{reason:`${c.reason}：${c.content}`,evidenceFileIds:''},c.key);
      if(!r||!Number.isSafeInteger(r.complaintId)||r.complaintId<=0||r.reviewId!==c.targetId||r.orderId!==c.orderId||r.complainantId!==c.actorId){throw new Error('申诉响应异常');}
    }else {
      const r=c.mode==='dispute'?await this.api.createDispute(c.targetId,{reason:c.content},c.key):await this.api.replyDispute(c.targetId,{content:c.content},c.key);
      if(!r||!Number.isSafeInteger(r.id)||r.id<=0||r.orderId!==c.orderId||(c.mode==='dispute'&&r.initiatorId!==c.actorId)||
        (c.mode==='reply'&&(r.id!==c.targetId||!r.replies?.some((reply: DisputeReplySummary)=>reply.replierId===c.actorId&&reply.content===c.content)))){throw new Error('订单申诉响应异常');}
    }
  }
  async verify(): Promise<void> {
    if(!this.identity()||this.state.form.busy||this.state.loading){return;}
    const key=this.ledgerKey(this.state.form.mode,this.state.form.targetId),c=this.pending.get(key);if(c===undefined){return;}
    const form=this.state.form;
    await this.load(c.orderId);if(!this.identity()||this.state.error||this.state.recordsError||this.state.form!==form||this.pending.get(key)!==c){return;}
    const found=c.mode==='review'?this.state.reviews.some((r: ReviewSummary)=>r.reviewerId===c.actorId&&r.content===c.content&&r.rating===c.rating):
      c.mode==='followup'?this.state.reviews.some((r: ReviewSummary)=>r.reviewId===c.targetId&&r.reviewerId===c.actorId&&r.replyContent===c.content&&JSON.stringify([r.replyContent??'',r.replyTime??''])!==c.baselineRevision):
      c.mode==='complaint'?this.state.complaints.some((r: ReviewComplaintSummary)=>!c.baselineIds.includes(r.complaintId)&&r.reviewId===c.targetId&&r.complainantId===c.actorId&&r.reason===`${c.reason}：${c.content}`):
      c.mode==='dispute'?this.state.disputes.some((r: DisputeSummary)=>!c.baselineIds.includes(r.id)&&r.initiatorId===c.actorId&&r.reason===c.content):
      this.state.disputes.some((r: DisputeSummary)=>r.id===c.targetId&&r.replies?.some((reply: DisputeReplySummary)=>!c.baselineIds.includes(reply.id)&&reply.replierId===c.actorId&&reply.content===c.content));
    if(found){this.pending.delete(key);this.state.form=new EngagementForm();this.state.message='已重新读取并核实记录，请核对时间与内容。';}
    else {this.state.form.uncertain=true;this.state.form.error='暂未查到本次记录，不能据此判断未写入，请稍后核实或联系平台，勿重复提交。';}
    this.publish();
  }
}
interface FormFailure { httpStatus?: number; kind?: string; businessCode?: number; message?: string; }
