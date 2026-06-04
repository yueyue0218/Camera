import { Alert } from '@mui/material'

const CITY_OPTIONS = [
  { label: '南京大学', value: 'NJU' },
  { label: '南京', value: 'NJ' },
  { label: '上海', value: 'SH' }
]

const SCENE_OPTIONS = [
  { label: '毕业照', value: 'GRADUATION' },
  { label: '个人写真', value: 'PORTRAIT' },
  { label: '情侣纪念', value: 'COUPLE' }
]

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

export function ServicePackageForm({ form, errors, onChange, onSubmit, onSaveDraft }) {
  const selectedTimeTags = splitTags(form.timeTagsText)

  function toggleTimeTag(value) {
    const next = selectedTimeTags.includes(value)
      ? selectedTimeTags.filter(item => item !== value)
      : [...selectedTimeTags, value]
    onChange('timeTagsText', joinTags(next))
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <article className="panel-card">
        <h1 className="detail-title">发布橱窗</h1>
        {!!errors.length && (
          <Alert severity="warning" className="form-alert">
            {errors.map(error => <div key={error}>{error}</div>)}
          </Alert>
        )}
        <div className="form-section">
          <h3>基础身份</h3>
          <div className="field-grid">
            <div className="field">
              <label>橱窗标题</label>
              <input value={form.title} onChange={event => onChange('title', event.target.value)} placeholder="例如：清透校园写真 / 南京可约" />
            </div>
            <div className="field">
              <label>身份角色</label>
              <select value="摄影师" onChange={() => {}}>
                <option>摄影师</option>
                <option>化妆师</option>
                <option>妆造 + 摄影团队</option>
              </select>
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
          <h3>服务风格</h3>
          <div className="tag-row">
            <span className="tag blue">清透日常</span>
            <span className="tag gray">胶片复古</span>
            <span className="tag gray">校园毕业</span>
            <span className="tag gray">情侣纪念</span>
          </div>
          <div className="field-grid">
            <div className="field">
              <label>拍摄类型</label>
              <select value={form.scene} onChange={event => onChange('scene', event.target.value)}>
                {SCENE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
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
              <label>基础套餐价格</label>
              <input type="number" value={form.basePriceYuan} onChange={event => onChange('basePriceYuan', event.target.value)} placeholder="299" />
            </div>
            <div className="field">
              <label>标准套餐价格</label>
              <input value={form.priceRange} onChange={event => onChange('priceRange', event.target.value)} placeholder="499-699" />
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
            <div className="upload">+ 封面作品</div>
            <div className="upload">+ 作品集</div>
            <div className="upload">+ 作品集</div>
          </div>
        </div>
      </article>

      <aside className="panel-card preview-ticket">
        <div className="placeholder-cover"></div>
        <div className="preview-title">橱窗预览</div>
        <div className="preview-line"><span>标题</span><b>{form.title || '清透校园写真'}</b></div>
        <div className="preview-line"><span>身份</span><b>摄影师</b></div>
        <div className="preview-line"><span>价格</span><b>¥{form.basePriceYuan || 0} 起</b></div>
        <div className="preview-line"><span>时间描述</span><b>{form.timeDescription || '近三天可约'}</b></div>
        <div className="preview-line"><span>时间标签</span><b>{timeTagText(form.timeTagsText)}</b></div>
        <button className="primary-btn" type="submit">发布橱窗</button>
        <button className="secondary-btn draft-btn" type="button" onClick={onSaveDraft}>保存草稿</button>
      </aside>
    </form>
  )
}
