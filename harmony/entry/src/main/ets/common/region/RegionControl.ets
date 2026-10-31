import { RegionSelectionGuard } from './RegionSelectionGuard';
import { common } from '@kit.AbilityKit';
import { AppClient } from '../../app/AppClient';
import { LocationFailure, ProvinceLocation } from '../location/ProvinceLocation';
import { ProvinceCatalog, ProvinceOption } from './ProvinceCatalog';
import { PortraTheme } from '../../theme/PortraTheme';

/** Shared UI for explicit location and an always-available, real province picker. */
@Component
export struct RegionControl {
  @Prop value: string = '';
  @Prop allowAll: boolean = false;
  @Prop compact: boolean = false;
  onChange?: (code: string) => void;
  @State private pickerOpen: boolean = false;
  @State private locating: boolean = false;
  @State private sharedBusy: boolean = false;
  @State private consentOpen: boolean = false;
  @State private error: string = '';
  @State private settingsRequired: boolean = false;
  @State private located: string = '尚未定位';
  private awaitingResume: boolean = false;
  private resumeIdentity: number = -1;
  private alive: boolean = false;
  private readonly requests: RegionSelectionGuard = new RegionSelectionGuard();
  private readonly changed: () => void = () => {
    if (!this.alive) { return; }
    this.sharedBusy = ProvinceLocation.isLocating();
    if (!this.routeVisible()) { this.awaitingResume = false; }
    this.located = ProvinceLocation.cached(this.getUIContext().getHostContext() as common.UIAbilityContext)?.label() ?? '尚未定位';
    const state = ProvinceLocation.diagnostics();
    if (state.phase === 'complete') {
      this.error = '';
      if (this.awaitingResume && this.resumeIdentity === AppClient.shared.sessionManager.getSessionVersion() && this.routeVisible()) {
        this.awaitingResume = false;
        const region = ProvinceLocation.cached(this.getUIContext().getHostContext() as common.UIAbilityContext);
        if (region) { this.onChange?.(region.code); }
      }
    }
  };
  aboutToAppear(): void { this.alive = true; this.requests.appear(); ProvinceLocation.observe(this.changed); this.changed(); }
  aboutToDisappear(): void { this.alive = false; this.awaitingResume = false; this.requests.leave(); ProvinceLocation.unobserve(this.changed); }
  private routeVisible(): boolean {
    try {
      const navigation = this.queryNavigationInfo(); const destination = this.queryNavDestinationInfo();
      if (navigation === undefined) { return false; }
      return destination === undefined ? navigation.pathStack.size() === 0 : destination.index === navigation.pathStack.size() - 1;
    } catch (_) { return false; }
  }
  private confirm(): void {
    if (this.locating || this.sharedBusy || this.consentOpen) { return; }
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
    if (ProvinceLocation.authorized(context)) { this.locate(); return; }
    this.consentOpen = true;
    const generation = this.requests.generation;
    AlertDialog.show({ title: '定位省级地区',
      message: '将检查手机位置服务、申请前台大致位置，并使用系统服务解析省级地区。Portra 不上传或保存精确坐标，不写入公开个人资料。你也可以手动选择。',
      cancel: () => { this.consentOpen = false; },
      primaryButton: { value: '不同意定位', action: () => { this.consentOpen = false; } },
      secondaryButton: { value: '同意并定位', action: () => { this.consentOpen = false; if (this.alive && generation === this.requests.generation) { this.locate(); } } } });
  }
  private async locate(settings: boolean = false): Promise<void> {
    if (this.locating) { return; }
    const identity = AppClient.shared.sessionManager.getSessionVersion();
    const generation = this.requests.begin(identity);
    this.locating = true; this.error = ''; this.settingsRequired = false;
    try {
      const context = this.getUIContext().getHostContext() as common.UIAbilityContext;
      if (settings) { await ProvinceLocation.authorizeOnSettings(context); }
      const region = await ProvinceLocation.locate(context);
      if (!this.requests.accepts(generation, AppClient.shared.sessionManager.getSessionVersion(), this.routeVisible())) { return; }
      this.located = region.label(); this.onChange?.(region.code);
    } catch (error) {
      if (this.requests.accepts(generation, AppClient.shared.sessionManager.getSessionVersion(), this.routeVisible())) {
        const failure = error as LocationFailure;
        this.error = failure instanceof LocationFailure ? failure.message : '定位暂不可用，请重试或手动选择地区';
        this.settingsRequired = failure instanceof LocationFailure && failure.permissionSettingsRequired;
        this.awaitingResume = failure instanceof LocationFailure && (failure.kind === 'switch-off' || this.settingsRequired);
        this.resumeIdentity = identity;
      }
    } finally { if (this.alive && generation === this.requests.generation) { this.locating = false; } }
  }
  @Builder
  private Picker() {
    Column({ space: 8 }) {
      Text('选择省级地区').fontSize(18).fontWeight(FontWeight.Bold).margin({ top: 18 })
      if (this.compact) {
        Button(this.locating || this.sharedBusy ? '定位中…' : '自动定位当前地区')
          .width('100%').height(40).fontSize(13).fontColor(PortraTheme.primary)
          .backgroundColor(PortraTheme.primarySoft).enabled(!this.locating && !this.sharedBusy && !this.consentOpen)
          .onClick(() => { this.pickerOpen = false; this.confirm(); })
        Text('或手动选择地区').width('100%').fontSize(12).fontColor(PortraTheme.secondaryText)
      }
      Scroll() {
        Column() {
          if (this.allowAll) { Button('不限地区').width('100%').height(44).onClick(() => this.select('')) }
          ForEach(ProvinceCatalog.all, (p: ProvinceOption) => {
            Button(p.name).width('100%').height(44).fontSize(14)
              .fontColor(this.value === p.code ? PortraTheme.primary : PortraTheme.primaryText)
              .backgroundColor(this.value === p.code ? PortraTheme.primarySoft : Color.Transparent)
              .onClick(() => this.select(p.code))
          }, (p: ProvinceOption) => p.code)
        }.width('100%')
      }.layoutWeight(1).width('100%')
    }.width('100%').height('100%').padding(16)
  }
  private cancelPicker(): void {
    this.pickerOpen = false;
  }
  private select(code: string): void {
    this.awaitingResume = false; this.requests.generation++; this.locating = false; this.error = ''; this.pickerOpen = false;
    this.onChange?.(code);
  }
  private selectionLabel(): string {
    if (this.value) { return ProvinceCatalog.display(this.value); }
    return this.located;
  }
  build() {
    Column({ space: this.compact ? 0 : 6 }) {
      if (this.compact) {
        Row({ space: 8 }) {
          Button(`⌖ ${this.selectionLabel()} ⌄`).height(30).padding({ left: 12, right: 12 }).fontSize(11)
            .constraintSize({ maxWidth: 150 }).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
            .accessibilityText(`当前地区：${this.selectionLabel()}，点击选择地区`)
            .onClick(() => this.pickerOpen = true)
          Button(this.locating || this.sharedBusy ? '定位中…' : '↻ 重新定位').height(30)
            .padding({ left: 12, right: 12 }).fontSize(11).fontColor(PortraTheme.primary)
            .backgroundColor(Color.Transparent).enabled(!this.locating && !this.sharedBusy && !this.consentOpen)
            .onClick(() => this.confirm())
        }.width('100%').justifyContent(FlexAlign.Start)
      } else {
        Row({ space: 8 }) {
          Button(this.value ? ProvinceCatalog.display(this.value) : this.allowAll ? '不限地区' : '选择省级地区')
            .layoutWeight(1).height(40).fontSize(13).fontColor(PortraTheme.primary).backgroundColor(PortraTheme.primarySoft)
            .onClick(() => this.pickerOpen = true)
          Button(this.locating || this.sharedBusy ? '定位中…' : '定位当前地区').height(40).fontSize(12)
            .enabled(!this.locating && !this.sharedBusy && !this.consentOpen).onClick(() => this.confirm())
        }.width('100%')
        Text(`设备地区：${this.located}`).fontSize(11).fontColor(PortraTheme.secondaryText).width('100%')
      }
      if (this.error) {
        Text(this.error).fontSize(12).fontColor(PortraTheme.danger).width('100%')
        Row({ space: 8 }) {
          Button('手动选择').fontSize(12).onClick(() => this.pickerOpen = true)
          if (this.settingsRequired) { Button('权限设置').enabled(!this.locating && !this.sharedBusy).fontSize(12).onClick(() => this.locate(true)) }
          Button('重试定位').enabled(!this.locating && !this.sharedBusy).fontSize(12).onClick(() => this.locate())
        }
      }
    }.width('100%').bindSheet(this.pickerOpen, this.Picker(), { height: SheetSize.LARGE, showClose: true,
      onDisappear: () => this.cancelPicker() })
  }
}
