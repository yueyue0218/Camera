import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = relativePath => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8')
const occurrences = (text, fragment) => text.split(fragment).length - 1

test('shared hall hooks forward the selected variant without changing failure fallback', async () => {
  const text = await source('src/pages/hall/utils/fileObjectUrls.js')
  assert.match(text, /useFileObjectUrls\(values, currentUser, context = 'image', options = \{\}\)/)
  assert.match(text, /useFileObjectUrl\(values, currentUser, context = 'image', options = \{\}\)/)
  assert.match(text, /useFileObjectUrlState\(value, currentUser, context = 'image', options = \{\}\)/)
  assert.equal(occurrences(text, 'variant: options.variant'), 2)
  assert.match(text, /catch[\s\S]*?return ''/)
})

test('card and avatar contexts request thumbnails', async () => {
  const expectedCounts = new Map([
    ['src/pages/hall/components/DemandCard.jsx', 1],
    ['src/pages/hall/components/ServicePackageCard.jsx', 2],
    ['src/pages/hall/components/HallAside.jsx', 2],
    ['src/pages/profile/ProfilePage.jsx', 1],
    ['src/pages/profile/PublicProfilePage.jsx', 1],
    ['src/pages/profile/utils/socialCardUtils.js', 1],
    ['src/components/reviews/ReviewArchiveCard.jsx', 1],
    ['src/pages/feed/FeedPage.jsx', 2],
    ['src/pages/feed/MomentDetailPage.jsx', 2],
    ['src/pages/messages/utils/participantResolver.js', 1]
  ])

  for (const [path, expected] of expectedCounts) {
    const text = await source(path)
    assert.equal(occurrences(text, "variant: 'thumbnail'"), expected, path)
  }
})

test('detail galleries request medium while detail avatars request thumbnails', async () => {
  const text = await source('src/pages/hall/HallDetailPages.jsx')
  assert.equal(occurrences(text, "variant: 'medium'"), 2)
  assert.equal(occurrences(text, "variant: 'thumbnail'"), 3)
})

test('ServicePackage legacy URL fallback ordering remains intact', async () => {
  const card = await source('src/pages/hall/components/ServicePackageCard.jsx')
  const detail = await source('src/pages/hall/HallDetailPages.jsx')
  assert.match(card, /publicImageUrls\(service\.coverImage, service\.images\)\[0\]/)
  assert.match(detail, /return publicImageUrls\(service\?\.images\)/)
})

test('delivery and order downloads remain on the default original download path', async () => {
  for (const path of [
    'src/pages/deliveries/DeliveryGalleryPage.jsx',
    'src/pages/deliveries/useDeliveryFilePreviews.js',
    'src/pages/orders/OrdersPage.jsx'
  ]) {
    const text = await source(path)
    assert.match(text, /downloadObjectUrl\(/, path)
    assert.doesNotMatch(text, /variant:\s*'(?:thumbnail|medium|original)'/, path)
  }
})
