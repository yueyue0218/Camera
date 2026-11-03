import { ApplicationStateChangeCallback, common } from '@kit.AbilityKit';
import { UIContext, UIObserver, uiObserver } from '@kit.ArkUI';

/** C-owned subscription; observes native events without changing navigation or auth. */
export class MomentFeedLifecycle {
  private readonly uiContext: UIContext;
  private readonly observer: UIObserver;
  private readonly application: common.ApplicationContext;
  private readonly readRouteVisible: (update?: uiObserver.NavDestinationInfo) => boolean;
  private readonly onVisibility: (visible: boolean) => void;
  private readonly onUnavailable: () => void;
  private running: boolean = false;
  private navigationRegistered: boolean = false;
  private destinationRegistered: boolean = false;
  private applicationRegistered: boolean = false;
  private foreground: boolean = true;
  private visible?: boolean;
  private readonly navigationCallback: (info: uiObserver.NavDestinationSwitchInfo) => void =
    (_info: uiObserver.NavDestinationSwitchInfo) => this.refresh();
  private readonly destinationCallback: (info: uiObserver.NavDestinationInfo) => void =
    (info: uiObserver.NavDestinationInfo) => this.refresh(info);
  private readonly applicationCallback: ApplicationStateChangeCallback = {
    onApplicationForeground: () => {
      this.foreground = true;
      this.refresh();
    },
    onApplicationBackground: () => {
      this.foreground = false;
      this.refresh();
    }
  };

  constructor(uiContext: UIContext, readRouteVisible: (update?: uiObserver.NavDestinationInfo) => boolean,
    onVisibility: (visible: boolean) => void, onUnavailable: () => void) {
    this.uiContext = uiContext;
    this.observer = uiContext.getUIObserver();
    this.application = (uiContext.getHostContext() as common.UIAbilityContext).getApplicationContext();
    this.readRouteVisible = readRouteVisible;
    this.onVisibility = onVisibility;
    this.onUnavailable = onUnavailable;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      this.observer.on('navDestinationSwitch', this.navigationCallback);
      this.navigationRegistered = true;
      this.observer.on('navDestinationUpdate', this.destinationCallback);
      this.destinationRegistered = true;
      this.application.on('applicationStateChange', this.applicationCallback);
      this.applicationRegistered = true;
      this.refresh();
    } catch {
      this.stop();
      throw new Error('Moment feed lifecycle subscription failed');
    }
  }

  stop(): void {
    this.running = false;
    if (this.navigationRegistered) {
      this.navigationRegistered = false;
      try {
        this.observer.off('navDestinationSwitch', this.navigationCallback);
      } catch {
        // A queued or unsuccessfully detached callback is inert when running=false.
      }
    }
    if (this.applicationRegistered) {
      this.applicationRegistered = false;
      try {
        this.application.off('applicationStateChange', this.applicationCallback);
      } catch {
        // Never unregister another feature's callbacks as a cleanup fallback.
      }
    }
    if (this.destinationRegistered) {
      this.destinationRegistered = false;
      try {
        this.observer.off('navDestinationUpdate', this.destinationCallback);
      } catch {
        // The running guard also applies to late destination lifecycle events.
      }
    }
  }

  private refresh(update?: uiObserver.NavDestinationInfo): void {
    if (!this.running) {
      return;
    }
    try {
      const visible = this.foreground && this.readRouteVisible(update);
      if (visible !== this.visible) {
        this.visible = visible;
        this.uiContext.runScopedTask(() => this.onVisibility(visible));
      }
    } catch {
      this.stop();
      this.uiContext.runScopedTask(() => this.onUnavailable());
    }
  }
}
