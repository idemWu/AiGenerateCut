import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Loader2, Mail, X } from 'lucide-react'
import { loginByEmail, sendVerificationCode } from '@/lib/api/auth'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useAuthStore } from '@/lib/stores/authStore'
import { cn } from '@/lib/utils'

export default function AuthTokenDialog(): React.JSX.Element | null {
  const open = useAuthStore((s) => s.loginDrawerOpen)
  const view = useAuthStore((s) => s.authDrawerView)
  const close = useAuthStore((s) => s.closeLoginDrawer)
  const login = useAuthStore((s) => s.login)
  const { t } = useLanguage()
  const isRegister = view === 'register'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    if (open) {
      document.addEventListener('keydown', handleEsc)
    }
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, close])

  useEffect(() => {
    if (!open) {
      setEmail('')
      setCode('')
      setCodeSent(false)
      setCountdown(0)
      setLoading(false)
      setSendingCode(false)
      setError('')
    }
  }, [open])

  const handleSendCode = useCallback(async () => {
    if (!email || countdown > 0 || sendingCode) return
    setError('')
    setSendingCode(true)
    try {
      const res = await sendVerificationCode(email, 'email', 'login')
      if (res.code !== 0) {
        setError(res.msg || 'Failed to send code')
        return
      }
      setCodeSent(true)
      setCountdown(60)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send code'
      setError(msg)
    } finally {
      setSendingCode(false)
    }
  }, [email, countdown, sendingCode])

  const handleLogin = useCallback(async () => {
    if (!email || !code || loading) return
    setError('')
    setLoading(true)
    try {
      const tokenData = await loginByEmail(email, code)
      await login(tokenData.access_token, tokenData.uid, tokenData.is_invited)
      close()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [close, code, email, loading, login])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-studio-dialog p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              {t(isRegister ? 'registerWelcome' : 'loginWelcome')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(isRegister ? 'registerDesc' : 'loginDesc')}
            </p>
          </div>
          <button
            type="button"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            onClick={close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          {t('loginEmail')}
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('loginEmailPlaceholder')}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>
        </label>

        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          {t('loginCode')}
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t('loginCodePlaceholder')}
              maxLength={6}
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              disabled={!email || countdown > 0 || sendingCode}
              onClick={handleSendCode}
              className={cn(
                'shrink-0 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                !email || countdown > 0 || sendingCode
                  ? 'cursor-not-allowed bg-white/5 text-muted-foreground'
                  : 'cursor-pointer bg-primary/20 text-primary hover:bg-primary/30'
              )}
            >
              {sendingCode ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : countdown > 0 ? (
                `${countdown}s`
              ) : codeSent ? (
                t('loginResend')
              ) : (
                t('loginSendCode')
              )}
            </button>
          </div>
        </label>

        <button
          type="button"
          disabled={!email || !code || loading}
          onClick={handleLogin}
          className={cn(
            'mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <span>{t(isRegister ? 'registerSubmit' : 'loginSubmit')}</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {t(isRegister ? 'registerAgreement' : 'loginAgreement')}
        </p>
      </div>
    </div>
  )
}
