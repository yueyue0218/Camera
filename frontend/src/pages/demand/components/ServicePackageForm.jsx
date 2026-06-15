import { Alert } from '@mui/material'
import { CITY_OPTIONS, TYPE_OPTIONS } from '../../hall/components/hallUtils.js'

const TIME_TAGS = [
  { label: '近三天', value: 'NEAR_3_DAYS' },
  { label: '近七天', value: 'NEAR_7_DAYS' },
  { label: '近一个月', value: 'NEAR_1_MONTH' }
]

function splitTags(value) {
  return String(value || '').split(/[\n,，]/).map(item => item.trim()).filter(Boolean)
}

function joinTags(tags) {
  return tags.join(',')
}

function timeTagText(value) {
  const tags = splitTags(value)
  return TIME_TAGS.filter(tag => tags.includes(tag.value)).map(tag => tag.label).join(' / ') || '未选择'
}

export function ServicePackageForm({ form, errors, uploading, onChange, onSubmit, onSaveDraft, onFilesSelected, onRemoveFile, mode = 'create' }) {
  const selectedTimeTags = splitTags(form.timeTagsText)
  const portfolioItems = (form.portfolioIds || []).map((fileId, index) => ({
    fileId,
    name: form.portfolioFileNames?.[index] || `作品 ${index + 1}`,
    previewUrl: form.portfolioPreviewUrls?.[index] || ''
  }))

  function toggleTimeTag(value) {
    const next = selectedTimeTags.includes(value)
      ? selectedTimeTags.filter(item => item !== value)
      : [...selectedTimeTags, value]
    onChange('timeTagsText', joinTags(next))
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <article className="panel-card">
        <h1 className="detail-title">{mode === 'edit' ? '编辑橱窗' : '发布橱窗'}</h1>
        {!!errors.length && (
          <Alert severity="warning" className="form-alert">
            {errors.map(error => <div key={error}>{error}</div>)}
          </Alert>
        )}
        <div className="form-section">
          <h3>基础信息</h3>
          <div className="field-grid">
            <div className="field">
              <label>橱窗标题</label>
              <input value={form.title} onChange={event => onChange('title', event.target.value)} placeholder="例如：清透校园写真 / 南京可约" />
            </div>
            <div className="field">
              <label>城市</label>
              <select value={form.cityCode} onChange={event => onChange('cityCode', event.target.value)}>
                {CITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>服务区域</label>
              <input value={form.serviceArea} onChange={event => onChange('serviceArea', event.target.value)} placeholder="仙林 / 鼓楼 / 可协商" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>服务类型</h3>
          <div className="field-grid">
            <div className="field">
              <label>拍摄类型</label>
              <select value={form.scene} onChange={event => onChange('scene', event.target.value)}>
                {TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>风格标签</label>
              <input value={form.styleTagsText} onChange={event => onChange('styleTagsText', event.target.value)} placeholder="清透日常,校园毕业" />
            </div>
          </div>
          <div className="field">
            <label>服务说明</label>
            <textarea value={form.description} onChange={event => onChange('description', event.target.value)} placeholder="介绍你的拍摄风格、适合人群、沟通方式。" />
          </div>
        </div>

        <div className="form-section">
          <h3>价格与时间</h3>
          <div className="field-grid">
            <div className="field">
              <label>价格下限（元）</label>
              <input type="number" value={form.basePriceYuan} onChange={event => onChange('basePriceYuan', event.target.value)} placeholder="299" />
            </div>
            <div className="field">
              <label>价格上限（元）</label>
              <input type="number" value={form.maxPriceYuan} onChange={event => onChange('maxPriceYuan', event.target.value)} placeholder="699" />
            </div>
            <div className="field">
              <label>时间描述（必填）</label>
              <input value={form.timeDescription} onChange={event => onChange('timeDescription', event.target.value)} placeholder="例如：近三天可约，具体时间私信沟通" />
            </div>
            <div className="field">
              <label>时间标签（可选，用于筛选）</label>
              <div className="form-tag-choice">
                {TIME_TAGS.map(tag => (
                  <button className={`tag ${selectedTimeTags.includes(tag.value) ? 'blue' : 'gray'}`} key={tag.value} type="button" onClick={() => toggleTimeTag(tag.value)}>
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>作品上传</h3>
          <div className="upload-grid">
            <label className="upload">
              {uploading ? '上传中...' : `+ 封面 / 作品集 (${portfolioItems.length}/9)`}
              <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={event => { onFilesSelected?.(event.target.files); event.target.value = '' }} />
            </label>
            {portfolioItems.map((item, index) => (
              <div className="upload-thumb" key={`${item.fileId}-${index}`}>
                {item.previewUrl ? <img src={item.previewUrl} alt={item.name} /> : <span>{item.name}</span>}
                <button type="button" onClick={() => onRemoveFile?.(index)}>删除</button>
              </div>
            ))}
          </div>
          {!!portfolioItems.length && <p className="micro">已上传 {portfolioItems.length} 张，发布时写入 portfolioIds。</p>}
        </div>
      </article>

      <aside className="panel-card preview-ticket">
        <div className="placeholder-cover"></div>
        <div className="preview-title">橱窗预览</div>
        <div className="preview-line"><span>标题</span><b>{form.title || '清透校园写真'}</b></div>
        <div className="preview-line"><span>类型</span><b>{TYPE_OPTIONS.find(option => option.value === form.scene)?.label || form.scene}</b></div>
        <div className="preview-line"><span>价格</span><b>¥{form.basePriceYuan || 0}-{form.maxPriceYuan || 0}</b></div>
        <div className="preview-line"><span>时间描述</span><b>{form.timeDescription || '近三天可约'}</b></div>
        <div className="preview-line"><span>时间标签</span><b>{timeTagText(form.timeTagsText)}</b></div>
        <button className="primary-btn" type="submit" disabled={uploading}>{mode === 'edit' ? '保存橱窗' : '发布橱窗'}</button>
        {mode !== 'edit' && <button className="secondary-btn draft-btn" type="button" onClick={onSaveDraft} disabled={uploading}>保存草稿</button>}
      </aside>
    </form>
  )
}
