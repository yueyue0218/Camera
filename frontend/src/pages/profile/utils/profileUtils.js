import { USERS } from '../../../AuthContext.jsx'

const SAVED_PHOTO_STORAGE_KEY = 'camera-p4-saved-photos'
const FOLLOW_STORAGE_KEY = 'camera-p4-follows'
const USER_PROFILE_STORAGE_KEY = 'camera-p4-user-profiles'
const PORTFOLIO_STORAGE_KEY = 'camera-p4-portfolios'
const LOCAL_REVIEW_STORAGE_KEY = 'camera-p4-local-reviews'
const ARBITRATION_STORAGE_KEY = 'camera-p4-arbitrations'
const ORDER_SNAPSHOT_STORAGE_KEY = 'camera-p4-order-snapshots'
const CONVERSATION_STORAGE_KEY = 'camera-p4-conversations'

export const roleMap = {
  CUSTOMER: '需求方',
  PROVIDER: '服务方'
}

export function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function writeJsonStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function isApiUnavailable(error) {
  return Boolean(error?.isNetworkError)
    || error?.status === 404
    || (error?.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
}

export function readLocalReviews() {
  return readJsonStorage(LOCAL_REVIEW_STORAGE_KEY, [])
}

export function normalizeReview(review) {
  if (!review) return null
  return {
    reviewId: review.reviewId || review.id,
    orderId: Number(review.orderId),
    reviewerId: Number(review.reviewerId),
    targetUserId: Number(review.targetUserId),
    direction: review.direction,
    rating: Number(review.rating || 0),
    content: review.content || '',
    isVisible: review.isVisible ?? true,
    createdAt: review.createdAt
  }
}

export function mergeReviewLists(...lists) {
  const map = new Map()
  lists.flat().filter(Boolean).map(normalizeReview).filter(Boolean).forEach(review => {
    const key = review.reviewId || `${review.orderId}-${review.direction}-${review.reviewerId}`
    map.set(String(key), review)
  })
  return Array.from(map.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

export function getLocalReviewsByTarget(userId) {
  return readLocalReviews().filter(review => Number(review.targetUserId) === Number(userId))
}

function readLocalArbitrations() {
  return readJsonStorage(ARBITRATION_STORAGE_KEY, [])
}

function normalizeComplaint(record) {
  if (!record) return null
  return {
    arbitrationId: record.arbitrationId || record.complaintId,
    complaintId: record.complaintId,
    reviewId: record.reviewId,
    orderId: Number(record.orderId),
    applicantId: Number(record.applicantId ?? record.complainantId),
    respondentId: Number(record.respondentId),
    reason: record.reason || '评价争议',
    description: record.description || record.arbitrationComment || record.evidenceFileIds || '',
    status: record.status || 'PENDING',
    arbitrationResult: record.arbitrationResult,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    handledAt: record.handledAt
  }
}

function mergeComplaints(...lists) {
  const map = new Map()
  lists.flat().filter(Boolean).map(normalizeComplaint).filter(Boolean).forEach(record => {
    const key = record.complaintId || record.arbitrationId || `${record.reviewId}-${record.applicantId}-${record.createdAt}`
    map.set(String(key), record)
  })
  return Array.from(map.values()).sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0))
}

function getArbitrationsByOrder(orderId) {
  return mergeComplaints(readLocalArbitrations().filter(record => Number(record.orderId) === Number(orderId)))
}

function orderHasArbitration(orderId) {
  return getArbitrationsByOrder(orderId).length > 0
}

export function readOrderSnapshots() {
  return readJsonStorage(ORDER_SNAPSHOT_STORAGE_KEY, {})
}

export function saveOrderSnapshots(orders) {
  if (!Array.isArray(orders) || !orders.length) return
  const store = readOrderSnapshots()
  orders.forEach(order => {
    if (order?.orderId) {
      store[String(order.orderId)] = {
        ...store[String(order.orderId)],
        ...order,
        cachedAt: new Date().toISOString()
      }
    }
  })
  writeJsonStorage(ORDER_SNAPSHOT_STORAGE_KEY, store)
}

function isOrderParticipant(order, userId) {
  return Number(order?.customerId) === Number(userId) || Number(order?.providerUserId) === Number(userId)
}

export function getOrderSnapshotsForUser(userId) {
  return Object.values(readOrderSnapshots()).filter(order => isOrderParticipant(order, userId))
}

export function calculateAverageRating(reviews) {
  const ratings = reviews.map(review => Number(review.rating)).filter(rating => rating > 0)
  if (!ratings.length) return null
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
}

function calculateCompletionRate(orders) {
  const relevant = orders.filter(order => {
    const status = order?.status
    return status === 'COMPLETED' || status === 'CANCELLED' || status === 'REFUNDED' || orderHasArbitration(order.orderId)
  })
  if (!relevant.length) return null
  const successful = relevant.filter(order => order.status === 'COMPLETED' && !orderHasArbitration(order.orderId))
  return Math.round((successful.length / relevant.length) * 100)
}

export function buildProfileStats(userId, reviews = [], orders = []) {
  const receivedReviews = mergeReviewLists(reviews, getLocalReviewsByTarget(userId))
  const relatedOrders = orders.length ? orders : getOrderSnapshotsForUser(userId)
  const rating = calculateAverageRating(receivedReviews)
  return {
    rating,
    reviewCount: receivedReviews.length,
    completionRate: calculateCompletionRate(relatedOrders),
    completedCount: relatedOrders.filter(order => order.status === 'COMPLETED' && !orderHasArbitration(order.orderId)).length
  }
}

export function directionLabel(direction) {
  if (direction === 'CUSTOMER_TO_PROVIDER') return '需求方评价服务方'
  if (direction === 'PROVIDER_TO_CUSTOMER') return '服务方评价需求方'
  return '订单评价'
}

export function readSavedPhotos() {
  return readJsonStorage(SAVED_PHOTO_STORAGE_KEY, [])
    .filter(photo => photo && (
      photo.source === 'conversation-submission' ||
      String(photo.photoId || '').startsWith('message-')
    ))
}

export function readFollows() {
  return readJsonStorage(FOLLOW_STORAGE_KEY, [])
}

export function readUserProfiles() {
  return readJsonStorage(USER_PROFILE_STORAGE_KEY, {})
}

export function saveUserProfile(userId, profile) {
  const profiles = readUserProfiles()
  const id = String(userId)
  profiles[id] = {
    ...profiles[id],
    ...profile,
    userId: Number(userId)
  }
  writeJsonStorage(USER_PROFILE_STORAGE_KEY, profiles)
  return profiles[id]
}

export function getUserProfile(userId, role, moments = []) {
  const id = Number(userId)
  const profiles = readUserProfiles()
  const stored = profiles[String(id)] || {}
  const demoUser = Object.values(USERS).find(user => Number(user.userId) === id)
  const inferredRole = role || stored.role || demoUser?.role || moments.find(moment => Number(moment.authorId) === id)?.authorRole || 'CUSTOMER'
  const nickname = stored.nickname || demoUser?.nickname || `${roleMap[inferredRole] || '用户'} ${id}`
  const bio = stored.bio || stored.description || demoUser?.bio || demoUser?.description || '这个人还没有填写简介。'
  return {
    userId: id,
    role: inferredRole,
    nickname,
    avatarData: stored.avatarData || demoUser?.avatarData || '',
    bio,
    description: bio,
    availability: stored.availability || demoUser?.availability || '暂未填写档期'
  }
}

export function readPortfolioItems(userId) {
  const store = readJsonStorage(PORTFOLIO_STORAGE_KEY, {})
  return store[String(userId)] || []
}

export function addPortfolioItem(userId, item) {
  const store = readJsonStorage(PORTFOLIO_STORAGE_KEY, {})
  const id = String(userId)
  const nextItem = {
    ...item,
    portfolioId: item.portfolioId || `portfolio-${id}-${Date.now()}`,
    createdAt: item.createdAt || new Date().toISOString()
  }
  store[id] = [nextItem, ...(store[id] || [])].slice(0, 80)
  writeJsonStorage(PORTFOLIO_STORAGE_KEY, store)
  return store[id]
}

export function buildPortfolioWorks(userId, moments, portfolioItems = readPortfolioItems(userId)) {
  const uploaded = portfolioItems.map(item => ({
    ...item,
    key: item.portfolioId,
    title: item.title || '作品图片',
    imageData: item.imageData,
    createdAt: item.createdAt
  }))
  const momentWorks = moments
    .filter(moment => Number(moment.authorId) === Number(userId) && moment.imageData)
    .map(moment => ({
      key: `moment-${moment.momentId}`,
      momentId: moment.momentId,
      title: moment.title || '动态作品',
      imageData: moment.imageData,
      createdAt: moment.createdAt
    }))
  return [...uploaded, ...momentWorks]
}

export function isFollowing(authorId) {
  return readFollows().some(follow => Number(follow.authorId) === Number(authorId))
}

export function toggleFollow(authorId) {
  const id = Number(authorId)
  const follows = readFollows()
  const exists = follows.some(follow => Number(follow.authorId) === id)
  const nextFollows = exists
    ? follows.filter(follow => Number(follow.authorId) !== id)
    : [{ authorId: id, followedAt: new Date().toISOString() }, ...follows]
  writeJsonStorage(FOLLOW_STORAGE_KEY, nextFollows)
  return !exists
}

export function formatShortTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

export function formatTime(value) {
  if (!value) return '刚刚'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

export function saveConversationRecord(conversation, meta = {}) {
  const records = readJsonStorage(CONVERSATION_STORAGE_KEY, [])
  const conversationId = String(conversation.conversationId)
  const previous = records.find(record => String(record.conversationId) === conversationId)
  const now = new Date().toISOString()
  const record = {
    ...previous,
    conversationId,
    backendConversationId: conversation.isLocal ? null : Number(conversation.conversationId),
    isLocal: Boolean(conversation.isLocal),
    participantAId: Number(conversation.participantAId ?? meta.customerId ?? USERS.customer.userId),
    participantBId: Number(conversation.participantBId ?? meta.providerUserId ?? meta.providerId ?? USERS.provider.userId),
    sourceType: conversation.sourceType || previous?.sourceType || 'DEMAND_RESPONSE',
    sourceId: conversation.sourceId ?? previous?.sourceId ?? meta.demandId,
    demandId: meta.demandId ?? previous?.demandId ?? conversation.sourceId,
    scene: meta.scene || previous?.scene || `需求 ${meta.demandId || conversation.sourceId || ''}`,
    location: meta.location || previous?.location || '',
    lastMessage: meta.lastMessage || previous?.lastMessage || '点击进入对话',
    interfaceNote: meta.interfaceNote || previous?.interfaceNote || '',
    updatedAt: conversation.lastMessageTime || conversation.updatedAt || conversation.createdAt || now
  }
  const nextRecords = records.filter(item => String(item.conversationId) !== conversationId)
  nextRecords.unshift(record)
  writeJsonStorage(CONVERSATION_STORAGE_KEY, nextRecords)
  return record
}
