import { AppClient } from '../../app/AppClient';
import { ContentChanges } from '../user/ContentChanges';
import { JournalStyle } from './JournalUI';

/** Detail management only. All mutations reuse the existing authenticated API. */
@Component
export struct PublicationActions {
  @Prop @Watch('invalidate') service: boolean = false;
  @Prop @Watch('invalidate') contentId: number = 0;
  @Prop @Watch('invalidate') ownerId: number = 0;
  @Prop @Watch('invalidate') currentUserId: number = 0;
  @Prop role: string = '';
  @Prop status: string = '';
  @State private busy: boolean = false;
  @State private error: string = '';
  private generation: number = 0;
  private active: boolean = true;
  private readonly app: AppClient = AppClient.shared;
  onEdit?: (id: number) => void;
  onChanged?: () => void;

  aboutToAppear(): void { this.active = true; }
  aboutToDisappear(): void { this.active = false; this.generation++; }
  private invalidate(): void { this.generation++; this.busy = false; this.error = ''; }
  private owned(): boolean {
    return this.app.sessionManager.isAuthenticated() && this.currentUserId > 0 &&
      this.ownerId === this.currentUserId && this.contentId > 0 &&
      this.role.trim().toUpperCase() === (this.service ? 'PROVIDER' : 'CUSTOMER');
  }
  private confirmOffline(): void {
    if (!this.owned() || this.busy || this.status !== (this.service ? 'ONLINE' : 'OPEN')) { return; }
    const id = this.contentId, owner = this.ownerId, service = this.service;
    const epoch = this.app.sessionManager.getSessionVersion();
    AlertDialog.show({ title: this.service ? '下架橱窗？' : '下架需求？',
      message: '下架后不再公开展示，已有响应、会话和订单不会被删除。',
      backgroundColor: JournalStyle.paper, cornerRadius: 18,
      primaryButton: { value: '取消', action: () => {} },
      secondaryButton: { value: '确认下架', action: () => {
        if (this.active && id === this.contentId && owner === this.ownerId && service === this.service && epoch === this.app.sessionManager.getSessionVersion()) {
          this.manage(false);
        }
      } } });
  }
  private async manage(edit: boolean): Promise<void> {
    if (!this.active || !this.owned() || this.busy || (!this.service && this.status !== 'OPEN') ||
      (!edit && this.status !== (this.service ? 'ONLINE' : 'OPEN'))) { return; }
    this.busy = true; this.error = '';
    const token = ++this.generation, epoch = this.app.sessionManager.getSessionVersion();
    const id = this.contentId, owner = this.ownerId, service = this.service;
    try {
      const session = await this.app.apiService.currentSession(`publication.${service}.${id}.${token}`);
      if (!this.active || token !== this.generation || epoch !== this.app.sessionManager.getSessionVersion() || id !== this.contentId || owner !== this.ownerId || service !== this.service) { return; }
      if (session.userId !== owner || session.role.trim().toUpperCase() !== (service ? 'PROVIDER' : 'CUSTOMER')) { throw new Error('当前身份不能管理此内容'); }
      if (edit) { this.onEdit?.(id); return; }
      if (service) {
        const result = await this.app.apiService.offlineService(id);
        if (result.serviceId !== id || result.providerId !== owner || result.status !== 'OFFLINE' || result.isAvailable !== false) { throw new Error('下架结果未确认，请刷新核实'); }
      } else {
        // The legacy close endpoint lacks an order-state guard. Never intentionally close a matched demand.
        const current = await this.app.apiService.getDemand(id);
        if (!this.active || token !== this.generation || epoch !== this.app.sessionManager.getSessionVersion()) { return; }
        if (current.customerId !== owner || current.demandId !== id || current.status !== 'OPEN') { throw new Error('需求已进入其他状态，请刷新查看，不能在此下架'); }
        const result = await this.app.apiService.closeDemand(id);
        if (result.demandId !== id || result.customerId !== owner || result.status !== 'CLOSED') { throw new Error('下架结果未确认，请刷新核实'); }
      }
      ContentChanges.publish();
      if (this.active && token === this.generation && epoch === this.app.sessionManager.getSessionVersion() && id === this.contentId && owner === this.ownerId && service === this.service) { this.onChanged?.(); }
    } catch (error) {
      if (this.active && token === this.generation && epoch === this.app.sessionManager.getSessionVersion()) {
        this.error = (error as Error).message || '操作失败，请刷新核实，未自动重试';
      }
    } finally { if (token === this.generation) { this.busy = false; } }
  }
  build() {
    if (this.owned()) {
      Column({ space: 10 }) {
        Row({ space: 12 }) {
          Button(this.service ? '编辑橱窗' : '编辑需求').layoutWeight(1).height(44).fontSize(13)
            .fontColor(JournalStyle.blue).backgroundColor('#EEF0FC').borderRadius(12)
            .enabled(!this.busy && (this.service || this.status === 'OPEN')).onClick(() => this.manage(true))
          Button(this.busy ? '处理中…' : this.service ? '下架橱窗' : '下架需求').layoutWeight(1).height(44).fontSize(13)
            .fontColor('#716B66').backgroundColor('#F8F5F1').border({ width: 1, color: JournalStyle.line }).borderRadius(12)
            .enabled(!this.busy && this.status === (this.service ? 'ONLINE' : 'OPEN')).onClick(() => this.confirmOffline())
        }.width('100%')
        if (this.status !== (this.service ? 'ONLINE' : 'OPEN')) {
          Text(this.status === 'MATCHED' ? '需求已匹配，不能在此编辑或下架' : this.status === 'EXPIRED' ? '需求已过期' : '内容已下架')
            .fontSize(12).fontColor(JournalStyle.muted)
        }
        if (this.error) { Text(this.error).fontSize(12).fontColor('#A44532') }
      }.width('100%').padding({ top: 18, bottom: 12 })
    }
  }
}
