import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../AuthContext.jsx'
import { authApi } from '../../api.js'
import filmSpringUrl from '../../assets/film-spring.png'
import filmLibraryUrl from '../../assets/film-library.png'
import filmSummerUrl from '../../assets/film-summer.png'
import filmPhotoClubUrl from '../../assets/film-photo-club.png'
import filmAutumnUrl from '../../assets/film-autumn.png'
import filmWinterUrl from '../../assets/film-winter.png'
import searchImgUrl from '../../assets/opening-search.png'
import lensUrl from '../../assets/opening-lens.png'
import polaroidsUrl from '../../assets/opening-polaroids.png'
import polaroidsP3Url from '../../assets/opening-polaroids-p3.png'
import './opening.css'

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

/* ── v30 Opening – pointer parallax helpers ─────────────────── */

function enhanceTilt(el, { maxRot = 5, maxMove = 10, perspective = 900 }) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  let base = ''
  let raf = 0
  const clamp = (n, mn, mx) => Math.max(mn, Math.min(mx, n))
  function captureBase() {
    const t = getComputedStyle(el).transform
    base = t && t !== 'none' ? t : ''
  }
  function apply(e) {
    const r = el.getBoundingClientRect()
    const nx = clamp(((e.clientX - r.left) / r.width - .5) * 2, -1, 1)
    const ny = clamp(((e.clientY - r.top) / r.height - .5) * 2, -1, 1)
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      el.style.setProperty('transform',
        `${base} translate3d(${(nx * maxMove).toFixed(2)}px,${(ny * maxMove).toFixed(2)}px,0) perspective(${perspective}px) rotateX(${(-ny * maxRot).toFixed(2)}deg) rotateY(${(nx * maxRot).toFixed(2)}deg)`,
        'important')
    })
  }
  function reset() {
    cancelAnimationFrame(raf)
    el.style.setProperty('transform', base || '', 'important')
  }
  el.addEventListener('pointerenter', captureBase)
  el.addEventListener('pointermove', apply)
  el.addEventListener('pointerleave', reset)
  return () => {
    el.removeEventListener('pointerenter', captureBase)
    el.removeEventListener('pointermove', apply)
    el.removeEventListener('pointerleave', reset)
  }
}

/* ── Pages ─────────────────────────────────────────────────── */

export function LoginChoicePage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isAuthenticated } = useAuth()
  const hasModal  = location.pathname !== '/login' && location.pathname !== '/login/'

  const [navActive,  setNavActive]  = useState('约拍大厅')
  const [navRole,    setNavRole]    = useState('owner')
  const [roleActive, setRoleActive] = useState('我想拍')

  const scrollRef  = useRef(null)
  const p2Ref      = useRef(null)
  const p3Ref      = useRef(null)
  const lensRef    = useRef(null)
  const ticketRef  = useRef(null)
  const card1Ref   = useRef(null)
  const card2Ref   = useRef(null)
  const card3Ref   = useRef(null)

  useEffect(() => {
    if (isAuthenticated) navigate('/hall', { replace: true })
  }, [isAuthenticated, navigate])

  /* IntersectionObserver — mirrors v18-scroll-interactions */
  useEffect(() => {
    const scroller = scrollRef.current
    const sections = [p2Ref.current, p3Ref.current].filter(Boolean)
    if (!('IntersectionObserver' in window)) {
      sections.forEach(s => s.classList.add('op-in-view'))
      return
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.target.classList.toggle('op-in-view', e.isIntersecting))
    }, { root: scroller, threshold: .28 })
    sections.forEach(s => io.observe(s))
    return () => io.disconnect()
  }, [])

  /* 3D-tilt — mirrors v19-pointer-depth-interactions */
  useEffect(() => {
    const cleanups = [
      enhanceTilt(lensRef.current,   { maxRot: 3.5, maxMove: 13, perspective: 820 }),
      enhanceTilt(ticketRef.current, { maxRot: 3.2, maxMove: 8,  perspective: 900 }),
      enhanceTilt(card1Ref.current,  { maxRot: 5.5, maxMove: 11, perspective: 900 }),
      enhanceTilt(card2Ref.current,  { maxRot: 5.5, maxMove: 11, perspective: 900 }),
      enhanceTilt(card3Ref.current,  { maxRot: 5.5, maxMove: 11, perspective: 900 }),
    ]
    return () => cleanups.forEach(c => c())
  }, [])

  function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  function onSectionPointerMove(e, ref) {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--v18px', (((e.clientX - r.left) / r.width - .5) * 36).toFixed(2))
    el.style.setProperty('--v18py', (((e.clientY - r.top) / r.height - .5) * 36).toFixed(2))
  }
  function onSectionPointerLeave(ref) {
    const el = ref.current; if (!el) return
    el.style.setProperty('--v18px', '0')
    el.style.setProperty('--v18py', '0')
  }

  return (
    <div className="op-wrapper">

      {/* ── Side nav dots ──────────────────────────────────────── */}
      <div style={{
        position: 'fixed', left: 18, top: '50%', transform: 'translateY(-50%)',
        zIndex: 150, display: 'flex', flexDirection: 'column', gap: 10, opacity: .6
      }}>
        {[
          { label: '第一页', id: 'op-page1' },
          { label: '第二页', id: 'op-page2' },
          { label: '第三页', id: 'op-page3' },
          { label: '关于我们', id: 'op-about' },
        ].map(({ label, id }) => (
          <a
            key={id} aria-label={label}
            onClick={e => { e.preventDefault(); scrollToId(id) }}
            href={`#${id}`}
            style={{
              width: 9, height: 9, borderRadius: 99,
              border: `1px solid ${BLUE}`, background: 'rgba(242,237,230,.55)',
              display: 'block', cursor: 'pointer'
            }}
          />
        ))}
      </div>

      {/* ── Fixed header ───────────────────────────────────────── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 220,
        height: 72, background: '#f2ede6',
        borderBottom: '1px solid rgba(21,19,24,.12)',
        boxShadow: '0 1px 0 rgba(255,255,255,.55) inset',
        fontFamily: SANS
      }}>
        <div style={{
          width: 'min(1180px, calc(100vw - 48px))', height: 72,
          margin: '0 auto', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 24
        }}>
          {/* Wordmark */}
          <a
            onClick={e => { e.preventDefault(); scrollToId('op-page1') }}
            href="#op-page1"
            style={{
              display: 'flex', alignItems: 'flex-end', gap: 12,
              minWidth: 168, textDecoration: 'none', color: 'inherit', cursor: 'pointer'
            }}
          >
            <div style={{ fontFamily: SERIF, fontSize: 32, lineHeight: .9, letterSpacing: '-.04em', fontWeight: 500 }}>
              Por<span style={{ color: BLUE }}>t</span>r<span style={{ color: ORANGE }}>a</span>
            </div>
            <div style={{ fontSize: 10, letterSpacing: '.22em', color: MUTED, textTransform: 'uppercase', marginBottom: 2 }}>
              Meet Right Now
            </div>
          </a>

          {/* Nav */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 34, height: '100%' }}>
            {[
              { label: '约拍大厅', id: 'op-page1' },
              { label: '动态',    id: 'op-page2' },
              { label: '消息',    id: 'op-page3' },
              { label: '个人',    id: 'op-about' },
            ].map(({ label, id }) => (
              <a
                key={label}
                onClick={e => { e.preventDefault(); setNavActive(label); scrollToId(id) }}
                href={`#${id}`}
                className={`op-nav-item${navActive === label ? ' active' : ''}`}
              >{label}</a>
            ))}
          </nav>

          {/* Header actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 220, justifyContent: 'flex-end' }}>
            {/* Role toggle */}
            <div style={{
              display: 'flex', background: '#fffaf2',
              border: '1px solid rgba(21,19,24,.12)', borderRadius: 999, padding: 4
            }}>
              {[{ key: 'owner', label: '单主' }, { key: 'photographer', label: '摄影师' }].map(r => (
                <button
                  key={r.key}
                  onClick={() => setNavRole(r.key)}
                  style={{
                    border: 0,
                    background: navRole === r.key ? BLUE : 'transparent',
                    color: navRole === r.key ? '#fff' : '#3d4148',
                    borderRadius: 999, padding: '8px 13px',
                    fontSize: 13, letterSpacing: '.08em', cursor: 'pointer',
                    fontFamily: SANS
                  }}
                >{r.label}</button>
              ))}
            </div>
            {/* Search */}
            <button
              onClick={() => navigate('/login/sign-in')}
              style={{
                width: 38, height: 38, border: '1px solid rgba(21,19,24,.12)',
                borderRadius: 999, background: '#f9f5ee',
                display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 18,
                fontFamily: SANS
              }}>⌕</button>
            {/* Avatar → sign in */}
            <div
              onClick={() => navigate('/login/sign-in')}
              title="登录"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: `linear-gradient(135deg, ${BLUE}, #3857c8 45%, ${ORANGE})`,
                border: '3px solid #f4efe8', boxShadow: '0 0 0 1px rgba(21,19,24,.12)',
                cursor: 'pointer', flexShrink: 0
              }}
            />
          </div>
        </div>
      </header>

      {/* ── Scroll container ───────────────────────────────────── */}
      <div className="op-scroll" ref={scrollRef} id="op-scroller">

        {/* ── PAGE 1 ─────────────────────────────────────────── */}
        <section className="op-section op-p1" id="op-page1">

          {/* WANT background word — exact inline params from v30 HTML */}
          <div
            className="op-bg-word"
            style={{ right: '-3vw', top: '2vh', fontSize: '15.6vw', opacity: .30, transform: 'translate3d(-12.4vw, 0px, 0px)' }}
          >WANT</div>

          <div className="op-yellow-field" />
          <div className="op-blue-cut" />

          {/* Top ribbon */}
          <div className="op-top-ribbon op-reveal">寻找如此简单</div>

          {/* Search frame asset */}
          <img
            alt="search frame asset high resolution"
            className="op-asset op-search-img op-reveal"
            decoding="async"
            src={searchImgUrl}
          />

          {/* Lens asset */}
          <img
            ref={lensRef}
            alt="lens asset high resolution"
            className="op-asset op-lens op-reveal"
            decoding="async"
            src={lensUrl}
            style={{ marginLeft: '-1.36667px', marginTop: '-1.60364px' }}
          />

          {/* Shutter flash & blink */}
          <div className="op-lens-flash" aria-hidden="true" />
          <div className="op-shutter-blink" aria-hidden="true" />

          {/* Polaroids asset */}
          <img
            alt="polaroid top row collage asset high resolution"
            className="op-asset op-polaroids op-reveal"
            decoding="async"
            src={polaroidsUrl}
            style={{ marginLeft: '1.025px', marginTop: '1.06909px' }}
          />

          {/* PORTRA MEET YOU */}
          <div className="op-portra-meet op-reveal">PORTRA MEET<br />YOU</div>

          {/* Brand wordmark: P + o(blue) + r + t + r + a(orange) — exact from v30 HTML body */}
          <div className="op-brand op-reveal" style={{ fontFamily: SERIF }}>
            <span>P</span><span className="blue">o</span><span>r</span>
            <span>t</span><span>r</span><span className="orange">a</span>
          </div>

          {/* Product positioning pill */}
          <div className="op-product-positioning op-reveal">约拍一步到位</div>

          {/* NOW / right now / PHOTO */}
          <div className="op-now-word op-reveal">NOW</div>
          <div className="op-right-now op-reveal">right now</div>
          <div className="op-photo-word op-reveal">PHOTO</div>

          {/* START pill — scrolls to page 3 */}
          <button className="op-start-pill" onClick={() => navigate('/login/sign-in')}>
            <span>开始</span>
          </button>

          {/* GO ON vertical — scrolls to page 2 */}
          <button className="op-go-on" onClick={() => scrollToId('op-page2')}>
            <span>继续</span>
          </button>
        </section>

        {/* ── PAGE 2 ─────────────────────────────────────────── */}
        <section
          className="op-section op-p2"
          id="op-page2"
          ref={p2Ref}
          onPointerMove={e => onSectionPointerMove(e, p2Ref)}
          onPointerLeave={() => onSectionPointerLeave(p2Ref)}
        >
          {/* MATCH background word — exact inline params from v30 HTML */}
          <div
            className="op-bg-word"
            style={{ left: '46.1vw', top: '-1.7vh', fontSize: '17vw', opacity: .20, transform: 'translate3d(-13.8vw, 0px, 0px)' }}
          >MATCH</div>

          <div className="op-p2-left-blue" />
          <div className="op-p2-yellow-note" />

          <div className="op-p2-kicker op-reveal">PORTRA MATCH SYSTEM / FILM EDGE</div>

          <h1 className="op-p2-title op-reveal">你想拍的，<br />在等一个合适的快门</h1>

          <p className="op-p2-copy op-reveal">
            不是把人塞进模板，<br />
            而是让 <b>风格、地点、预算、时间</b> 慢慢对齐。
          </p>

          <div className="op-match-line op-reveal">
            <span className="dot d1" /><span className="dot d2" /><span className="dot d3" />
          </div>

          {/* Sticker A — vertical white text on left blue bar */}
          <div className="op-p2-sticker a op-reveal">I WANT TO BE PHOTOGRAPHED →</div>

          {/* Sticker B — yellow note */}
          <div className="op-p2-sticker b op-reveal">02<br /><small>MATCH LINE</small></div>

          {/* Request strip */}
          <div className="op-request-strip op-reveal">
            <h4>REQUEST NOTE / WANT</h4>
            <p><span>想拍</span><b>毕业照 / 胶片感</b></p>
            <p><span>地点</span><b>南京大学附近</b></p>
            <p><span>预算</span><b>¥120–300</b></p>
            <p><span>时间</span><b>本周末下午</b></p>
            <p><span>状态</span><b>可先沟通</b></p>
          </div>

          {/* Contact sheet */}
          <div className="op-contact-sheet op-reveal" aria-label="contact sheet">
            {[1,2,3,4,5,6].map(n => (
              <div key={n} className={`op-frame brand-tile f${n}`} />
            ))}
          </div>

          {/* Film edge card */}
          <div className="op-film-edge-card op-reveal">
            <h4>FILM EDGE / RESPONSE</h4>
            <p><span>可响应</span><b>3 位摄影师</b></p>
            <p><span>距离</span><b>2km 内</b></p>
            <p><span>评分</span><b>★ 4.9</b></p>
            <p><span>完成</span><b>18 次拍摄</b></p>
            <p><span>沟通</span><b>先聊再定</b></p>
          </div>

          <div className="op-material-caption op-reveal">CONTACT SHEET / STYLE SAMPLE / RESPONSE SLIP</div>

          {/* Role switch */}
          <div className="op-role-switch op-reveal">
            {[
              { label: '我想拍',   to: '/login/sign-in'   },
              { label: '我来拍',   to: '/login/sign-in'   },
              { label: '先看作品', to: '/login/sign-in'   },
            ].map(({ label, to }) => (
              <button
                key={label}
                className={roleActive === label ? 'active' : ''}
                onClick={() => { setRoleActive(label); navigate(to) }}
              >{label}</button>
            ))}
          </div>

          <div className="op-edge-text">WAITING FOR THE RIGHT SHUTTER</div>

          {/* Sticker C — black/yellow */}
          <div className="op-p2-sticker c op-reveal">MEET YOU RIGHT NOW</div>
        </section>

        {/* ── PAGE 3 ─────────────────────────────────────────── */}
        <section
          className="op-section op-p3"
          id="op-page3"
          ref={p3Ref}
          onPointerMove={e => onSectionPointerMove(e, p3Ref)}
          onPointerLeave={() => onSectionPointerLeave(p3Ref)}
        >
          {/* MEET background word — exact inline params from v30 HTML */}
          <div
            className="op-bg-word"
            style={{ right: '-2vw', top: '2vh', fontSize: '18vw', opacity: .22, letterSpacing: '.02em', transform: 'translate3d(3.3vw, 0px, 0px)' }}
          >MEET</div>

          <div className="op-p3-blue-cut" />
          <div className="op-p3-yellow-floor" />

          <h1 className="op-p3-title op-reveal">现在，就开始一次<br />属于你的 Portra</h1>

          {/* Ticket */}
          <div className="op-ticket-main" ref={ticketRef}>
            <div className="op-ticket-inner">
              <div className="op-ticket-spine">PORTRA · MEET YOU</div>
              <div className="op-ticket-body">
                <small>INVITATION / START POINT</small>
                <h2>从一张邀请开始，<br />让快门和你相遇。</h2>
                <div className="op-ticket-meta">
                  <span>PLACE</span><b>NJU / nearby</b>
                  <span>STYLE</span><b>film / portrait</b>
                  <span>FIRST STEP</span><b>message first</b>
                  <span>FLOW</span><b>hall · post · order</b>
                </div>
                <div className="op-barcode" />
              </div>
            </div>
          </div>

          {/* Invite cards */}
          <div className="op-invite-cards">
            <article className="op-invite-card" ref={card1Ref}>
              <div className="num">01</div>
              <div className="tiny">I WANT TO BE<br />PHOTOGRAPHED</div>
              <h3>找摄影师</h3>
              <div className="line" />
              <p>浏览风格、地点与作品，找到合适的快门。</p>
              <ul>
                <li>看作品片段</li>
                <li>先沟通再确认</li>
                <li>收藏喜欢的风格</li>
              </ul>
              <button onClick={() => navigate('/login/sign-in')}>我去看看</button>
            </article>

            <article className="op-invite-card" ref={card2Ref}>
              <div className="num">02</div>
              <div className="tiny">SEND A<br />REQUEST</div>
              <h3>发布需求</h3>
              <div className="line" />
              <p>写下想拍的时间和样子，等待合适的人来回应。</p>
              <ul>
                <li>填写地点预算</li>
                <li>选择拍摄风格</li>
                <li>收到邀请提醒</li>
              </ul>
              <button onClick={() => navigate('/login/sign-in')}>我想拍照</button>
            </article>

            <article className="op-invite-card" ref={card3Ref}>
              <div className="num">03</div>
              <div className="tiny">I CAN TAKE<br />THIS SHOOT</div>
              <h3>成为摄影师</h3>
              <div className="line" />
              <p>展示作品与风格，回应新的拍摄邀请。</p>
              <ul>
                <li>上传作品集</li>
                <li>响应附近需求</li>
                <li>管理订单评价</li>
              </ul>
              <button onClick={() => navigate('/login/sign-in')}>我来拍照</button>
            </article>
          </div>

          {/* Polaroids — p3 version */}
          <img
            alt="polaroid top row collage asset high resolution"
            className="op-asset op-p3-polaroids"
            decoding="async"
            src={polaroidsP3Url}
          />

          {/* Mini path indicator */}
          <div className="op-p3-mini-path">
            <span>大厅</span><i /><span>消息</span><i /><span>订单</span>
          </div>
        </section>

        {/* ── FOOTER ─────────────────────────────────────────── */}
        <section className="op-footer" id="op-about">
          <div className="op-footer-inner">
            <div className="op-footer-top">
              <div className="op-footer-brand" style={{ fontFamily: SERIF }}>
                <span>P</span><span className="blue">o</span><span>r</span>
                <span>t</span><span>r</span><span className="orange">a</span>
              </div>
              <p className="op-footer-tagline">
                让"我想拍"的人和"我来拍"的人，在同一个页面里顺利相遇。
                浏览风格、发布需求、沟通确认，再把一次拍摄认真落地。
              </p>
            </div>
            <div className="op-footer-grid">
              <div className="op-footer-col">
                <h4>About Portra</h4>
                <p>一个更轻松、更直接的约拍入口。</p>
                <p>从灵感到拍摄，一步一步把匹配变简单。</p>
              </div>
              <div className="op-footer-col">
                <h4>产品</h4>
                <ul>
                  <li>找摄影师</li><li>发布需求</li>
                  <li>即时沟通</li><li>订单管理</li>
                </ul>
              </div>
              <div className="op-footer-col">
                <h4>关于我们</h4>
                <ul>
                  <li>平台理念</li><li>使用帮助</li>
                  <li>校园合作</li><li>更新日志</li>
                </ul>
              </div>
              <div className="op-footer-col">
                <h4>支持</h4>
                <ul>
                  <li>用户协议</li><li>隐私说明</li>
                  <li>常见问题</li><li>联系团队</li>
                </ul>
              </div>
            </div>
            <div className="op-footer-mini">
              <span>© 2026 Portra. All rights reserved.</span>
              <span>想拍 / 来拍 / 看看</span>
            </div>
          </div>
        </section>

      </div>{/* end op-scroll */}

      {/* ── Modal overlay for sign-in / register child routes ── */}
      {hasModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9900,
          background: 'rgba(17,16,21,.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px', overflowY: 'auto'
        }}>
          <Outlet />
        </div>
      )}
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
      const data = await authApi.login({ email: email.trim(), password })
      const loginUser = data?.user || data || {}
      completeLogin({
        token: data?.token,
        refreshToken: data?.refreshToken,
        user: {
          ...loginUser,
          userId: loginUser.userId ?? data?.userId ?? loginUser.id ?? data?.id,
          nickname: loginUser.nickname ?? data?.nickname,
          role: loginUser.role ?? data?.role,
          email: email.trim()
        }
      })
      navigate('/hall', { replace: true })
    } catch (err) {
      if (err.canUseDemoLogin) {
        loginWithDemo({})
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
    <AuthCard>
      <Wordmark size={26} />
      <div style={{ fontSize: 10, letterSpacing: '.22em', color: MUTED, textTransform: 'uppercase', marginTop: 5, marginBottom: 26, fontFamily: SANS }}>
        MEET RIGHT NOW
      </div>

      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, color: INK }}>欢迎回来</div>
      <div style={{ fontSize: 13, color: MUTED, marginBottom: 22, lineHeight: 1.65 }}>输入邮箱和密码，进入你的 Portra</div>

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
  )
}

/* ── Register page (2-step) ────────────────────────────────── */

export function RegisterPage() {
  usePortraStyles()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [step, setStep] = useState(1)
  const [email, setEmail]       = useState('')
  const [code, setCode]         = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
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
      setCodeSent(true)
      setCooldown(60)
      timerRef.current = setInterval(() => {
        setCooldown(c => {
          if (c <= 1) { clearInterval(timerRef.current); return 0 }
          return c - 1
        })
      }, 1000)
    } catch (err) {
      setError(err.message || '发送失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  function toStep2() {
    setError('')
    if (!email.trim())  { setError('请输入学校邮箱'); return }
    if (!codeSent)      { setError('请先点击「获取验证码」'); return }
    if (!code.trim())   { setError('请输入验证码'); return }
    setStep(2)
  }

  async function register() {
    setError('')
    if (password.length < 8)   { setError('密码至少需要 8 位字符'); return }
    if (password !== password2) { setError('两次密码不一致'); return }
    setLoading(true)
    try {
      await authApi.register({
        nickname: email.split('@')[0] || '南大同学',
        email: email.trim(),
        code: code.trim(),
        password,
        role: 'CUSTOMER'
      })
      navigate('/login/sign-in', { replace: true, state: { notice: '注册成功，请登录' } })
    } catch (err) {
      setError(err.message || '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
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
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '.04em', marginBottom: 4, color: INK }}>设置你的密码</div>
            <div style={{ fontSize: 13, color: MUTED, marginBottom: 22, lineHeight: 1.65 }}>密码至少 8 位，注册成功后直接进入 Portra</div>

            <ErrorBanner text={error} />

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
  )
}
