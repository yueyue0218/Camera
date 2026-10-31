import { geoLocationManager } from '@kit.LocationKit';
import { abilityAccessCtrl, common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { AppClient } from '../../app/AppClient';
import { ProvinceCatalog } from '../region/ProvinceCatalog';
import { UiPerf } from '../performance/UiPerf';

export class LocatedRegion {
  readonly code: string;
  readonly province: string;
  constructor(value: string) { this.code = ProvinceCatalog.requireCode(value); this.province = ProvinceCatalog.normalize(value); }
  label(): string { return this.province; }
}
export class LocationDiagnostic {
  phase: string = 'idle';
  switchState: string = 'unknown';
  permissionState: string = 'not-checked';
  authResults: number[] = [];
  dialogShownResults: boolean[] = [];
  permissionErrorReasons: number[] = [];
  coordinatesState: string = 'not-requested';
  geocoderState: string = 'not-requested';
  systemErrorCode: number = 0;
  failureKind: string = '';
}
export class LocationFailure extends Error {
  readonly kind: string;
  readonly phase: string;
  readonly systemErrorCode: number;
  readonly permissionSettingsRequired: boolean;
  constructor(kind: string, message: string, phase: string, code: number = 0, settings: boolean = false) {
    super(message); this.kind = kind; this.phase = phase; this.systemErrorCode = code; this.permissionSettingsRequired = settings;
  }
}

/** One foreground service. Coordinates exist only in the request stack, never in state/logs. */
export class ProvinceLocation {
  private static region: LocatedRegion | undefined = undefined;
  private static expires: number = 0;
  private static cacheIdentity: number = -1;
  private static generation: number = 0;
  private static pending: Promise<LocatedRegion> | undefined = undefined;
  private static passiveAfter: number = 0;
  private static resumeRequested: boolean = false;
  private static evidence: LocationDiagnostic = new LocationDiagnostic();
  private static listeners: Set<() => void> = new Set<() => void>();
  private static manager: abilityAccessCtrl.AtManager | undefined = undefined;
  private static readonly permissionChanged: (info: abilityAccessCtrl.PermissionStateChangeInfo) => void =
    (info: abilityAccessCtrl.PermissionStateChangeInfo) => {
      if (info.change === abilityAccessCtrl.PermissionStateChangeType.PERMISSION_REVOKED_OPER) { ProvinceLocation.clear(); }
    };
  static observe(listener: () => void): void { ProvinceLocation.listeners.add(listener); }
  static unobserve(listener: () => void): void { ProvinceLocation.listeners.delete(listener); }
  private static notify(): void {
    Array.from(ProvinceLocation.listeners).forEach((listener: () => void) => {
      try { listener(); } catch (_) { UiPerf.mark('location.observer.failed'); }
    });
  }
  static bind(): void {
    if (ProvinceLocation.manager !== undefined) { return; }
    const manager = abilityAccessCtrl.createAtManager();
    try {
      manager.on('selfPermissionStateChange', ['ohos.permission.APPROXIMATELY_LOCATION'], ProvinceLocation.permissionChanged);
      ProvinceLocation.manager = manager;
    } catch (_) { UiPerf.mark('location.permission.observer.unavailable'); }
    AppClient.shared.observePrivacyAccess(ProvinceLocation.privacyChanged);
  }
  private static readonly privacyChanged: () => void = () => {
    if (!AppClient.shared.canUseBusinessNetwork()) { ProvinceLocation.clear(); }
  };
  static isLocating(): boolean { return ProvinceLocation.pending !== undefined; }
  static diagnostics(): LocationDiagnostic {
    const value = new LocationDiagnostic(); const source = ProvinceLocation.evidence;
    value.phase = source.phase; value.switchState = source.switchState; value.permissionState = source.permissionState;
    value.authResults = source.authResults.slice(); value.dialogShownResults = source.dialogShownResults.slice();
    value.permissionErrorReasons = source.permissionErrorReasons.slice(); value.coordinatesState = source.coordinatesState;
    value.geocoderState = source.geocoderState; value.systemErrorCode = source.systemErrorCode; value.failureKind = source.failureKind;
    return value;
  }
  static clear(): void {
    ProvinceLocation.generation++; ProvinceLocation.region = undefined; ProvinceLocation.expires = 0;
    ProvinceLocation.cacheIdentity = -1; ProvinceLocation.passiveAfter = 0; ProvinceLocation.resumeRequested = false;
    ProvinceLocation.notify();
  }
  static authorized(context: common.UIAbilityContext): boolean {
    let allowed = false;
    try {
      allowed = AppClient.shared.hasRequiredPrivacyConsent() && AppClient.shared.canUseBusinessNetwork() &&
        abilityAccessCtrl.createAtManager().checkAccessTokenSync(context.applicationInfo.accessTokenId,
          'ohos.permission.APPROXIMATELY_LOCATION') === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
    } catch (error) {
      allowed = false; ProvinceLocation.evidence.permissionState = 'unknown';
      ProvinceLocation.recordFailure(error, 'permission');
    }
    if (!allowed && ProvinceLocation.region !== undefined) { ProvinceLocation.clear(); }
    return allowed;
  }
  static cached(context: common.UIAbilityContext): LocatedRegion | undefined {
    if (!ProvinceLocation.authorized(context)) { return undefined; }
    if (ProvinceLocation.region !== undefined && (Date.now() >= ProvinceLocation.expires ||
      ProvinceLocation.cacheIdentity !== AppClient.shared.sessionManager.getSessionVersion())) { ProvinceLocation.clear(); }
    return ProvinceLocation.region;
  }
  static onBackground(): void {
    // Any permission revocation/regrant while away must not resurrect the old cache.
    // Preserve an active system permission/position request; its callback rechecks authorization.
    const resume = ProvinceLocation.resumeRequested;
    if (ProvinceLocation.pending === undefined) { ProvinceLocation.clear(); }
    ProvinceLocation.resumeRequested = resume;
  }
  static async onForeground(context: common.UIAbilityContext): Promise<void> {
    if (!AppClient.shared.canUseBusinessNetwork()) { ProvinceLocation.clear(); return; }
    if (ProvinceLocation.pending !== undefined) { return; }
    try { ProvinceLocation.checkSwitch(); } catch (error) { ProvinceLocation.recordFailure(error, 'switch'); ProvinceLocation.notify(); return; }
    if (!ProvinceLocation.authorized(context)) { ProvinceLocation.notify(); return; }
    const resume = ProvinceLocation.resumeRequested;
    ProvinceLocation.resumeRequested = false;
    if (resume) { try { await ProvinceLocation.locate(context, false); } catch (_) { ProvinceLocation.notify(); } }
    else { await ProvinceLocation.refreshAuthorized(context); }
  }
  static async refreshAuthorized(context: common.UIAbilityContext): Promise<void> {
    if (!ProvinceLocation.authorized(context) || ProvinceLocation.cached(context) || Date.now() < ProvinceLocation.passiveAfter) { return; }
    ProvinceLocation.passiveAfter = Date.now() + 60000;
    try { await ProvinceLocation.locate(context, false); } catch (_) { /* Passive entry does not prompt. */ }
  }
  static async locate(context: common.UIAbilityContext, requestPermission: boolean = true): Promise<LocatedRegion> {
    if (!AppClient.shared.hasRequiredPrivacyConsent() || !AppClient.shared.canUseBusinessNetwork()) {
      throw new LocationFailure('privacy', '请先完成隐私与中国香港个人信息出境授权，或手动选择地区', 'privacy');
    }
    if (ProvinceLocation.pending !== undefined) { return ProvinceLocation.pending; }
    ProvinceLocation.cached(context);
    const identity = AppClient.shared.sessionManager.getSessionVersion();
    const generation = ProvinceLocation.generation;
    const request = ProvinceLocation.request(context, requestPermission, generation, identity);
    ProvinceLocation.pending = request; ProvinceLocation.notify();
    try { return await request; } finally { if (ProvinceLocation.pending === request) { ProvinceLocation.pending = undefined; ProvinceLocation.notify(); } }
  }
  static async authorizeOnSettings(context: common.UIAbilityContext): Promise<void> {
    if (!AppClient.shared.canUseBusinessNetwork()) { throw new LocationFailure('privacy', '请先完成隐私授权', 'privacy'); }
    ProvinceLocation.resumeRequested = true;
    try {
      const result = await abilityAccessCtrl.createAtManager().requestPermissionOnSetting(context, ['ohos.permission.APPROXIMATELY_LOCATION']);
      ProvinceLocation.evidence.authResults = result.slice();
      if (!ProvinceLocation.authorized(context)) { throw new LocationFailure('permission-denied', '未授权大致位置，可手动选择地区', 'permission', 0, true); }
    } catch (error) { throw ProvinceLocation.recordFailure(error, 'permission'); }
  }
  private static checkSwitch(): void {
    ProvinceLocation.evidence.phase = 'switch'; ProvinceLocation.evidence.switchState = 'unknown'; UiPerf.mark('location.switch.unknown');
    const enabled = geoLocationManager.isLocationEnabled();
    if (enabled !== true && enabled !== false) { throw new LocationFailure('service-unavailable', '无法读取系统位置状态，请重试或手动选择地区', 'switch'); }
    ProvinceLocation.evidence.switchState = enabled ? 'on' : 'off'; UiPerf.mark(`location.switch.${enabled ? 'on' : 'off'}`);
    if (enabled === false) {
      ProvinceLocation.resumeRequested = true;
      throw new LocationFailure('switch-off', '系统位置服务已关闭，请在系统设置中开启，或手动选择地区', 'switch');
    }
  }
  private static ensureCurrent(context: common.UIAbilityContext, generation: number, identity: number): void {
    if (!AppClient.shared.canUseBusinessNetwork()) {
      throw new LocationFailure('privacy', '隐私同意已失效，可手动选择地区', 'privacy');
    }
    const granted = abilityAccessCtrl.createAtManager().checkAccessTokenSync(context.applicationInfo.accessTokenId,
      'ohos.permission.APPROXIMATELY_LOCATION') === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
    if (!granted) { ProvinceLocation.clear(); throw new LocationFailure('permission-denied', '定位授权已失效，可手动选择地区', 'permission'); }
    if (generation !== ProvinceLocation.generation || identity !== AppClient.shared.sessionManager.getSessionVersion()) {
      throw new LocationFailure('stale', '账号或授权状态已变化，请重新定位', 'stale');
    }
  }
  private static async request(context: common.UIAbilityContext, prompt: boolean, generation: number, identity: number): Promise<LocatedRegion> {
    ProvinceLocation.evidence = new LocationDiagnostic(); let phase = 'switch';
    try {
      ProvinceLocation.checkSwitch(); phase = 'permission'; ProvinceLocation.evidence.phase = phase;
      const alreadyGranted = abilityAccessCtrl.createAtManager().checkAccessTokenSync(context.applicationInfo.accessTokenId,
        'ohos.permission.APPROXIMATELY_LOCATION') === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
      if (!alreadyGranted) {
        ProvinceLocation.evidence.permissionState = 'not-granted';
        if (!prompt) { throw new LocationFailure('permission-denied', '未授权大致位置，可手动选择地区', phase); }
        const result = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(context, ['ohos.permission.APPROXIMATELY_LOCATION']);
        ProvinceLocation.evidence.authResults = result.authResults.slice();
        ProvinceLocation.evidence.dialogShownResults = result.dialogShownResults?.slice() ?? [];
        ProvinceLocation.evidence.permissionErrorReasons = result.errorReasons?.slice() ?? [];
        UiPerf.mark(`location.permission.result.${result.authResults.join('.')}`);
        UiPerf.mark(`location.permission.dialog.${(result.dialogShownResults ?? []).join('.')}`);
        UiPerf.mark(`location.permission.reason.${(result.errorReasons ?? []).join('.')}`);
        if (result.authResults.length !== 1 || result.authResults[0] !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
          ProvinceLocation.evidence.permissionState = 'denied';
          const settings = result.authResults[0] === -1 && result.dialogShownResults?.[0] === false;
          throw new LocationFailure('permission-denied', result.authResults[0] === 2 ? '系统未受理授权请求，请重试或手动选择地区' :
            '未授权大致位置，可在权限设置中允许，或手动选择地区', phase, 0, settings);
        }
      }
      ProvinceLocation.ensureCurrent(context, generation, identity);
      ProvinceLocation.evidence.permissionState = 'granted'; UiPerf.mark('location.permission.granted');
      phase = 'switch'; ProvinceLocation.checkSwitch();
      const cached = ProvinceLocation.cached(context);
      if (cached) { ProvinceLocation.evidence.phase = 'cache'; return cached; }
      phase = 'coordinates'; ProvinceLocation.evidence.phase = phase; ProvinceLocation.evidence.coordinatesState = 'pending';
      UiPerf.mark('location.coordinates.start');
      const position = await geoLocationManager.getCurrentLocation({ priority: geoLocationManager.LocationRequestPriority.FIRST_FIX, timeoutMs: 10000 });
      ProvinceLocation.ensureCurrent(context, generation, identity);
      if (position === null || position === undefined || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude) || Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180) {
        throw new LocationFailure('position-unavailable', '系统返回的位置无效，请重试或手动选择地区', phase);
      }
      ProvinceLocation.evidence.coordinatesState = 'valid'; UiPerf.mark('location.coordinates.valid');
      phase = 'geocoder'; ProvinceLocation.evidence.phase = phase;
      if (!geoLocationManager.isGeocoderAvailable()) {
        ProvinceLocation.evidence.geocoderState = 'unsupported';
        throw new LocationFailure('geocoder-unsupported', '已取得位置，此设备不支持地区解析，请手动选择省级地区', phase);
      }
      ProvinceLocation.evidence.geocoderState = 'pending'; UiPerf.mark('location.geocoder.start');
      const addresses = await geoLocationManager.getAddressesFromLocation({ latitude: position.latitude, longitude: position.longitude, maxItems: 1, locale: 'zh-CN' });
      ProvinceLocation.ensureCurrent(context, generation, identity);
      ProvinceLocation.evidence.geocoderState = 'resolved'; UiPerf.mark('location.geocoder.resolved'); phase = 'normalize'; ProvinceLocation.evidence.phase = phase;
      if (addresses.length === 0) { throw new LocationFailure('region-invalid', '未解析到省级地区，请手动选择', phase); }
      const address = addresses[0];
      const country = (address.countryCode ?? '').toUpperCase();
      if (country && !['CN', 'HK', 'MO', 'TW'].includes(country)) { throw new LocationFailure('region-invalid', '当前位置不在支持范围，请手动选择省级地区', phase); }
      const code = ProvinceCatalog.code(address.administrativeArea ?? '') || ProvinceCatalog.code(address.locality ?? '') ||
        (country === 'HK' || country === 'MO' || country === 'TW' ? country : '');
      if (!code) { throw new LocationFailure('region-invalid', '无法识别省级地区，请手动选择', phase); }
      ProvinceLocation.ensureCurrent(context, generation, identity);
      ProvinceLocation.region = new LocatedRegion(code); ProvinceLocation.expires = Date.now() + 600000; ProvinceLocation.cacheIdentity = identity;
      ProvinceLocation.resumeRequested = false; ProvinceLocation.evidence.phase = 'complete';
      ProvinceLocation.notify(); UiPerf.mark('location.region.published'); return ProvinceLocation.region;
    } catch (error) { throw ProvinceLocation.recordFailure(error, phase); }
  }
  private static recordFailure(error: Object, phase: string): LocationFailure {
    const code = (error as BusinessError).code;
    let failure = error as LocationFailure;
    if (!(failure instanceof LocationFailure)) {
      const number = typeof code === 'number' ? code : 0;
      if (number === 201) { failure = new LocationFailure('permission-denied', '定位权限校验失败，请检查权限设置或手动选择地区', phase, number, true); }
      else if (number === 3301100) { ProvinceLocation.evidence.switchState = 'off'; ProvinceLocation.resumeRequested = true;
        failure = new LocationFailure('switch-off', '系统位置服务已关闭，请开启后重试，或手动选择地区', phase, number); }
      else if (number === 801) { failure = new LocationFailure(phase === 'geocoder' ? 'geocoder-unsupported' : 'unsupported',
        phase === 'geocoder' ? '已取得位置，此设备不支持地区解析，请手动选择' : '此设备不支持当前定位接口，请手动选择省级地区', phase, number); }
      else if (number === 3301000) { failure = new LocationFailure('service-unavailable', '系统位置服务暂不可用，请稍后重试或手动选择地区', phase, number); }
      else if (number === 3301200) { failure = new LocationFailure('position-unavailable', '未取得位置或请求超时，请检查网络和信号后重试，或手动选择地区', phase, number); }
      else if (number === 3301300 || phase === 'geocoder') { failure = new LocationFailure('geocoder-failed', '已取得位置，但地区解析失败，请检查网络后重试或手动选择', phase, number); }
      else { failure = new LocationFailure('service-unavailable', '定位暂不可用，请重试或手动选择地区', phase, number); }
    }
    ProvinceLocation.evidence.phase = failure.phase; ProvinceLocation.evidence.systemErrorCode = failure.systemErrorCode;
    ProvinceLocation.evidence.failureKind = failure.kind;
    if (phase === 'coordinates' && ProvinceLocation.evidence.coordinatesState !== 'valid') { ProvinceLocation.evidence.coordinatesState = 'failed'; }
    if (phase === 'geocoder') { ProvinceLocation.evidence.geocoderState = failure.kind === 'geocoder-unsupported' ? 'unsupported' : 'failed'; }
    UiPerf.mark(`location.${failure.phase}.failed.${failure.systemErrorCode}`);
    UiPerf.mark(`location.failure.${failure.kind}.code.${failure.systemErrorCode}`);
    return failure;
  }
}
