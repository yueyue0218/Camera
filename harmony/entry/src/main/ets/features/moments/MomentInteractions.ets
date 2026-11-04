import { MomentFavoriteApi, MomentFavoriteWrite } from './MomentFavoriteWrite';
import { MomentSummary } from '../../model/ApiModels';
import { ErrorMapper, PortraError } from '../../network/ErrorMapper';
import { createMomentFeedRequestKey, MomentFeedCache, MomentFeedFormatter } from './MomentFeedModels';

/** Supplied by the shared API owner; this file contains no transport or credentials. */
export interface MomentInteractionApi extends MomentFavoriteApi {
  getMoment(momentId: number, requestKey?: string): Promise<MomentSummary>;
  cancelMomentDetail(requestKey?: string): void;
  likeMoment(momentId: number, requestKey?: string): Promise<MomentSummary>;
  unlikeMoment(momentId: number, requestKey?: string): Promise<MomentSummary>;
  cancelMomentLike(momentId: number, requestKey?: string): void;
}

export interface MomentInteractionSession {
  getSessionVersion(): number;
  isAuthenticated(): boolean;
}

export class MomentInteractionSnapshot {
  targetId: number = 0;
  item?: MomentSummary;
  images: string[] = [];
  loading: boolean = false;
  favoriteBusyId: number = 0;
  favoriteUncertainMomentId: number = 0;
  likeBusyId: number = 0;
  uncertainMomentId: number = 0;
  message: string = '';
  authenticationRequired: boolean = false;
  unavailableMomentId: number = 0;
}

export class MomentDetailData {
  static images(item: MomentSummary): string[] {
    // An explicit array, including [], is authoritative. Preserve order/duplicates.
    if (item.imageDataList !== undefined) {
      if (!Array.isArray(item.imageDataList) ||
        item.imageDataList.some((value: string) => typeof value !== 'string' || value.trim().length === 0)) {
        throw ErrorMapper.parse();
      }
      return item.imageDataList.slice();
    }
    return typeof item.imageData === 'string' && item.imageData.trim().length > 0 ? [item.imageData] : [];
  }

  static feedPreview(item: MomentSummary): MomentSummary {
    return { momentId: item.momentId, authorId: item.authorId, authorRole: item.authorRole,
      title: item.title, content: item.content, imageData: item.imageData,
      imageDataList: MomentDetailData.images(item).slice(0, 3), mentions: item.mentions,
      likeCount: item.likeCount, likedByCurrentUser: item.likedByCurrentUser,
      favoriteCount: item.favoriteCount, favoritedByCurrentUser: item.favoritedByCurrentUser,
      createdAt: item.createdAt, updatedAt: item.updatedAt, status: item.status };
  }
}

/** C-owned view state. Each completion is scoped to a view, account and object. */
export class MomentInteractions {
  private readonly api: MomentInteractionApi;
  private readonly session: MomentInteractionSession;
  private readonly cache: MomentFeedCache;
  private readonly onChange: (state: MomentInteractionSnapshot) => void;
  private readonly onReconciled: (item: MomentSummary) => void;
  private state: MomentInteractionSnapshot = new MomentInteractionSnapshot();
  private active: boolean = false;
  private generation: number = 0;
  private readGeneration: number = 0;
  private sessionVersion: number = -1;
  private readonly requestKey: string = `${createMomentFeedRequestKey()}.interaction`;

  constructor(api: MomentInteractionApi, session: MomentInteractionSession, cache: MomentFeedCache,
    onChange: (state: MomentInteractionSnapshot) => void, onReconciled: (item: MomentSummary) => void) {
    this.api = api;
    this.session = session;
    this.cache = cache;
    this.onChange = onChange;
    this.onReconciled = onReconciled;
  }

  resume(): void {
    if (this.sessionVersion !== this.session.getSessionVersion()) {
      this.generation++;
      this.state = new MomentInteractionSnapshot();
      this.sessionVersion = this.session.getSessionVersion();
    }
    this.active = true;
    this.state.authenticationRequired = !this.session.isAuthenticated();
    this.publish();
  }

  suspend(): void {
    this.active = false;
    this.generation++;
    this.readGeneration++;
    this.api.cancelMomentDetail(`${this.requestKey}.detail`);
    if (this.state.likeBusyId > 0) {
      this.cache.markUncertainLike(this.sessionVersion, this.state.likeBusyId);
      this.api.cancelMomentLike(this.state.likeBusyId, `${this.requestKey}.like`);
    }
    if (this.state.favoriteBusyId > 0) { this.cache.markUncertainFavorite(this.sessionVersion, this.state.favoriteBusyId); }
    this.state = new MomentInteractionSnapshot();
    this.publish();
  }

  close(preserveMessage: boolean = false): void {
    this.readGeneration++;
    this.api.cancelMomentDetail(`${this.requestKey}.detail`);
    this.state.targetId = 0;
    this.state.item = undefined;
    this.state.images = [];
    this.state.loading = false;
    if (!preserveMessage) { this.state.message = ''; }
    this.state.unavailableMomentId = 0;
    this.publish();
  }

  isLikeUncertain(momentId: number): boolean {
    return this.cache.hasUncertainLike(this.sessionVersion, momentId);
  }

  async open(momentId: number): Promise<void> {
    if (!this.ready() || !Number.isSafeInteger(momentId) || momentId <= 0 || this.state.likeBusyId !== 0 || this.state.favoriteBusyId !== 0) {
      return;
    }
    this.close();
    const read = ++this.readGeneration;
    const view = this.generation;
    const version = this.sessionVersion;
    this.state.targetId = momentId;
    this.state.loading = true;
    this.publish();
    try {
      if (this.cache.hasPendingFavorite(version)) {
        await this.cache.waitForFavorite(version);
        if (!this.isCurrent(view, version) || read !== this.readGeneration) {
          return;
        }
      }
      // Never seed full images from a Feed item or silently fall back on error.
      let revision = this.cache.getWriteRevision(version);
      let result: MomentSummary | undefined = undefined;
      let failure: PortraError | undefined = undefined;
      try {
        result = await this.api.getMoment(momentId, `${this.requestKey}.detail`);
      } catch (error) {
        failure = error as PortraError;
      }
      if (!this.isCurrent(view, version) || read !== this.readGeneration) {
        return;
      }
      if (revision !== this.cache.getWriteRevision(version)) {
        await this.cache.waitForFavorite(version);
        if (!this.isCurrent(view, version) || read !== this.readGeneration) {
          return;
        }
        revision = this.cache.getWriteRevision(version);
        failure = undefined;
        try {
          result = await this.api.getMoment(momentId, `${this.requestKey}.detail`);
        } catch (error) {
          failure = error as PortraError;
        }
        if (!this.isCurrent(view, version) || read !== this.readGeneration) {
          return;
        }
        if (revision !== this.cache.getWriteRevision(version)) {
          throw ErrorMapper.stale();
        }
      }
      if (failure !== undefined) {
        throw failure;
      }
      if (result === undefined || !MomentFeedFormatter.isValid(result) || result.momentId !== momentId) {
        throw ErrorMapper.parse();
      }
      if (result.status === 'DELETED') {
        this.cache.clear(); this.state.unavailableMomentId = momentId; this.state.message = '该动态已删除。'; return;
      }
      const images = MomentDetailData.images(result);
      this.state.item = result;
      this.state.images = images;
      this.cache.clearUncertainLike(version, momentId);
      this.state.uncertainMomentId = 0;
      this.cache.clearUncertainFavorite(version, momentId);
      this.state.favoriteUncertainMomentId = 0;
      this.onReconciled(MomentDetailData.feedPreview(result));
    } catch (error) {
      if (this.isCurrent(view, version) && read === this.readGeneration) {
        this.setError(error as PortraError, '详情读取失败，请重试。');
        const mapped = error as PortraError;
        if (mapped.httpStatus === 404 || mapped.businessCode === 40401) {
          this.cache.clear();
          this.state.unavailableMomentId = momentId;
        }
      }
    } finally {
      if (this.isCurrent(view, version) && read === this.readGeneration) {
        this.state.loading = false;
        this.publish();
      }
    }
  }

  async toggleLike(item: MomentSummary): Promise<void> {
    if (!this.ready() || !MomentFeedFormatter.isValid(item) || this.state.likeBusyId !== 0 || this.state.favoriteBusyId !== 0 ||
      this.state.loading || this.isLikeUncertain(item.momentId) || this.cache.hasPendingFavorite(this.sessionVersion)) {
      return;
    }
    const view = this.generation;
    const version = this.sessionVersion;
    const desired = !item.likedByCurrentUser;
    this.state.likeBusyId = item.momentId;
    this.state.message = '';
    this.publish();
    try {
      const operation = desired ? this.api.likeMoment(item.momentId, `${this.requestKey}.like`) :
        this.api.unlikeMoment(item.momentId, `${this.requestKey}.like`);
      // Reuse the existing cross-instance write barrier; legacy API name stays compatible.
      this.cache.trackFavorite(operation, version);
      const result = await operation;
      if (!this.isCurrent(view, version)) {
        return;
      }
      if (!MomentFeedFormatter.isValid(result) || result.momentId !== item.momentId ||
        result.likedByCurrentUser !== desired) {
        throw ErrorMapper.parse();
      }
      const images = MomentDetailData.images(result);
      if (this.state.targetId === result.momentId) {
        this.state.item = result;
        this.state.images = images;
      }
      this.cache.clear();
      this.onReconciled(MomentDetailData.feedPreview(result));
    } catch (error) {
      if (this.isCurrent(view, version)) {
        this.cache.clear();
        this.cache.markUncertainLike(version, item.momentId);
        this.state.uncertainMomentId = item.momentId;
        this.setError(error as PortraError, '点赞结果未确认。');
        if (!this.state.authenticationRequired) {
          this.state.message = '点赞结果未确认，请打开详情核实后再操作。';
        }
      }
    } finally {
      if (this.isCurrent(view, version)) {
        this.state.likeBusyId = 0;
        this.publish();
      }
    }
  }

  async toggleFavorite(item: MomentSummary): Promise<void> {
    const current = this.state.item;
    if (!this.ready() || current === undefined || current.momentId !== item.momentId ||
      this.state.targetId !== current.momentId || !MomentFeedFormatter.isValid(current) || this.state.loading ||
      this.state.likeBusyId !== 0 || this.state.favoriteBusyId !== 0 ||
      this.cache.hasUncertainFavorite(this.sessionVersion, current.momentId) ||
      this.cache.hasPendingFavorite(this.sessionVersion)) { return; }
    const view = this.generation; const version = this.sessionVersion;
    this.state.favoriteBusyId = current.momentId; this.state.message = ''; this.publish();
    try {
      const result = await MomentFavoriteWrite.execute(this.api, this.cache, version, current);
      if (!this.isCurrent(view, version)) { return; }
      const images = MomentDetailData.images(result);
      if (this.state.targetId === result.momentId) { this.state.item = result; this.state.images = images; }
      this.onReconciled(MomentDetailData.feedPreview(result));
    } catch (error) {
      if (this.isCurrent(view, version)) {
        this.cache.markUncertainFavorite(version, current.momentId);
        this.state.favoriteUncertainMomentId = current.momentId;
        this.setError(error as PortraError, '收藏结果未确认，请重新读取核实后再操作。');
        if (!this.state.authenticationRequired) { this.state.message = '收藏结果未确认，请重新读取核实后再操作。'; }
      }
    } finally {
      if (this.isCurrent(view, version)) { this.state.favoriteBusyId = 0; this.publish(); }
    }
  }

  private ready(): boolean {
    if (!this.active) {
      return false;
    }
    if (this.sessionVersion !== this.session.getSessionVersion()) {
      this.suspend();
      this.resume();
      return false;
    }
    if (!this.session.isAuthenticated()) {
      this.state.authenticationRequired = true;
      this.publish();
      return false;
    }
    return true;
  }

  private isCurrent(view: number, version: number): boolean {
    if (!this.active || view !== this.generation) {
      return false;
    }
    if (version !== this.session.getSessionVersion()) {
      this.suspend();
      this.resume();
      return false;
    }
    return true;
  }

  private setError(error: PortraError, fallback: string): void {
    this.state.authenticationRequired = ErrorMapper.isAuthenticationExpired(error);
    this.state.message = error.message?.length > 0 ? error.message : fallback;
    if (this.state.authenticationRequired) {
      this.state.item = undefined;
      this.state.images = [];
    }
  }

  private publish(): void {
    this.onChange({ targetId: this.state.targetId, item: this.state.item, images: this.state.images.slice(),
      favoriteBusyId: this.state.favoriteBusyId, favoriteUncertainMomentId: this.state.favoriteUncertainMomentId,
      loading: this.state.loading, likeBusyId: this.state.likeBusyId,
      uncertainMomentId: this.state.uncertainMomentId, message: this.state.message,
      authenticationRequired: this.state.authenticationRequired, unavailableMomentId: this.state.unavailableMomentId });
  }
}
