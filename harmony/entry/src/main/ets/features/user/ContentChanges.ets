export class ContentChanges {
  private static listeners: Set<(kind?: string) => void> = new Set<(kind?: string) => void>();
  static observe(listener: (kind?: string) => void): void { ContentChanges.listeners.add(listener); }
  static unobserve(listener: (kind?: string) => void): void { ContentChanges.listeners.delete(listener); }
  static publish(kind: string = 'content'): void { ContentChanges.listeners.forEach((listener: (kind?: string) => void) => listener(kind)); }
}
