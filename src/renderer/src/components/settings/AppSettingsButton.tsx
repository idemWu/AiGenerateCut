import { useCallback, useEffect, useState } from 'react'
import { Loader2, Settings, X } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Locale } from '@/lib/i18n/translations'
import { useAuthStore } from '@/lib/stores/authStore'

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' }
]

const SETTINGS_COPY: Record<
  Locale,
  {
    title: string
    subtitle: string
    language: string
    token: string
    uid: string
    cancel: string
    save: string
    saved: string
    required: string
    ariaLabel: string
  }
> = {
  en: {
    title: 'Setting',
    subtitle: 'Language and API connection settings live here.',
    language: 'Language',
    token: 'Access token',
    uid: 'User id',
    cancel: 'Cancel',
    save: 'Save',
    saved: 'Settings saved',
    required: 'Access token and user id are required',
    ariaLabel: 'Open settings'
  },
  zh: {
    title: '设置',
    subtitle: '语言和 API 连接设置会放在这里。',
    language: '语言',
    token: 'Access token',
    uid: 'User id',
    cancel: '取消',
    save: '保存',
    saved: '设置已保存',
    required: 'Access token 和 user id 必填',
    ariaLabel: '打开设置'
  },
  ja: {
    title: '設定',
    subtitle: '言語と API 接続設定はここに置きます。',
    language: '言語',
    token: 'Access token',
    uid: 'User id',
    cancel: 'キャンセル',
    save: '保存',
    saved: '設定を保存しました',
    required: 'Access token と user id は必須です',
    ariaLabel: '設定を開く'
  }
}

interface AppSettingsButtonProps {
  placement?: 'floating' | 'inline'
}

export default function AppSettingsButton({
  placement = 'floating'
}: AppSettingsButtonProps): React.JSX.Element {
  const { locale, setLocale } = useLanguage()
  const tokenFromStore = useAuthStore((s) => s.token)
  const uidFromStore = useAuthStore((s) => s.uid)
  const login = useAuthStore((s) => s.login)
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState(tokenFromStore ?? '')
  const [uid, setUid] = useState(uidFromStore ?? '')
  const [submitting, setSubmitting] = useState(false)
  const copy = SETTINGS_COPY[locale]

  useEffect(() => {
    if (!open) return
    setToken(tokenFromStore ?? '')
    setUid(uidFromStore ?? '')
  }, [open, tokenFromStore, uidFromStore])

  const close = useCallback(() => setOpen(false), [])

  const handleSubmit = useCallback(async () => {
    const trimmedToken = token.trim()
    const trimmedUid = uid.trim()

    if (!trimmedToken || !trimmedUid) {
      toast.error(copy.required)
      return
    }

    setSubmitting(true)
    try {
      await login(trimmedToken, trimmedUid, true)
      toast.success(copy.saved)
      close()
    } finally {
      setSubmitting(false)
    }
  }, [close, copy.required, copy.saved, login, token, uid])

  const wrapperClass =
    placement === 'floating' ? 'fixed right-4 top-4 z-[130]' : 'relative z-[130] shrink-0'

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        aria-label={copy.ariaLabel}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-studio-dialog/90 text-muted-foreground shadow-xl backdrop-blur transition hover:border-primary/50 hover:bg-white/10 hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        <Settings className="h-5 w-5" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 cursor-default bg-transparent"
            aria-label={copy.cancel}
            onClick={close}
          />
          <div
            className="absolute right-0 mt-3 w-[min(calc(100vw-2rem),24rem)] rounded-2xl border border-white/10 bg-studio-dialog p-5 shadow-2xl"
            role="dialog"
            aria-modal="false"
            aria-labelledby="app-settings-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="app-settings-title" className="font-display text-base font-semibold text-foreground">
                  {copy.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{copy.subtitle}</p>
              </div>
              <button
                type="button"
                className="cursor-pointer rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                onClick={close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              {copy.language}
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="mt-1 w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-studio-dialog text-foreground">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              {copy.token}
              <textarea
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="mt-1 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
                spellCheck={false}
              />
            </label>

            <label className="mt-3 block text-xs font-medium text-muted-foreground">
              {copy.uid}
              <input
                value={uid}
                onChange={(event) => setUid(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground hover:bg-white/10"
                onClick={close}
              >
                {copy.cancel}
              </button>
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {copy.save}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
