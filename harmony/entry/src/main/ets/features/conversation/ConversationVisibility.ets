import { AppRoute, NavigationRouteParam } from '../../model/NavigationModels';

interface VisibilityListener {
  callback: (visible: boolean) => void;
  last: boolean;
}

/** NavDestination and Ability lifecycle share one small visibility signal. */
export class ConversationVisibility {
  private static foreground: boolean = true;
  private static activeKey: string = '';
  private static listeners: Map<string, VisibilityListener> = new Map<string, VisibilityListener>();

  static key(route: string, param: NavigationRouteParam = {}): string {
    if (route === AppRoute.CONVERSATION_DETAIL) return `detail:${param.conversationId ?? 0}`;
    if (route === AppRoute.MESSAGE) return 'list';
    if (route === AppRoute.ORDER) return 'orders';
    return '';
  }

  static subscribe(key: string, listener: (visible: boolean) => void): void {
    const visible = ConversationVisibility.foreground && ConversationVisibility.activeKey === key;
    ConversationVisibility.listeners.set(key, { callback: listener, last: visible });
    listener(visible);
  }

  static unsubscribe(key: string): void {
    ConversationVisibility.listeners.delete(key);
  }

  static show(route: string, param: NavigationRouteParam = {}): void {
    ConversationVisibility.activeKey = ConversationVisibility.key(route, param);
    ConversationVisibility.notify();
  }

  static hide(route: string, param: NavigationRouteParam = {}): void {
    if (ConversationVisibility.activeKey === ConversationVisibility.key(route, param)) {
      ConversationVisibility.activeKey = '';
      ConversationVisibility.notify();
    }
  }

  static setForeground(foreground: boolean): void {
    ConversationVisibility.foreground = foreground;
    ConversationVisibility.notify();
  }

  private static notify(): void {
    ConversationVisibility.listeners.forEach((listener: VisibilityListener, key: string) => {
      const visible = ConversationVisibility.foreground && ConversationVisibility.activeKey === key;
      if (visible !== listener.last) {
        listener.last = visible;
        listener.callback(visible);
      }
    });
  }
}
