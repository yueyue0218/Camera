import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { request } from '../api/client.js'
import { getOrCreateDeviceId } from '../auth/phoneAuth.js'
import { consentDecision, hasCurrentConsent } from './consentPolicy.js'
import { PRIVACY_POLICY_SECTIONS, CROSS_BORDER_CONSENT_SECTIONS } from './LegalContent.js'

export default function PrivacyGate({ currentUser, logout, children }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [policy, setPolicy] = useState(false)
  const [crossBorder, setCrossBorder] = useState(false)
  const [settings, setSettings] = useState(false)
  const reload = useCallback(async () => {
    setState(null)
    setError('')
    try { setState(await request('/privacy/consent', {}, currentUser)) }
    catch (failure) { setError(failure.message) }
  }, [currentUser])
  useEffect(() => {
    let active = true
    request('/privacy/consent', {}, currentUser)
      .then(value => { if (active) setState(value) })
      .catch(failure => { if (active) setError(failure.message) })
    const required = () => { setState(null); setPolicy(false); setCrossBorder(false); setSettings(true); reload() }
    window.addEventListener('portra:consent-required', required)
    return () => { active = false; window.removeEventListener('portra:consent-required', required) }
  }, [currentUser, reload])
  async function decide(status) {
    if (status === 'GRANTED' && (!policy || !crossBorder)) return
    setBusy(true); setError('')
    try {
      const value = await request('/privacy/consent', { method: 'PUT',
        body: JSON.stringify(consentDecision(status, getOrCreateDeviceId())) }, currentUser)
      setState(value); setSettings(false); setPolicy(false); setCrossBorder(false)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  if (hasCurrentConsent(state) && !settings) return <>
    {children}
    <Button onClick={() => setSettings(true)} sx={{ position: 'fixed', bottom: 8, right: 12, zIndex: 1200 }}>隐私与授权</Button>
  </>
  return <Box sx={{ maxWidth: 760, mx: 'auto', p: 3 }}><Paper sx={{ p: 3 }}><Stack spacing={2}>
    <Typography variant="h5">隐私与个人信息出境授权</Typography>
    <Typography>Web 与 HarmonyOS 共用账号授权。相关业务信息在中国香港处理和存储。请分别阅读并确认以下文件；不选择或仅浏览不会记录同意。</Typography>
    {state?.status === 'WITHDRAWN' && <Alert severity="info">你已撤回同意。业务功能暂停，权利申请和退出登录仍可使用。重新同意不会自动恢复已下线内容。</Alert>}
    {!state && !error && <Typography role="status">正在核实账户授权；业务内容暂不加载。</Typography>}
    {error && <Alert severity="error">{error}</Alert>}
    {[["隐私政策", PRIVACY_POLICY_SECTIONS], ["个人信息出境单独同意书", CROSS_BORDER_CONSENT_SECTIONS]].map(([title, sections]) =>
      <details key={title}><summary>{title}</summary>{sections.map(section => <section key={section.title}>
        <Typography variant="subtitle1">{section.title}</Typography><Typography sx={{ whiteSpace: 'pre-line', mb: 2 }}>{section.body}</Typography>
      </section>)}</details>)}
    <FormControlLabel control={<Checkbox checked={policy} onChange={e => setPolicy(e.target.checked)} />} label="我已阅读并同意隐私政策" />
    <FormControlLabel control={<Checkbox checked={crossBorder} onChange={e => setCrossBorder(e.target.checked)} />} label="我单独同意个人信息出境处理" />
    <Button variant="contained" disabled={busy || !state || !policy || !crossBorder} onClick={() => decide('GRANTED')}>明确同意并继续</Button>
    {hasCurrentConsent(state) && <Button color="warning" disabled={busy} onClick={() => decide('WITHDRAWN')}>撤回同意并暂停业务</Button>}
    <Button onClick={reload} disabled={busy}>重新核实授权状态</Button>
    <PrivacyRights currentUser={currentUser} />
    <Button onClick={logout} disabled={busy}>暂不同意，退出登录</Button>
    {hasCurrentConsent(state) && <Button onClick={() => setSettings(false)}>返回业务</Button>}
  </Stack></Paper></Box>
}

function PrivacyRights({ currentUser }) {
  const [description, setDescription] = useState('')
  const [type, setType] = useState('ACCESS')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  async function submit() {
    setPending(true)
    try {
      await request('/privacy/rights', { method: 'POST', body: JSON.stringify({ type, description,
        idempotencyKey: window.crypto.randomUUID() }) }, currentUser)
      setMessage('申请已提交。处理状态可通过下方按钮查询。'); setDescription('')
    } catch (failure) { setMessage(failure.message) }
    finally { setPending(false) }
  }
  async function list() {
    try {
      const result = await request('/privacy/rights', {}, currentUser)
      setMessage(result.records?.map(item => `#${item.id} ${item.type}：${item.status}`).join('；') || '暂无申请')
    } catch (failure) { setMessage(failure.message) }
  }
  return <details><summary>个人信息权利申请（无需同意业务授权）</summary><Stack spacing={1}>
    <label>申请类型 <select value={type} onChange={e => setType(e.target.value)}>
      <option value="ACCESS">查询</option><option value="COPY">复制</option><option value="CORRECT">更正</option><option value="DELETE">删除</option>
    </select></label>
    <label>申请说明 <textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    <Button disabled={pending || !description.trim()} onClick={submit}>提交权利申请</Button><Button onClick={list}>查询申请状态</Button>
    <Typography role="status">{message}</Typography>
  </Stack></details>
}
