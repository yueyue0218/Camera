import assert from 'node:assert/strict'
import test from 'node:test'

let loadProfileSocialLists
try {
  ({ loadProfileSocialLists } = await import('../src/pages/profile/utils/socialCardUtils.js'))
} catch {
  // RED phase: the assertion below reports the missing behavior without aborting test discovery.
}

test('36 profile social cards make zero brief requests', async () => {
  assert.equal(typeof loadProfileSocialLists, 'function')
  const calls = { following: [], brief: 0, avatars: 0 }
  const makeCards = (start, count, currentRole) => Array.from({ length: count }, (_, index) => ({
    userId: start + index,
    nickname: `User ${start + index}`,
    avatarFileId: null,
    currentRole,
    bio: `Bio ${start + index}`,
    followedByCurrentUser: index % 2 === 0
  }))
  const rawFollowers = makeCards(1000, 12, 'CUSTOMER')
  const followingCustomers = makeCards(2000, 12, 'CUSTOMER')
  const followingProviders = makeCards(3000, 12, 'PROVIDER')
  const currentUser = { userId: 99, role: 'CUSTOMER' }
  const userApi = {
    following: async (_userId, _currentUser, role) => {
      calls.following.push(role)
      return role === 'CUSTOMER' ? followingCustomers : followingProviders
    },
    brief: async () => {
      calls.brief += 1
      throw new Error('Profile social cards must not request brief data')
    }
  }
  const fileApi = {
    downloadObjectUrl: async () => {
      calls.avatars += 1
      return 'blob:avatar'
    }
  }

  const result = await loadProfileSocialLists({ rawFollowers, currentUser, userApi, fileApi })

  assert.equal(result.followers.length, 12)
  assert.equal(result.following.length, 24)
  assert.deepEqual(calls.following, ['CUSTOMER', 'PROVIDER'])
  assert.equal(calls.brief, 0)
  assert.equal(calls.avatars, 0)
  assert.deepEqual(result.following.map(card => card.userId), [
    2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011,
    3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010, 3011
  ])
  assert.equal(result.followers[0].role, 'CUSTOMER')
  assert.equal(result.following[12].role, 'PROVIDER')
})
test('social cards download only declared avatars and retain cards when a download fails', async () => {
  assert.equal(typeof loadProfileSocialLists, 'function')
  const avatarCalls = []
  const currentUser = { userId: 99, role: 'CUSTOMER' }
  const rawFollowers = [
    { userId: 1, nickname: 'No avatar', avatarFileId: null, currentRole: 'CUSTOMER', bio: null },
    { userId: 2, nickname: 'Avatar', avatarFileId: 82, currentRole: 'PROVIDER', bio: 'bio' },
    { userId: 3, nickname: 'Broken avatar', avatarFileId: 83, currentRole: 'CUSTOMER', bio: 'bio' }
  ]
  const userApi = { following: async () => [] }
  const fileApi = {
    downloadObjectUrl: async (fileId, passedUser, options) => {
      avatarCalls.push([fileId, passedUser, options?.variant])
      if (fileId === 83) throw new Error('missing file')
      return `blob:${fileId}`
    }
  }

  const result = await loadProfileSocialLists({ rawFollowers, currentUser, userApi, fileApi })

  assert.deepEqual(avatarCalls, [
    [82, currentUser, 'thumbnail'],
    [83, currentUser, 'thumbnail']
  ])
  assert.equal(result.followers[0].avatarData, '')
  assert.equal(result.followers[1].avatarData, 'blob:82')
  assert.equal(result.followers[1].role, 'PROVIDER')
  assert.equal(result.followers[2].avatarData, '')
  assert.equal(result.followers[2].nickname, 'Broken avatar')
})
