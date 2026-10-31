const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('aftercare visual fixtures are isolated from navigable production pages', () => {
  const root = path.resolve(__dirname, '../entry/src');
  const fixture = fs.readFileSync(path.join(root, 'ohosTest/ets/preview/AftercarePreview.ets'), 'utf8');
  const entry = fs.readFileSync(path.join(root, 'main/ets/preview/AftercarePreviewEntry.ets'), 'utf8');
  const pages = fs.readFileSync(path.join(root, 'main/resources/base/profile/main_pages.json'), 'utf8');
  assert.match(fixture, /公园写真/);
  assert.match(fixture, /AuthorizationSelectionPreview/);
  assert.match(fixture, /ComplaintFormPreview/);
  assert.equal((entry.match(/@Preview/g) || []).length, 6);
  assert.doesNotMatch(entry, /公园写真|仅用于个人作品集/);
  assert.doesNotMatch(pages, /AftercarePreviewEntry/);
});
