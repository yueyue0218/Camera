function yuanToCent(value) {
  if (value === '' || value === null || value === undefined) return null
  return Math.round(Number(value) * 100)
}

export async function promptAndRespondDemand({ demand, currentUser, demandApi, normalizeError, onSuccess }) {
  const expectedPrice = window.prompt('请输入响应报价（元）', '')
  if (expectedPrice === null) return
  const message = window.prompt('给单主留一句话', '')
  if (message === null) return
  try {
    await demandApi.respond(demand.demandId, {
      expectedPriceCent: yuanToCent(expectedPrice),
      message
    }, currentUser)
    await onSuccess?.()
    window.alert('响应已提交')
  } catch (error) {
    window.alert(normalizeError(error))
  }
}
