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

/** Foreground, approximate location; no coordinates are cached, logged or uploaded. */
export class ProvinceLocation {
  private static region: LocatedRegion | undefined = undefined;
  private static expires: number = 0;
  private static pending: Promise<LocatedRegion> | undefined = undefined;
  private static passiveAfter: number = 0;
  private static listeners: Set<() => void> = new Set<() => void>();
  static observe(listener: () => void): void { ProvinceLocation.listeners.add(listener); }
  static unobserve(listener: () => void): void { ProvinceLocation.listeners.delete(listener); }
  private static notify(): void { ProvinceLocation.listeners.forEach((listener: () => void) => listener()); }
  static authorized(context: common.UIAbilityContext): boolean {
    if (!AppClient.shared.hasRequiredPrivacyConsent()) { return false; }
    return abilityAccessCtrl.createAtManager().checkAccessTokenSync(context.applicationInfo.accessTokenId,
      'ohos.permission.APPROXIMATELY_LOCATION') === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
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
    try { await ProvinceLocation.locate(context, false); } catch (error) { /* No permission prompt or toast on page entry. */ }
  }
  static async locate(context: common.UIAbilityContext, requestPermission: boolean = true): Promise<LocatedRegion> {
    if (!AppClient.shared.hasRequiredPrivacyConsent()) { throw new Error('请先阅读并同意隐私政策'); }
    const cached = ProvinceLocation.cached(context);
    if (cached) { UiPerf.mark('location.cache.hit'); return cached; }
    if (ProvinceLocation.pending !== undefined) { return ProvinceLocation.pending; }
    const request = ProvinceLocation.request(context, requestPermission);
    ProvinceLocation.pending = request;
    try { return await request; } finally { ProvinceLocation.pending = undefined; }
  }
  private static async request(context: common.UIAbilityContext, requestPermission: boolean): Promise<LocatedRegion> {
    let phase = 'permission';
    try {
      if (!ProvinceLocation.authorized(context)) {
        ProvinceLocation.region = undefined; ProvinceLocation.expires = 0; ProvinceLocation.notify();
        if (!requestPermission) { throw new Error('未授权定位'); }
        const permission = await abilityAccessCtrl.createAtManager().requestPermissionsFromUser(context,
          ['ohos.permission.APPROXIMATELY_LOCATION']);
        if (permission.authResults.length !== 1 || permission.authResults[0] !== 0) {
          UiPerf.mark('location.permission.denied'); throw new Error('未授权定位，可继续手动选择地区');
        }
      }
      UiPerf.mark('location.permission.granted');
      phase = 'switch';
      if (!geoLocationManager.isLocationEnabled()) {
        UiPerf.mark('location.switch.off'); throw new Error('请在系统设置中开启位置服务，或手动选择地区');
      }
      phase = 'coordinates'; UiPerf.mark('location.coordinates.start');
      const position = await geoLocationManager.getCurrentLocation({
        priority: geoLocationManager.LocationRequestPriority.FIRST_FIX, timeoutMs: 10000 });
      if (!Number.isFinite(position.latitude) || !Number.isFinite(position.longitude) ||
        Math.abs(position.latitude) > 90 || Math.abs(position.longitude) > 180) { throw new Error('系统返回的位置无效，请稍后重试'); }
      UiPerf.mark('location.coordinates.valid');
      phase = 'geocoder';
      if (!geoLocationManager.isGeocoderAvailable()) { throw new Error('已取得位置，但此设备暂不支持地区解析'); }
      UiPerf.mark('location.geocoder.start');
      const addresses = await geoLocationManager.getAddressesFromLocation({
        latitude: position.latitude, longitude: position.longitude, maxItems: 1, locale: 'zh-CN' });
      if (addresses.length === 0) { throw new Error('已取得位置，但未解析到省市，请稍后重试'); }
      phase = 'normalize';
      const address = addresses[0];
      if (address.countryCode && !['CN', 'HK', 'MO', 'TW'].includes(address.countryCode)) {
        throw new Error('当前位置不在支持的地区范围，请手动选择');
      }
      const province = ProvinceCatalog.normalize(address.administrativeArea ?? '') ||
        ProvinceCatalog.normalize(address.locality ?? '');
      if (!province) { throw new Error('已解析位置，但无法识别省级地区，请手动选择'); }
      // Only the city-level locality field is retained; never street/sub-locality or full address.
      const locality = (address.locality ?? '').trim();
      const city = /^[\u4e00-\u9fff]{2,12}(市|自治州|地区|盟)$/.test(locality) ? locality : '';
      if (!ProvinceLocation.authorized(context)) { throw new Error('定位授权已失效，请重新授权'); }
      ProvinceLocation.region = new LocatedRegion(province, city);
      ProvinceLocation.expires = Date.now() + 10 * 60 * 1000;
      ProvinceLocation.notify(); UiPerf.mark('location.region.published');
      return ProvinceLocation.region;
    } catch (error) {
      const code = (error as BusinessError).code;
      UiPerf.mark(`location.${phase}.failed.${code || 0}`);
      if (code === 201) { throw new Error('未获得定位权限，可手动选择地区'); }
      if (code === 3301100) { throw new Error('请在系统设置中开启位置服务，或手动选择地区'); }
      if (phase === 'geocoder' && code) { throw new Error(`已取得位置，但地区解析失败（${code}），可手动选择`); }
      if (code === 801) { throw new Error('此设备暂不支持系统定位，可手动选择'); }
      if (phase === 'coordinates' && code === 3301200) { throw new Error('定位请求未取得结果或超时（3301200），请稍后重试'); }
      if (code) { throw new Error(`定位暂不可用（${code}），可手动选择地区`); }
      throw new Error((error as Error).message || '定位失败，可手动选择地区');
    }
  }
}
