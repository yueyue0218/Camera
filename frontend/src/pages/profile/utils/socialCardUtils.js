async function hydrateSocialCards(cards, currentUser, fileApi, fallbackRole) {
  return Promise.all((cards || []).map(async card => {
    const role = card.role || fallbackRole || card.currentRole
    const existingAvatar = card.avatarData || card.avatarUrl || ''
    if (existingAvatar || !card.avatarFileId) {
      return { ...card, role, avatarData: existingAvatar }
    }

    let avatarData = ''
    try {
      avatarData = await fileApi.downloadObjectUrl(card.avatarFileId, currentUser, { variant: 'thumbnail' })
    } catch {
      // A missing avatar must not remove an otherwise valid social card.
    }
    return { ...card, role, avatarData }
  }))
}
export async function loadProfileSocialLists({ rawFollowers, currentUser, userApi, fileApi }) {
  const [followingCustomers, followingProviders] = await Promise.all([
    userApi.following(currentUser.userId, currentUser, 'CUSTOMER').catch(() => []),
    userApi.following(currentUser.userId, currentUser, 'PROVIDER').catch(() => [])
  ])

  const [followers, customerCards, providerCards] = await Promise.all([
    hydrateSocialCards(rawFollowers, currentUser, fileApi),
    hydrateSocialCards(followingCustomers, currentUser, fileApi, 'CUSTOMER'),
    hydrateSocialCards(followingProviders, currentUser, fileApi, 'PROVIDER')
  ])

  return {
    followers,
    following: [...customerCards, ...providerCards]
  }
}
