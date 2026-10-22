import { useState } from 'react'
import { ArrowLeftRight, BarChart3, BookOpen, Boxes, LogIn, QrCode } from 'lucide-react'
import { useAuth } from '../lib/auth'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await login(email, password) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="login">
      <div className="login-art">
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-logo"><BookOpen size={20} /></div>
          <div><b>Folder and Gauge Set Library</b><span>Industrial Engineering</span></div>
        </div>
        <h2>Every IE folder and gauge set, tracked from store to sewing line.</h2>
        <p>Browse the folder and gauge set library, issue and return them to lines, and keep stock levels accurate in real time.</p>
        <div className="login-feats">
          <div><BookOpen size={18} /> Folder &amp; gauge set library</div>
          <div><Boxes size={18} /> Live inventory</div>
          <div><ArrowLeftRight size={18} /> Issue & return to lines</div>
          <div><QrCode size={18} /> QR codes per folder</div>
          <div><BarChart3 size={18} /> Usage reports & Excel</div>
        </div>
      </div>
      <div className="login-form">
        <form onSubmit={submit}>
          <h1 style={{ fontSize: 24, marginBottom: 6 }}>Sign in</h1>
          <p className="muted" style={{ marginTop: 0, marginBottom: 24 }}>Use your IE team account to continue.</p>
          {error && <div className="alert err">{error}</div>}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary btn-block" style={{ height: 42, marginTop: 6 }} disabled={busy}>
            <LogIn size={17} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="subtle" style={{ fontSize: 12, marginTop: 18 }}>
            First run: <span className="mono">admin@ie.local</span> / <span className="mono">admin123</span>. Change it in Settings.
          </p>
        </form>
      </div>
    </div>
  )
}
