import { hilog } from '@kit.PerformanceAnalysisKit';
import BuildProfile from 'entry/BuildProfile';

/** Debug-only timing; never logs user IDs, URLs, coordinates or response bodies. */
export class UiPerf {
  static mark(label: string): void {
    if (BuildProfile.DEBUG) { hilog.info(0x0000, 'PortraPerf', '%{public}s t=%{public}d', label, Date.now()); }
  }
  static elapsed(label: string, start: number): void {
    if (BuildProfile.DEBUG) { hilog.info(0x0000, 'PortraPerf', '%{public}s ms=%{public}d', label, Date.now() - start); }
  }
  static async request<T>(label: string, action: () => Promise<T>): Promise<T> {
    const start = Date.now(); UiPerf.mark(label + '.start');
    try { return await action(); } finally { UiPerf.elapsed(label + '.end', start); }
  }
}
