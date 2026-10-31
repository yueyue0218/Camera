import { UIContext, uiObserver } from '@kit.ArkUI';
import { MomentFeedLifecycle } from '../../features/moments/MomentFeedLifecycle';

/** Reuse native route/foreground observation without changing the message-tab signal. */
export class DetailVisibility {
  static create(context: UIContext, navigation: () => uiObserver.NavigationInfo | undefined,
    destination: () => uiObserver.NavDestinationInfo | undefined,
    changed: (visible: boolean) => void, unavailable: () => void): MomentFeedLifecycle {
    return new MomentFeedLifecycle(context, (update?: uiObserver.NavDestinationInfo): boolean => {
      const nav = navigation();
      let route = destination();
      if (nav === undefined || route === undefined) { throw new Error('Navigation unavailable'); }
      if (update?.navDestinationId === route.navDestinationId) { route = update; }
      return route.index === nav.pathStack.size() - 1 &&
        route.state !== uiObserver.NavDestinationState.ON_HIDDEN &&
        route.state !== uiObserver.NavDestinationState.ON_WILL_HIDE &&
        route.state !== uiObserver.NavDestinationState.ON_DISAPPEAR &&
        route.state !== uiObserver.NavDestinationState.ON_WILL_DISAPPEAR;
    }, changed, unavailable);
  }
}
