import { geoLocationManager } from '@kit.LocationKit';
import { abilityAccessCtrl, common } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { AppClient } from '../../app/AppClient';
import { ProvinceCatalog } from '../region/ProvinceCatalog';
import { UiPerf } from '../performance/UiPerf';

export class LocatedRegion {
  province: string;
  city: string;
  constructor(province: string, city: string = '') { this.province = province; this.city = city; }
  label(): string { return this.city && this.city !== this.province ? `${this.province} · ${this.city}` : this.province; }
}

/** Safe evidence: no coordinates, addresses, identity or tokens. */
export class LocationDiagnostic {
  phase: string = 'idle';
  switchState: string = 'not-checked';
  permissionState: string = 'not-checked';
  authResults: number[] = [];
  dialogShownResults: boolean[] = [];
  permissionErrorReasons: number[] = [];
  coordinatesState: string = 'not-requested';
  geocoderState: string = 'not-requested';
  systemErrorCode: number = 0;
}

export class LocationFailure extends Error {
  readonly phase: string;
  readonly systemErrorCode: number;
  readonly permissionSettingsRequired: boolean;
  constructor(message: string, phase: string, code: number = 0, settingsRequired: boolean = false) {
    super(message);
    this.phase = phase;
    this.systemErrorCode = code;
    this.permissionSettingsRequired = settingsRequired;
  }
}

/** Foreground approximate location; only province/city is cached for ten minutes. */
export class ProvinceLocation {
  private static region: LocatedRegion | undefined = undefined;
  private static expires: number = 0;
  private static pending: Promise<LocatedRegion> | undefined = undefined;
  private static passiveAfter: number = 0;
  private static evidence: LocationDiagnostic = new LocationDiagnostic();
  private static listeners: Set<() => void> = new Set<() => void>();
  static observe(listener: () => void): void { ProvinceLocation.listeners.add(listener); }
  static unobserve(listener: () => void): void { ProvinceLocation.listeners.delete(listener); }
  private static notify(): void { ProvinceLocation.listeners.forEach((listener: () => void) => listener()); }

  static diagnostics(): LocationDiagnostic {
    const source = ProvinceLocation.evidence;
    const snapshot = new LocationDiagnostic();
    snapshot.phase = source.phase; snapshot.switchState = source.switchState;
    snapshot.permissionState = source.permissionState;
    snapshot.authResults = source.authResults.slice();
    snapshot.dialogShownResults = source.dialogShownResults.slice();
    snapshot.permissionErrorReasons = source.permissionErrorReasons.slice();
    snapshot.coordinatesState = source.coordinatesState; snapshot.geocoderState = source.geocoderState;
    snapshot.systemErrorCode = source.systemErrorCode;
    return snapshot;
  }

  static authorized(context: common.UIAbilityContext): boolean {
    if (!AppClient.shared.hasRequiredPrivacyConsent() || !AppClient.shared.canUseBusinessNetwork()) { return false; }
    try {
      return abilityAccessCtrl.createAtManager().checkAccessTokenSync(context.applicationInfo.accessTokenId,
        'ohos.permission.APPROXIMATELY_LOCATION') === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
    } catch (_) { return false; }
  }
  static cached(context: common.UIAbilityContext): LocatedRegion | undefined {
    if (!ProvinceLocation.authorized(context) || Date.now() >= ProvinceLocation.expires) { return undefined; }
    return ProvinceLocation.region;
  }
  static async refreshAuthorized(context: common.UIAbilityContext): Promise<void> {
    if (!ProvinceLocation.authorized(context)) {
      ProvinceLocation.region = undefined; ProvinceLocation.expires = 0; ProvinceLocation.notify(); return;
    }
    if (ProvinceLocation.cached(context) || Date.now() < ProvinceLocation.passiveAfter) { return; }
    ProvinceLocation.passiveAfter = Date.now() + 60000;
    try { await ProvinceLocation.locate(context, false); } catch (_) { /* Passive entry never shows a prompt. */ }
  }
  static async locate(context: common.UIAbilityContext, requestPermission: boolean = true): Promise<LocatedRegion> {
    if (!AppClient.shared.hasRequiredPrivacyConsent() || !AppClient.shared.canUseBusinessNetwork()) {
      throw new LocationFailure('请先完成隐私与中国香港个人信息出境授权', 'privacy');
    }
    if (ProvinceLocation.pending !== undefined) { return ProvinceLocation.pending; }
    const request = ProvinceLocation.request(context, requestPermission);
    ProvinceLocation.pending = request;
    try { return await request; } finally { ProvinceLocation.pending = undefined; }
  }

  /** Invoked only after the user explicitly chooses the permission-settings guidance. */
  static async authorizeOnSettings(context: common.UIAbilityContext): Promise<void> {
    if (!AppClient.shared.hasRequiredPrivacyConsent() || !AppClient.shared.canUseBusinessNetwork()) {
      throw new LocationFailure('请先完成隐私与中国香港个人信息出境授权', 'privacy');
    }
    ProvinceLocation.checkSwitch();
    if (ProvinceLocation.authorized(context)) { return; }
    const result = await abilityAccessCtrl.createAtManager().requestPermissionOnSetting(context,
      ['ohos.permission.APPROXIMATELY_LOCATION']);
    ProvinceLocation.evidence.authResults = result.slice();
    UiPerf.mark(`location.permission.settings.result.${result.join('.')}`);
    if (result.length !== 1 || result[0] !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED ||
      !ProvinceLocation.authorized(context)) {
      ProvinceLocation.evidence.permissionState = 'denied';
      throw new LocationFailure('仍未授权定位，可继续手动选择地区', 'permission', 0, true);
    }
  }
  private static checkSwitch(): void {
    ProvinceLocation.evidence.phase = 'switch';
    const enabled = geoLocationManager.isLocationEnabled();
    ProvinceLocation.evidence.switchState = enabled ? 'on' : 'off';
    UiPerf.mark(`location.switch.${enabled ? 'on' : 'off'}`);
    if (!enabled) { throw new LocationFailure('系统位置服务已关闭，请在系统设置中开启位置服务，或手动选择地区', 'switch'); }
  }
  private static ensureAuthorized(context: common.UIAbilityContext): void {
    if (!ProvinceLocation.authorized(context)) {
      ProvinceLocation.region = undefined; ProvinceLocation.expires = 0; ProvinceLocation.notify();
      throw new LocationFailure('定位授权或隐私同意已失效，请重新授权', 'permission');
    }
  }
  private static async request(context: common.UIAbilityContext, requestPermission: boolean): Promise<LocatedRegion> {
    ProvinceLocation.evidence = new LocationDiagnostic();
    let phase = 'switch';
    try {
      // The phone-wide switch and this application's permission are separate checks.
      ProvinceLocation.checkSwitch();
      phase = 'permission'; ProvinceLocation.evidence.phase = phase;
      if (!ProvinceLocation.authorized(context)) {
        ProvinceLocation.region = undefined; ProvinceLocation.expires = 0; ProvinceLocation.notify();
        ProvinceLocation.evidence.permissionState = 'not-granted';
        if (!requestPermission) { throw new LocationFailure('未授权定位', phase); }
        // SDK 26 getCurrentLocation requires APPROXIMATELY_LOCATION; precise/background access is unnecessary.
        const permission = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(context,
          ['ohos.permission.APPROXIMATELY_LOCATION']);
        ProvinceLocation.evidence.authResults = permission.authResults.slice();
        ProvinceLocation.evidence.dialogShownResults = permission.dialogShownResults?.slice() ?? [];
        ProvinceLocation.evidence.permissionErrorReasons = permission.errorReasons?.slice() ?? [];
        UiPerf.mark(`location.permission.result.${permission.authResults.join('.')}`);
        UiPerf.mark(`location.permission.dialog.${(permission.dialogShownResults ?? []).join('.')}`);
        UiPerf.mark(`location.permission.reason.${(permission.errorReasons ?? []).join('.')}`);
        if (permission.authResults.length !== 1 ||
          permission.authResults[0] !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
          ProvinceLocation.evidence.permissionState = 'denied'; UiPerf.mark('location.permission.denied');
          const settingsRequired = permission.authResults[0] === -1 && permission.dialogShownResults?.[0] === false;
          const invalid = permission.authResults[0] === 2;
          throw new LocationFailure(invalid ? '系统未受理定位授权，请稍后重试或手动选择地区' :
            (settingsRequired ? '系统不再弹出定位授权，可前往权限设置允许大致位置，或手动选择地区' :
              '未授权定位，可继续手动选择地区'), phase, 0, settingsRequired);
        }
      }
      ProvinceLocation.ensureAuthorized(context);
      ProvinceLocation.evidence.permissionState = 'granted'; UiPerf.mark('location.permission.granted');
      // A switch or consent may change while the permission dialog is visible.
      phase = 'switch'; ProvinceLocation.checkSwitch();
      const cached = ProvinceLocation.cached(context);
      if (cached) { ProvinceLocation.evidence.phase = 'cache'; UiPerf.mark('location.cache.hit'); return cached; }
      phase = 'coordinates'; ProvinceLocation.evidence.phase = phase;
      ProvinceLocation.evidence.coordinatesState = 'pending'; UiPerf.mark('location.coordinates.start');
      const position = await geoLocationManager.getCurrentLocation({
        priority: geoLocationManager.LocationRequestPriority.FIRST_FIX, timeoutMs: 10000 });
      if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude) ||
        Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180) {
        throw new LocationFailure('系统返回的位置无效，请稍后重试', phase);
      }
      ProvinceLocation.evidence.coordinatesState = 'valid'; UiPerf.mark('location.coordinates.valid');
      ProvinceLocation.ensureAuthorized(context);
      phase = 'geocoder'; ProvinceLocation.evidence.phase = phase;
      if (!geoLocationManager.isGeocoderAvailable()) {
        ProvinceLocation.evidence.geocoderState = 'unsupported';
        throw new LocationFailure('已取得位置，但此设备暂不支持地区解析，可手动选择', phase);
      }
      ProvinceLocation.evidence.geocoderState = 'pending'; UiPerf.mark('location.geocoder.start');
      const addresses = await geoLocationManager.getAddressesFromLocation({
        latitude: position.latitude, longitude: position.longitude, maxItems: 1, locale: 'zh-CN' });
      if (addresses.length === 0) { throw new LocationFailure('已取得位置，但未解析到省市，请稍后重试', phase); }
      ProvinceLocation.evidence.geocoderState = 'resolved'; UiPerf.mark('location.geocoder.resolved');
      phase = 'normalize'; ProvinceLocation.evidence.phase = phase;
      const address = addresses[0];
      if (address.countryCode && !['CN', 'HK', 'MO', 'TW'].includes(address.countryCode)) {
        throw new LocationFailure('当前位置不在支持的地区范围，请手动选择', phase);
      }
      const province = ProvinceCatalog.normalize(address.administrativeArea ?? '') ||
        ProvinceCatalog.normalize(address.locality ?? '');
      if (!province) { throw new LocationFailure('已解析位置，但无法识别省级地区，请手动选择', phase); }
      // Never retain street/sub-locality, full addresses or coordinates in the cache.
      const locality = (address.locality ?? '').trim();
      const city = /^[\u4e00-\u9fff]{2,12}(市|自治州|地区|盟)$/.test(locality) ? locality : '';
      ProvinceLocation.ensureAuthorized(context);
      ProvinceLocation.region = new LocatedRegion(province, city);
      ProvinceLocation.expires = Date.now() + 10 * 60 * 1000;
      ProvinceLocation.evidence.phase = 'complete';
      ProvinceLocation.notify(); UiPerf.mark('location.region.published');
      return ProvinceLocation.region;
    } catch (error) {
      const code = (error as BusinessError).code;
      const failure = error as LocationFailure;
      ProvinceLocation.evidence.phase = failure instanceof LocationFailure ? failure.phase : phase;
      ProvinceLocation.evidence.systemErrorCode = typeof code === 'number' ? code : 0;
      if (phase === 'coordinates' && ProvinceLocation.evidence.coordinatesState !== 'valid') {
        ProvinceLocation.evidence.coordinatesState = 'failed';
      }
      if (phase === 'geocoder' && ProvinceLocation.evidence.geocoderState !== 'unsupported') {
        ProvinceLocation.evidence.geocoderState = 'failed';
      }
      UiPerf.mark(`location.${ProvinceLocation.evidence.phase}.failed.${code || 0}`);
      if (failure instanceof LocationFailure) { throw failure; }
      if (code === 201) { throw new LocationFailure('未获得定位权限，可手动选择地区', phase, code); }
      if (code === 3301100) { throw new LocationFailure('请在系统设置中开启位置服务，或手动选择地区', 'switch', code); }
      if (phase === 'geocoder' && code) { throw new LocationFailure(`已取得位置，但地区解析失败（${code}），可手动选择`, phase, code); }
      if (code === 801) { throw new LocationFailure('此设备暂不支持系统定位，可手动选择', phase, code); }
      if (phase === 'coordinates' && code === 3301200) {
        throw new LocationFailure('定位请求未取得结果或超时（3301200），请稍后重试', phase, code);
      }
      throw new LocationFailure(code ? `定位暂不可用（${code}），可手动选择地区` :
        ((error as Error).message || '定位失败，可手动选择地区'), phase, code || 0);
    }
  }
}
