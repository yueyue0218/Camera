import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { authApi } from '../../api.js'
import filmSpringUrl from '../../assets/film-spring.png'
import filmLibraryUrl from '../../assets/film-library.png'
import filmSummerUrl from '../../assets/film-summer.png'
import filmPhotoClubUrl from '../../assets/film-photo-club.png'
import filmAutumnUrl from '../../assets/film-autumn.png'
import filmWinterUrl from '../../assets/film-winter.png'

/* ── Design tokens ─────────────────────────────────────────── */
const BLUE   = '#0d2fb2'
const BLUE2  = '#092585'
const YELLOW = '#f7ce3a'
const ORANGE = '#f85104'
const INK    = '#111015'
const PAPER  = '#f2ede6'
const MUTED  = '#60646c'
const BG     = '#e6e2e0'
const WARM   = '#fffaf2'

const SERIF = '"Bodoni 72","Didot","Bodoni MT",Georgia,serif'
const SANS  = '"Avenir Next","Helvetica Neue",Arial,"Noto Sans SC","PingFang SC",sans-serif'
const FILMS = [filmSpringUrl, filmLibraryUrl, filmSummerUrl, filmPhotoClubUrl, filmAutumnUrl, filmWinterUrl]

/* ── Keyframe injection (runs once) ────────────────────────── */
function usePortraStyles() {
  useEffect(() => {
    if (document.getElementById('portra-auth-kf')) return
    const el = document.createElement('style')
    el.id = 'portra-auth-kf'
    el.textContent = `
      @keyframes portraSlide {
        from { transform: translateX(0) }
        to   { transform: translateX(-50%) }
      }
      @keyframes portraIn {
        from { opacity: 0; transform: translateY(18px) scale(.97) }
        to   { opacity: 1; transform: none }
      }
    `
    document.head.appendChild(el)
  }, [])
}

/* ── Shared primitives ─────────────────────────────────────── */

function Wordmark({ size = 28 }) {
  return (
    <div style={{ fontFamily: SERIF, fontSize: size, lineHeight: .88, letterSpacing: '-.04em', userSelect: 'none' }}>
      Por<span style={{ color: BLUE }}>t</span>r<span style={{ color: ORANGE }}>a</span>
    </div>
  )
}

function AuthCard({ children }) {
  return (
    <div style={{
      position: 'relative',
      width: 'min(480px, 94vw)',
      background: PAPER,
      clipPath: 'polygon(0 0, 100% 0, 100% 93%, 95% 100%, 0 100%)',
      boxShadow: '0 40px 80px rgba(17,16,21,.24), 0 0 0 1px rgba(17,16,21,.10)',
      overflow: 'hidden',
      fontFamily: SANS,
      animation: 'portraIn .32s cubic-bezier(.22,1,.36,1) both'
    }}>
      {/* left blue stripe */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: BLUE, zIndex: 2 }} />
      {/* top barcode strip */}
      <div style={{
        height: 9, marginLeft: 7,
        background: 'repeating-linear-gradient(90deg, rgba(17,16,21,.26) 0 1px, transparent 1px 10px)'
      }} />
      <div style={{ padding: '30px 38px 44px 46px' }}>
        {children}
      </div>
    </div>
  )
}

function FocusInput({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e =>  { setFocused(false); props.onBlur?.(e) }}
      style={{
        width: '100%', boxSizing: 'border-box',
        border: `1px solid ${focused ? 'rgba(13,47,178,.5)' : 'rgba(17,16,21,.14)'}`,
        boxShadow: focused ? '0 0 0 3px rgba(13,47,178,.09)' : 'none',
        borderRadius: 14, background: WARM,
        padding: '13px 16px', outline: 'none',
        fontSize: 14, fontFamily: SANS, color: INK,
        transition: 'border-color .18s, box-shadow .18s',
        ...style
      }}
    />
  )
}

function FieldLabel({ label, htmlFor }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: 'block', fontSize: 11, color: MUTED,
      letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 7, fontFamily: SANS
    }}>{label}</label>
  )
}

function PrimaryBtn({ children, onClick, loading, disabled }) {
  const [hov, setHov] = useState(false)
  const dis = disabled || loading
  return (
    <button
      type="button" onClick={onClick} disabled={dis}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: 52, border: 0, borderRadius: 999,
        background: dis ? '#9ea3ab' : hov ? BLUE2 : BLUE,
        color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: '.16em',
        fontFamily: SANS,
        boxShadow: dis ? 'none' : '0 12px 26px rgba(13,47,178,.22)',
        cursor: dis ? 'default' : 'pointer',
        transform: (!dis && hov) ? 'translateY(-1px)' : 'none',
        transition: 'background .2s, transform .2s, box-shadow .2s',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10
      }}
    >
      {loading ? '处理中…' : children}
      {!dis && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: ORANGE, boxShadow: '0 0 0 3px rgba(248,81,4,.16)', flexShrink: 0
        }} />
      )}
    </button>
  )
}

function ErrorBanner({ text }) {
  if (!text) return null
  return (
    <div style={{
      marginBottom: 14, padding: '10px 14px',
      background: 'rgba(248,81,4,.08)', border: '1px solid rgba(248,81,4,.22)',
      borderRadius: 12, color: '#c53b05', fontSize: 13, letterSpacing: '.04em', fontFamily: SANS
    }}>{text}</div>
  )
}

function SuccessBanner({ text }) {
  if (!text) return null
  return (
    <div style={{
      marginBottom: 14, padding: '10px 14px',
      background: 'rgba(13,47,178,.06)', border: '1px solid rgba(13,47,178,.18)',
      borderRadius: 12, color: BLUE, fontSize: 13, letterSpacing: '.04em', fontFamily: SANS
    }}>{text}</div>
  )
}

function RoleToggle({ value, onChange }) {
  const options = [
    { key: 'CUSTOMER', label: '单主', hint: '我想拍照' },
    { key: 'PROVIDER', label: '摄影师', hint: '我来拍' }
  ]
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
      {options.map(o => (
        <button
          key={o.key} type="button" onClick={() => onChange(o.key)}
          style={{
            flex: 1, border: `1px solid ${value === o.key ? BLUE : 'rgba(17,16,21,.14)'}`,
            borderRadius: 14, padding: '11px 10px',
            background: value === o.key ? 'rgba(13,47,178,.06)' : WARM,
            cursor: 'pointer', fontFamily: SANS, textAlign: 'center',
            transition: 'border-color .18s, background .18s'
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: value === o.key ? BLUE : INK, marginBottom: 3 }}>
            {o.label}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{o.hint}</div>
        </button>
      ))}
    </div>
  )
}

function SwitchLine({ prompt, linkText, onClick }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: MUTED, fontFamily: SANS }}>
      {prompt}
      <span
        onClick={onClick}
        style={{
          color: BLUE, fontWeight: 700, cursor: 'pointer', marginLeft: 4,
          textDecoration: 'underline', textDecorationColor: 'rgba(13,47,178,.3)'
        }}
      >
        {linkText}
      </span>
    </div>
  )
}

function BackLink({ label, onClick }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 10 }}>
      <span
        onClick={onClick}
        style={{ fontSize: 12, color: MUTED, cursor: 'pointer', letterSpacing: '.06em', fontFamily: SANS }}
      >
        ← {label}
      </span>
    </div>
  )
}

/* ── Filmstrip ─────────────────────────────────────────────── */

function Filmstrip() {
  const h = 'clamp(120px, 16vh, 188px)'
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: h,
      overflow: 'hidden', zIndex: 0,
      background: 'linear-gradient(90deg, rgba(230,226,224,.96) 0%, transparent 14%, transparent 86%, rgba(230,226,224,.96))'
    }}>
      <div style={{
        display: 'flex', height: '100%', width: 'max-content',
        animation: 'portraSlide 36s linear infinite'
      }}>
        {[0, 1].map(reel => (
          <div key={reel} style={{
            display: 'flex', alignItems: 'center', height: '100%', width: '100vw',
            flexShrink: 0, position: 'relative',
            background: 'linear-gradient(180deg, #3f5559 0%, #253438 54%, #3f5559 100%)',
            borderTop: '3px solid rgba(242,237,230,.86)'
          }}>
            {/* sprocket holes */}
            {['top', 'bottom'].map(pos => (
              <div key={pos} style={{
                position: 'absolute', [pos]: 8, left: 0, width: '100%', height: 13,
                backgroundImage: 'radial-gradient(circle, rgba(230,226,224,.82) 0 42%, transparent 44%)',
                backgroundSize: '30px 13px', zIndex: 1
              }} />
            ))}
            {/* frames */}
            <div style={{
              position: 'absolute', top: 26, left: 0,
              width: '100%', height: 'calc(100% - 52px)',
              display: 'flex', alignItems: 'center', padding: '0 4px', boxSizing: 'border-box'
            }}>
              {FILMS.map((src, i) => (
                <div key={i} style={{ height: '100%', width: 'calc(100vw / 6)', flexShrink: 0, padding: 3, boxSizing: 'border-box' }}>
                  <img src={src} alt="" style={{
                    height: '100%', width: '100%', objectFit: 'cover',
                    objectPosition: 'top center', borderRadius: 3,
                    border: '3px solid rgba(242,237,230,.86)',
                    filter: 'saturate(.72) contrast(.94)',
                    display: 'block'
                  }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Pages ─────────────────────────────────────────────────── */

export function LoginChoicePage() {
  usePortraStyles()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) navigate('/hall', { replace: true })
  }, [isAuthenticated, navigate])

  return (
    <div style={{
      minHeight: '100vh', background: BG, position: 'relative',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: SANS,
      paddingBottom: 'clamp(130px, 18vh, 200px)'
    }}>
      {/* decorative vertical line */}
      <div style={{
        position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1,
        background: 'linear-gradient(180deg, transparent, rgba(13,47,178,.26) 22%, rgba(13,47,178,.12) 82%, transparent)',
        transform: 'translateX(-50%) rotate(-12deg)', transformOrigin: 'center',
        pointerEvents: 'none'
      }} />
      {/* side text */}
      <div style={{
        position: 'absolute', right: '2.4vw', top: '12vh', writingMode: 'vertical-rl',
        letterSpacing: '.38em', fontSize: 'clamp(10px,.86vw,13px)',
        color: 'rgba(17,16,21,.18)', pointerEvents: 'none', fontFamily: SANS
      }}>
        PORTRA / MEET / MATCH / START
      </div>

      {/* center content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'portraIn .5s ease both' }}>
        <Wordmark size='clamp(56px, 9.5vw, 102px)' />
        <div style={{
          fontSize: 'clamp(10px,.76vw,13px)', letterSpacing: '.28em',
          color: MUTED, textTransform: 'uppercase', marginBottom: 28, fontFamily: SANS
        }}>
          MEET RIGHT NOW
        </div>

        {/* primary CTA */}
        <NavBtn onClick={() => navigate('/login/sign-in')} primary>
          进入 Portra
        </NavBtn>
        {/* secondary CTA */}
        <NavBtn onClick={() => navigate('/login/register')}>
          创建账号
        </NavBtn>

        <div style={{
          fontSize: 11, color: 'rgba(17,16,21,.34)',
          letterSpacing: '.22em', marginTop: 16, textTransform: 'uppercase', fontFamily: SANS
        }}>
          SCROLL TO DEVELOP
        </div>
      </div>

      <Filmstrip />
    </div>
  )
}

function NavBtn({ children, onClick, primary }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 'min(320px, 88vw)',
        height: primary ? 56 : 48,
        border: primary ? 0 : `1px solid rgba(13,47,178,.28)`,
        borderRadius: 999,
        background: primary ? (hov ? BLUE2 : BLUE) : (hov ? 'rgba(13,47,178,.06)' : 'transparent'),
        color: primary ? '#fff' : BLUE,
        fontSize: primary ? 15 : 14, fontWeight: primary ? 700 : 600,
        letterSpacing: '.18em', fontFamily: SANS,
        boxShadow: primary ? '0 14px 30px rgba(13,47,178,.22)' : 'none',
        cursor: 'pointer',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'background .2s, transform .2s, box-shadow .2s',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10
      }}
    >
      {children}
      {primary && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: ORANGE, boxShadow: '0 0 0 3px rgba(248,81,4,.18)'
        }} />
      )}
    </button>
  )
}

/* ── Login page ────────────────────────────────────────────── */

export function LoginInfoPage() {
  usePortraStyles()
  const navigate   = useNavigate()
  const location   = useLocation()
  const { isAuthenticated, completeLogin, loginWithDemo } = useAuth()
  const [role, setRole]       = useState('CUSTOMER')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const notice = location.state?.notice || ''

  useEffect(() => {
    if (isAuthenticated) navigate('/hall', { replace: true })
  }, [isAuthenticated, navigate])

  async function submit() {
    setError('')
    if (!email.trim())  { setError('请输入学校邮箱'); return }
    if (!password)      { setError('请输入密码'); return }
    setLoading(true)
    try {
      const data = await authApi.login({ loginType: 'EMAIL', email: email.trim(), password, role })
      completeLogin({
        token: data?.token || data?.accessToken,
        refreshToken: data?.refreshToken,
        user: { ...data?.user, role, email: email.trim() }
      })
      navigate('/hall', { replace: true })
    } catch (err) {
      if (err.canUseDemoLogin) {
        loginWithDemo({ role })
        navigate('/hall', { replace: true })
        return
      }
      setError(err.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = e => { if (e.key === 'Enter') submit() }

  return (
    <div style={{
      minHeight: '100vh', background: BG, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: SANS
    }}>
      <AuthCard>
        <Wordmark size={26} />
        <div style={{ fontSize: 10, letterSpacing: '.22em', color: MUTED, textTransform: 'uppercase', marginTop: 5, marginBottom: 26, fontFamily: SANS }}>
          MEET RIGHT NOW
        </div>

        <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, color: INK }}>欢迎回来</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 22, lineHeight: 1.65 }}>输入邮箱和密码，进入你的 Portra</div>

        <RoleToggle value={role} onChange={setRole} />

        <SuccessBanner text={notice} />
        <ErrorBanner text={error} />

        <div style={{ marginBottom: 14 }}>
          <FieldLabel label="学校邮箱" htmlFor="li-email" />
          <FocusInput
            id="li-email" type="email"
            placeholder="yourname@smail.nju.edu.cn"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="email"
          />
        </div>
        <div style={{ marginBottom: 22 }}>
          <FieldLabel label="密码" htmlFor="li-pwd" />
          <FocusInput
            id="li-pwd" type="password"
            placeholder="请输入密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
            autoComplete="current-password"
          />
        </div>

        <PrimaryBtn onClick={submit} loading={loading}>进入 Portra</PrimaryBtn>
        <SwitchLine prompt="还没有账号？" linkText="立即注册" onClick={() => navigate('/login/register')} />
        <BackLink label="返回" onClick={() => navigate('/login')} />
      </AuthCard>
    </div>
  )
}

/* ── Register page (2-step) ────────────────────────────────── */

export function RegisterPage() {
  usePortraStyles()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('CUSTOMER')
  const [email, setEmail]       = useState('')
  const [code, setCode]         = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [nickname, setNickname] = useState('')
  const [demoCode, setDemoCode] = useState(null)
  const [codeSent, setCodeSent] = useState(false)
  const [codeHint, setCodeHint] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/hall', { replace: true })
    return () => clearInterval(timerRef.current)
  }, [isAuthenticated, navigate])

  async function sendCode() {
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('请输入有效的学校邮箱'); return
    }
    setLoading(true)
    try {
      await authApi.sendCode(email.trim())
      setCodeHint('验证码已发送，请查收邮箱。')
      setDemoCode(null)
    } catch {
      const code = String(100000 + Math.floor(Math.random() * 900000))
      setDemoCode(code)
      setCodeHint(`演示模式，验证码：${code}`)
    }
    setCodeSent(true)
    setCooldown(60)
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0 }
        return c - 1
      })
    }, 1000)
    setLoading(false)
  }

  function toStep2() {
    setError('')
    if (!email.trim())     { setError('请输入学校邮箱'); return }
    if (!codeSent)         { setError('请先点击「获取验证码」'); return }
    if (!code.trim())      { setError('请输入验证码'); return }
    if (demoCode && code.trim() !== demoCode) { setError('验证码不正确'); return }
    setStep(2)
  }

  async function register() {
    setError('')
    if (password.length < 8)   { setError('密码至少需要 8 位字符'); return }
    if (password !== password2) { setError('两次密码不一致'); return }
    setLoading(true)
    try {
      await authApi.register({
        nickname: nickname.trim() || email.split('@')[0] || '南大同学',
        email: email.trim(),
        code: code.trim(),
        password,
        role
      })
      navigate('/login/sign-in', { replace: true, state: { notice: '注册成功，请登录' } })
    } catch (err) {
      if (err.canUseDemoRegister) {
        navigate('/login/sign-in', { replace: true, state: { notice: '演示注册成功，请登录' } })
        return
      }
      setError(err.message || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: BG, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: SANS
    }}>
      <AuthCard>
        <Wordmark size={26} />
        <div style={{ fontSize: 10, letterSpacing: '.22em', color: MUTED, textTransform: 'uppercase', marginTop: 5, marginBottom: 24, fontFamily: SANS }}>
          MEET RIGHT NOW
        </div>

        {/* step dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 26, height: 4, borderRadius: 999, background: BLUE }} />
            <div style={{ width: 26, height: 4, borderRadius: 999, background: step === 2 ? BLUE : 'rgba(17,16,21,.12)', transition: 'background .3s' }} />
          </div>
          <span style={{ fontSize: 11, color: MUTED, letterSpacing: '.12em', fontFamily: SANS }}>步骤 {step} / 2</span>
        </div>

        {step === 1 ? (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, color: INK }}>创建你的 Portra</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 22, lineHeight: 1.65 }}>使用学校邮箱完成验证</div>

            <ErrorBanner text={error} />

            {/* email */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel label="学校邮箱" htmlFor="reg-email" />
              <FocusInput
                id="reg-email" type="email"
                placeholder="yourname@smail.nju.edu.cn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* code */}
            <div style={{ marginBottom: 22 }}>
              <FieldLabel label="邮箱验证码" htmlFor="reg-code" />
              <div style={{ display: 'flex', gap: 10 }}>
                <FocusInput
                  id="reg-code" type="text"
                  placeholder="6 位验证码" maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && toStep2()}
                  style={{ flex: 1, letterSpacing: '.24em' }}
                />
                <button
                  type="button" onClick={sendCode}
                  disabled={cooldown > 0 || loading}
                  style={{
                    flexShrink: 0, height: 50, border: 0, borderRadius: 999,
                    background: (cooldown > 0 || loading) ? '#ddd8d0' : YELLOW,
                    color: INK, fontSize: 12, fontWeight: 700,
                    letterSpacing: '.10em', padding: '0 16px',
                    cursor: (cooldown > 0 || loading) ? 'default' : 'pointer',
                    fontFamily: SANS, whiteSpace: 'nowrap', transition: 'background .18s'
                  }}
                >
                  {cooldown > 0 ? `${cooldown}s` : '获取验证码'}
                </button>
              </div>
              {codeHint && (
                <div style={{
                  marginTop: 9, padding: '9px 12px',
                  background: 'rgba(247,206,58,.15)', border: '1px solid rgba(247,206,58,.6)',
                  borderRadius: 10, fontSize: 12, color: '#5e4f00', lineHeight: 1.55, fontFamily: SANS
                }}>{codeHint}</div>
              )}
            </div>

            <PrimaryBtn onClick={toStep2}>下一步</PrimaryBtn>
            <SwitchLine prompt="已有账号？" linkText="直接登录" onClick={() => navigate('/login/sign-in')} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, color: INK }}>设置密码和身份</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 22, lineHeight: 1.65 }}>密码至少 8 位，选择你在 Portra 的身份</div>

            <RoleToggle value={role} onChange={setRole} />
            <ErrorBanner text={error} />

            {/* nickname (optional) */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel label="昵称（选填）" htmlFor="reg-nick" />
              <FocusInput
                id="reg-nick" type="text"
                placeholder={`默认：${email.split('@')[0] || '南大同学'}`}
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
            </div>

            {/* password */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel label="设置密码" htmlFor="reg-pwd" />
              <FocusInput
                id="reg-pwd" type="password"
                placeholder="至少 8 位字符"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {/* confirm password */}
            <div style={{ marginBottom: 22 }}>
              <FieldLabel label="确认密码" htmlFor="reg-pwd2" />
              <FocusInput
                id="reg-pwd2" type="password"
                placeholder="再输一次"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && register()}
                autoComplete="new-password"
              />
            </div>

            <PrimaryBtn onClick={register} loading={loading}>完成注册，进入 Portra</PrimaryBtn>
            <BackLink label="返回上一步" onClick={() => { setStep(1); setError('') }} />
          </>
        )}
      </AuthCard>
    </div>
  )
}
