import { CITY_OPTIONS, TYPE_OPTIONS } from '../../hall/components/hallUtils.js'

const TIME_TAGS = [
  { label: '近三天', value: 'NEAR_3_DAYS' },
  { label: '近七天', value: 'NEAR_7_DAYS' },
  { label: '近一个月', value: 'NEAR_1_MONTH' }
]

function timeTagText(tags = []) {
  return TIME_TAGS.filter(tag => tags.includes(tag.value)).map(tag => tag.label).join(' / ') || '未选择'
}

export function DemandForm({ form, uploading, onChange, onSubmit, onSaveDraft, onFilesSelected }) {
  const timeTags = Array.isArray(form.timeTags) ? form.timeTags : []

  function toggleTimeTag(value) {
    const next = timeTags.includes(value)
      ? timeTags.filter(item => item !== value)
      : [...timeTags, value]
    onChange('timeTags', next)
  }

  return (
    <form className="form-grid" onSubmit={onSubmit}>
      <article className="panel-card">
        <h1 className="detail-title">发布需求</h1>
        <div className="form-section">
          <h3>基础信息</h3>
          <div className="field-grid">
            <div className="field">
              <label>需求标题</label>
              <input value={form.title || form.scene} onChange={event => onChange('title', event.target.value)} placeholder="例如：想拍一组毕业照" />
            </div>
            <div className="field">
              <label>拍摄类型</label>
              <select value={form.scene} onChange={event => onChange('scene', event.target.value)}>
                {TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>城市</label>
              <select value={form.cityCode} onChange={event => onChange('cityCode', event.target.value)}>
                {CITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>具体地点</label>
              <input value={form.location} onChange={event => onChange('location', event.target.value)} placeholder="例如：南京大学仙林校区" />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>补充说明</h3>
          <div className="field">
            <label>补充说明</label>
            <textarea value={form.description} onChange={event => onChange('description', event.target.value)} placeholder="可以写你想要的氛围、服装、人数、是否需要动作引导等。" />
          </div>
        </div>

        <div className="form-section">
          <h3>预算与时间</h3>
          <div className="field-grid">
            <div className="field">
              <label>预算下限（元）</label>
              <input type="number" min="0" value={form.budgetMinYuan} onChange={event => onChange('budgetMinYuan', event.target.value)} placeholder="300" />
            </div>
            <div className="field">
              <label>预算上限（元）</label>
              <input type="number" min="0" value={form.budgetMaxYuan} onChange={event => onChange('budgetMaxYuan', event.target.value)} placeholder="500" />
            </div>
            <div className="field">
              <label>时间描述（必填）</label>
              <input value={form.timeDescription || form.timeSlot || ''} onChange={event => onChange('timeDescription', event.target.value)} placeholder="例如：本周六下午 / 时间可协商" />
            </div>
          </div>
          <div className="field">
            <label>时间标签（可选，用于筛选）</label>
            <div className="form-tag-choice">
              {TIME_TAGS.map(tag => (
                <button className={`tag ${timeTags.includes(tag.value) ? 'blue' : 'gray'}`} key={tag.value} type="button" onClick={() => toggleTimeTag(tag.value)}>
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>参考风格</h3>
          <div className="upload-grid">
            <label className="upload">
              {uploading ? '上传中...' : '+ 添加参考图'}
              <input type="file" accept="image/*" multiple hidden onChange={event => onFilesSelected?.(event.target.files)} />
            </label>
            <div className="upload upload-summary">{form.referenceFileNames?.[0] || '参考图 01'}</div>
            <div className="upload upload-summary">{form.referenceFileNames?.[1] || '参考图 02'}</div>
          </div>
          {!!form.referenceFileIds?.length && <p className="micro">已上传 {form.referenceFileIds.length} 张，发布时写入 referenceFileIds。</p>}
        </div>
      </article>

      <aside className="panel-card preview-ticket">
        <div className="preview-title">订单预览</div>
        <div className="preview-line"><span>标题</span><b>{form.title || form.scene || '想拍一组毕业照'}</b></div>
        <div className="preview-line"><span>城市</span><b>{CITY_OPTIONS.find(option => option.value === form.cityCode)?.label || form.cityCode}</b></div>
        <div className="preview-line"><span>类型</span><b>{TYPE_OPTIONS.find(option => option.value === form.scene)?.label || form.scene}</b></div>
        <div className="preview-line"><span>预算</span><b>{Number(form.budgetMinYuan) === 0 && Number(form.budgetMaxYuan) === 0 ? '互勉' : `¥${form.budgetMinYuan}-${form.budgetMaxYuan}`}</b></div>
        <div className="preview-line"><span>时间描述</span><b>{form.timeDescription || form.timeSlot || '待沟通'}</b></div>
        <div className="preview-line"><span>时间标签</span><b>{timeTagText(timeTags)}</b></div>
        <button className="primary-btn" type="submit">发布需求</button>
        <button className="secondary-btn draft-btn" type="button" onClick={onSaveDraft}>保存草稿</button>
      </aside>
    </form>
  )
}
