const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');

for (const config of ['infra/staging/nginx/portra.conf', 'deploy/nginx/camera.conf']) {
  test(`${config}: privacy API routes reach the backend with their original path`, () => {
    const source = fs.readFileSync(path.join(root, config), 'utf8');
    const match = source.match(/location ~ (\^\/\([^\n]+) \{([\s\S]*?)\n\s*\}/);
    assert.ok(match);
    const route = new RegExp(match[1]);
    for (const url of ['/privacy/consent', '/privacy/rights', '/privacy/account-closure',
      '/privacy/account-closure/code', '/auth/native/refresh', '/orders']) assert.ok(route.test(url), url);
    for (const url of ['/privacy-policy', '/privacy-admin', '/privacyconsent']) assert.equal(route.test(url), false, url);
    assert.match(match[2], /proxy_pass http:\/\/127\.0\.0\.1:8080;/);
    assert.ok(match.index < source.indexOf('location / {'));
  });
}

test('reviewed Nginx byte hash stays consistent with the privileged helper', () => {
  const config = fs.readFileSync(path.join(root, 'infra/staging/nginx/portra.conf'));
  const helper = fs.readFileSync(path.join(root, 'infra/staging/scripts/deploy-infra-root.sh'), 'utf8');
  assert.equal(helper.match(/readonly approved_nginx_shared_sha256=([0-9a-f]{64})/)[1],
    crypto.createHash('sha256').update(config).digest('hex'));
});
