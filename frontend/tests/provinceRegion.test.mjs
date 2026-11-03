import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ProvinceCatalog, provinceCode, provinceName, requireProvinceCode } from '../src/common/region/ProvinceCatalog.js'
import { CITY_OPTIONS, cityName } from '../src/pages/hall/components/hallUtils.js'
import { createDefaultDemandForm, buildDemandPayload, demandDetailToForm, validateDemandForm } from '../src/pages/demand/utils/publishFormUtils.js'
import { registerHooks } from 'node:module'
registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context)
  if (url.includes('/frontend/src/') && result.source) {
    return { ...result, source: String(result.source).replaceAll('import.meta.env', '({MODE:"test",VITE_API_BASE_URL:"http://localhost"})') }
  }
  return result
} })
const { createDefaultServicePackageForm, buildServicePackagePayload, servicePackageDetailToForm } = await import('../src/pages/demand/utils/servicePackageFormUtils.js')

test('menus contain exactly the 34 complete province names and code values', () => {
  assert.equal(CITY_OPTIONS.length, 34)
  assert.equal(new Set(CITY_OPTIONS.map(p => p.value)).size, 34)
  assert.equal(ProvinceCatalog.filter(p => p.name.endsWith('省')).length, 23)
  assert.equal(ProvinceCatalog.filter(p => p.name.endsWith('自治区')).length, 5)
  assert.equal(ProvinceCatalog.filter(p => p.name.endsWith('市')).length, 4)
  assert.equal(ProvinceCatalog.filter(p => p.name.endsWith('特别行政区')).length, 2)
  assert.ok(!CITY_OPTIONS.some(p => ['南京', '苏州', '杭州', '深圳'].includes(p.label)))
})
test('old aliases and codes normalize identically for display and API without unknown defaults', () => {
  for (const value of ['JS', 'js', '江苏', '江苏省', '南京', '南京市', 'NJ', 'nj', '320102']) {
    assert.equal(provinceCode(value), 'JS'); assert.equal(cityName(value), '江苏省')
  }
  assert.equal(provinceCode('杭州市'), 'ZJ'); assert.equal(provinceCode('深圳市'), 'GD')
  assert.equal(provinceName('北京'), '北京市'); assert.equal(provinceName('香港'), '香港特别行政区')
  assert.equal(provinceCode('unknown'), ''); assert.equal(provinceCode('320ABC'), '')
  assert.equal(provinceName('unknown'), '未识别地区'); assert.equal(provinceName(''), '地区未填写')
  assert.throws(() => requireProvinceCode('unknown'))
})
test('manual selection and restored/edited demand payloads carry canonical province code', () => {
  const form = { ...createDefaultDemandForm(), cityCode: '南京市', location: '校园' }
  assert.equal(buildDemandPayload(form).cityCode, 'JS')
  assert.equal(buildDemandPayload(form).location, '校园')
  assert.equal(demandDetailToForm({ cityCode: '江苏省' }).cityCode, 'JS')
  assert.equal(demandDetailToForm({ cityCode: 'unknown' }).cityCode, '')
  assert.equal(createDefaultDemandForm().cityCode, '')
  assert.ok(validateDemandForm({ ...form, cityCode: 'unknown' }).some(e => e.includes('省级')))
  assert.throws(() => buildDemandPayload({ ...form, cityCode: '校园' }))
})
test('showcase selection, edit and preview use full labels while preserving service scope separately', () => {
  const form = { ...createDefaultServicePackageForm(), cityCode: '深圳', serviceArea: '校园', basePriceYuan: 100 }
  const payload = buildServicePackagePayload(form)
  assert.equal(payload.cityCode, 'GD'); assert.equal(payload.serviceArea, '校园')
  assert.equal(cityName(payload.cityCode), '广东省')
  assert.equal(servicePackageDetailToForm({ cityCode: '杭州市' }).cityCode, 'ZJ')
  assert.equal(servicePackageDetailToForm({ cityCode: 'unknown' }).cityCode, '')
  assert.equal(createDefaultServicePackageForm().cityCode, '')
  assert.throws(() => buildServicePackagePayload({ ...form, cityCode: 'unknown' }))
})
