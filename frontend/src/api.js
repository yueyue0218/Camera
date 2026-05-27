const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname || 'localhost'}:8080`

async function request(path, options = {}, currentUser) {
  const headers = {
    'Content-Type': 'application/json',
    ...(currentUser?.token ? {
      Authorization: `Bearer ${currentUser.token}`
    } : {}),
    ...(currentUser ? {
      'X-User-Id': String(currentUser.userId),
      'X-User-Role': currentUser.role
    } : {}),
    ...(options.headers || {})
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch (error) {
    const networkError = new Error(`无法连接后端服务（${API_BASE}）。请确认后端已启动，且前端地址已被后端 CORS 放行。`)
    networkError.cause = error
    networkError.isNetworkError = true
    throw networkError
  }
  const payload = await parsePayload(response)
  const hasResultEnvelope = payload && Object.prototype.hasOwnProperty.call(payload, 'code')
  if (!response.ok || (hasResultEnvelope && Number(payload.code) !== 200)) {
    const error = new Error(payload.message || '请求失败')
    error.status = response.status
    error.code = payload.code
    error.payload = payload
    throw error
  }
  return hasResultEnvelope ? payload.data : payload
}

async function parsePayload(response) {
  const text = await response.text()
  if (!text) {
    return { code: response.status, message: response.statusText, data: null }
  }
  try {
    return JSON.parse(text)
  } catch {
    return { code: response.status, message: text || response.statusText, data: null }
  }
}

export const authApi = {
  sendCode(email) {
    return request('/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) })
  },
  async register(body) {
    const registerPaths = ['/users/register', '/auth/register']
    const registerBody = {
      ...body,
      code: body.code || body.verifyCode
    }
    delete registerBody.verifyCode
    let fallbackError = null

    for (const path of registerPaths) {
      try {
        return await request(path, { method: 'POST', body: JSON.stringify(registerBody) })
      } catch (error) {
        fallbackError = error
        const endpointMissing = error.status === 404
          || (error.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
        const backendUnavailable = error.name === 'TypeError'
        if (!endpointMissing && !backendUnavailable) {
          throw error
        }
      }
    }

    fallbackError = fallbackError || new Error('注册接口暂不可用')
    fallbackError.canUseDemoRegister = true
    throw fallbackError
  },
  async login(body) {
    if (body.loginType === 'MOBILE') {
      try {
        return await request('/sessions', { method: 'POST', body: JSON.stringify(body) })
      } catch (error) {
        const endpointMissing = error.status === 404
          || (error.code === 50001 && /No static resource|No endpoint|not found/i.test(error.message || ''))
        const sessionsStillProtected = error.code === 40101
        if (endpointMissing || sessionsStillProtected || error.isNetworkError) {
          error.canUseDemoLogin = true
        }
        throw error
      }
    }

    const error = new Error('当前登录页仅支持手机号验证码登录')
    error.canUseDemoLogin = true
    throw error
  }
}

export const userApi = {
  me(currentUser) {
    return request('/users/me', {}, currentUser)
  },
  brief(userId, currentUser) {
    return request(`/users/${userId}/brief`, {}, currentUser)
  }
}

export const demandApi = {
  list(params = {}, currentUser) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value)
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request(`/demands${suffix}`, {}, currentUser)
  },
  create(body, currentUser) {
    return request('/demands', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  detail(demandId, currentUser) {
    return request(`/demands/${demandId}`, {}, currentUser)
  },
  delete(demandId, currentUser) {
    return request(`/demands/${demandId}`, { method: 'DELETE' }, currentUser)
  },
  respond(demandId, body, currentUser) {
    return request(`/demands/${demandId}/responses`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  responses(demandId, currentUser) {
    return request(`/demands/${demandId}/responses`, {}, currentUser)
  },
  accept(demandId, responseId, currentUser) {
    return request(`/demands/${demandId}/responses/${responseId}/accept`, { method: 'POST' }, currentUser)
  },
  invite(demandId, body, currentUser) {
    return request(`/demands/${demandId}/invitations`, { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  invitations(currentUser) {
    return request('/demands/invitations/received', {}, currentUser)
  },
  sentInvitations(currentUser) {
    return request('/demands/invitations/sent', {}, currentUser)
  },
  acceptInvitation(invitationId, currentUser) {
    return request(`/demands/invitations/${invitationId}/accept`, { method: 'POST' }, currentUser)
  },
  rejectInvitation(invitationId, currentUser) {
    return request(`/demands/invitations/${invitationId}/reject`, { method: 'POST' }, currentUser)
  }
}

export const momentApi = {
  list(params = {}, currentUser) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value)
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request(`/moments${suffix}`, {}, currentUser)
  },
  create(body, currentUser) {
    return request('/moments', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  detail(momentId, currentUser) {
    return request(`/moments/${momentId}`, {}, currentUser)
  },
  like(momentId, currentUser) {
    return request(`/moments/${momentId}/like`, { method: 'POST' }, currentUser)
  },
  favorite(momentId, currentUser) {
    return request(`/moments/${momentId}/favorite`, { method: 'POST' }, currentUser)
  },
  delete(momentId, currentUser) {
    return request(`/moments/${momentId}`, { method: 'DELETE' }, currentUser)
  }
}

export const messageApi = {
  list(currentUser) {
    return request('/messages', {}, currentUser)
  },
  send(body, currentUser) {
    return request('/messages', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  }
}

export const conversationApi = {
  list(currentUser) {
    return request('/conversations', {}, currentUser)
  },
  createFromResponse(snapshot, currentUser) {
    return request('/conversations/from-response', {
      method: 'POST',
      body: JSON.stringify({
        responseId: snapshot.responseId,
        demandId: snapshot.demandId,
        customerId: snapshot.customerId,
        providerUserId: snapshot.providerUserId || snapshot.providerId,
        status: snapshot.status || snapshot.responseStatus || 'ACCEPTED'
      })
    }, currentUser)
  },
  messages(conversationId, currentUser) {
    return request(`/conversations/${conversationId}/messages`, {}, currentUser)
  },
  sendMessage(conversationId, content, currentUser, messageType = 'TEXT') {
    return request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ messageType, content })
    }, currentUser)
  },
  quotes(conversationId, currentUser, status) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : ''
    return request(`/conversations/${conversationId}/quotations${suffix}`, {}, currentUser)
  }
}

export const quoteApi = {
  create(body, currentUser) {
    return request('/quotations', { method: 'POST', body: JSON.stringify(body) }, currentUser)
  },
  confirm(quotationId, confirmRemark, currentUser) {
    return request(`/quotations/${quotationId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ confirmRemark })
    }, currentUser)
  },
  reject(quotationId, rejectReason, currentUser) {
    return request(`/quotations/${quotationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectReason })
    }, currentUser)
  }
}

export const orderApi = {
  list(params = {}, currentUser) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value)
    })
    const suffix = query.toString() ? `?${query.toString()}` : ''
    return request(`/orders${suffix}`, {}, currentUser)
  },
  detail(orderId, currentUser) {
    return request(`/orders/${orderId}`, {}, currentUser)
  },
  statusLogs(orderId, currentUser) {
    return request(`/orders/${orderId}/status-logs`, {}, currentUser)
  },
  mockPay(orderId, amountCent, currentUser) {
    return request(`/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ payMethod: 'MOCK_PAY', amountCent })
    }, currentUser)
  },
  transition(orderId, targetStatus, reason, currentUser) {
    return request(`/orders/${orderId}/status-transitions`, {
      method: 'POST',
      body: JSON.stringify({ targetStatus, reason })
    }, currentUser)
  }
}

export const reviewApi = {
  listByOrder(orderId, currentUser) {
    return request(`/orders/${orderId}/reviews`, {}, currentUser)
  },
  create(orderId, body, currentUser) {
    return request(`/orders/${orderId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listByUser(userId, currentUser) {
    return request(`/users/${userId}/reviews`, {}, currentUser)
  }
}

export const reviewComplaintApi = {
  create(reviewId, body, currentUser) {
    return request(`/reviews/${reviewId}/complaints`, {
      method: 'POST',
      body: JSON.stringify(body)
    }, currentUser)
  },
  listMine(currentUser) {
    return request('/reviews/complaints/my', {}, currentUser)
  },
  listByReview(reviewId, currentUser) {
    return request(`/reviews/${reviewId}/complaints`, {}, currentUser)
  },
  cancel(complaintId, currentUser) {
    return request(`/reviews/complaints/${complaintId}/cancel`, { method: 'POST' }, currentUser)
  }
}

export const creditApi = {
  summary(userId, currentUser) {
    return request(`/users/${userId}/credit`, {}, currentUser)
  },
  records(userId, currentUser) {
    return request(`/users/${userId}/credit-records`, {}, currentUser)
  }
}

export function yuanToCent(value) {
  if (value === '' || value === null || value === undefined) return null
  return Math.round(Number(value) * 100)
}

export function centToYuan(value) {
  if (value === null || value === undefined) return '未填写'
  return `¥${(value / 100).toFixed(2)}`
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('照片读取失败'))
    reader.readAsDataURL(file)
  })
}
