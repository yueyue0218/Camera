const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

test('quote and order preview fixtures stay outside production pages', () => {
  const root = path.resolve(__dirname, '../entry/src');
  const fixture = fs.readFileSync(path.join(root, 'ohosTest/ets/preview/QuoteOrderPreview.ets'), 'utf8');
  const entry = fs.readFileSync(path.join(root, 'main/ets/preview/QuoteOrderPreviewEntry.ets'), 'utf8');
  assert.match(fixture, /城市公园南门/);
  assert.match(fixture, /status: 'PENDING_CONFIRM'/);
  assert.match(fixture, /status: 'CONFIRMED'/);
  assert.match(fixture, /status: 'REJECTED'/);
  assert.match(entry, /@Preview/);
  assert.doesNotMatch(entry, /城市公园南门|双人写真，含/);
  const pageIndex = fs.readFileSync(path.join(root, 'main/resources/base/profile/main_pages.json'), 'utf8');
  assert.doesNotMatch(pageIndex, /QuoteOrderPreviewEntry/);
});
