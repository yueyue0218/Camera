export class PhoneLoginPolicy {
  static normalizePhone(value: string): string | undefined {
    const compact = value.replace(/[\s()\-]/g, '');
    const match = /^(?:\+86|0086|86)?(1[3-9]\d{9})$/.exec(compact);
    return match === null ? undefined : `+86${match[1]}`;
  }

  static sanitizeCode(value: string): string {
    return value.replace(/\D/g, '').slice(0, 6);
  }

  static validCode(value: string): boolean {
    return /^\d{6}$/.test(value);
  }
}
