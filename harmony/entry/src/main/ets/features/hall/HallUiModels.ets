export enum HallContentState {
  LOADING = 'loading',
  CONTENT = 'content',
  EMPTY = 'empty',
  ERROR = 'error'
}

export enum HallChannel {
  SHOWCASES = 'showcases',
  DEMANDS = 'demands'
}

export class HallTextFormatter {
  static nonEmpty(value: string | undefined, fallback: string): string {
    const normalized = value?.trim() ?? '';
    return normalized.length > 0 ? normalized : fallback;
  }

  static city(value: string | undefined): string {
    const normalized = value?.trim() ?? '';
    const knownCities: Record<string, string> = {
      '320100': '南京',
      '320500': '苏州',
      '310000': '上海',
      '330100': '杭州'
    };
    return knownCities[normalized] ?? (normalized.length > 0 ? normalized : '城市待定');
  }

  static price(priceRange: string | undefined, basePriceCent: number | undefined): string {
    const explicitPrice = priceRange?.trim() ?? '';
    if (explicitPrice.length > 0) {
      return explicitPrice;
    }
    if (basePriceCent === undefined || !Number.isFinite(basePriceCent) || basePriceCent < 0) {
      return '价格面议';
    }
    return `¥${Math.round(basePriceCent / 100)} 起`;
  }

  static budget(minCent: number | undefined, maxCent: number | undefined): string {
    const hasMin = minCent !== undefined && Number.isFinite(minCent) && minCent >= 0;
    const hasMax = maxCent !== undefined && Number.isFinite(maxCent) && maxCent >= 0;
    if (hasMin && hasMax) {
      return `¥${Math.round((minCent as number) / 100)}–${Math.round((maxCent as number) / 100)}`;
    }
    if (hasMin) {
      return `¥${Math.round((minCent as number) / 100)} 起`;
    }
    if (hasMax) {
      return `¥${Math.round((maxCent as number) / 100)} 以内`;
    }
    return '预算面议';
  }
}
