export class ContentChanges {
  private static listeners: Set<() => void> = new Set<() => void>();
  static observe(listener: () => void): void { ContentChanges.listeners.add(listener); }
  static unobserve(listener: () => void): void { ContentChanges.listeners.delete(listener); }
  static publish(): void { ContentChanges.listeners.forEach((listener: () => void) => listener()); }
}
