export const DEFAULT_DEMAND_RESPONSE_MESSAGE = '我想响应这个需求，可以进一步沟通拍摄时间和方案'

export async function submitDemandResponse({ demand, currentUser, demandApi, normalizeError, onSuccess, onError }) {
  try {
    // One-click response only creates DemandResponse; conversation/notifications stay on customer accept.
    const response = await demandApi.createDemandResponse(demand.demandId, {
      message: DEFAULT_DEMAND_RESPONSE_MESSAGE,
      expectedPriceCent: null
    }, currentUser)
    await onSuccess?.(response)
    return response
  } catch (error) {
    const message = normalizeError(error)
    await onError?.(message, error)
    return null
  }
}
