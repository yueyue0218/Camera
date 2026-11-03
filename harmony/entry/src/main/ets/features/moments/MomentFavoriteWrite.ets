import { MomentSummary } from '../../model/ApiModels';
import { ErrorMapper, PortraError } from '../../network/ErrorMapper';
import { MomentFeedCache, MomentFeedFormatter } from './MomentFeedModels';

export interface MomentFavoriteApi {
  favoriteMoment(id: number): Promise<MomentSummary>;
  unfavoriteMoment(id: number): Promise<MomentSummary>;
}

/** One existing authenticated favorite operation shared by Feed and detail. */
export class MomentFavoriteWrite {
  static async execute(api: MomentFavoriteApi, cache: MomentFeedCache, version: number,
    current: MomentSummary): Promise<MomentSummary> {
    if (cache.hasPendingFavorite(version) || cache.hasUncertainFavorite(version, current.momentId)) {
      throw ErrorMapper.stale();
    }
    const desired = !current.favoritedByCurrentUser;
    try {
      const request = desired ? api.favoriteMoment(current.momentId) : api.unfavoriteMoment(current.momentId);
      cache.trackFavorite(request, version);
      const result = await request;
      if (!MomentFeedFormatter.isValid(result) || result.momentId !== current.momentId ||
        result.favoritedByCurrentUser !== desired ||
        (result.imageDataList !== undefined && (!Array.isArray(result.imageDataList) ||
          result.imageDataList.some((image: string) => typeof image !== 'string' || image.trim().length === 0)))) { throw ErrorMapper.parse(); }
      cache.clear(); cache.clearUncertainFavorite(version, current.momentId);
      return result;
    } catch (error) {
      cache.clear(); cache.markUncertainFavorite(version, current.momentId);
      throw error as PortraError;
    }
  }
}
