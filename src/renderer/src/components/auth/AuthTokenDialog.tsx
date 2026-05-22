import { useCallback, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/lib/stores/authStore'

export default function AuthTokenDialog(): React.JSX.Element | null {
  const open = useAuthStore((s) => s.loginDrawerOpen)
  const close = useAuthStore((s) => s.closeLoginDrawer)
  const login = useAuthStore((s) => s.login)
  const [token, setToken] = useState('')
  const [uid, setUid] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    const trimmedToken = token.trim()
    const trimmedUid = uid.trim()

    if (!trimmedToken || !trimmedUid) {
      toast.error('Access token and user id are required')
      return
    }

    setSubmitting(true)
    try {
      await login(trimmedToken, trimmedUid, true)
      setToken('')
      setUid('')
      close()
    } finally {
      setSubmitting(false)
    }
  }, [close, login, token, uid])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-studio-dialog p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Connect Studio API</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Paste an existing Movie Utopia access token to enable authenticated Studio actions.
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

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          Access token
          <textarea
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="mt-1 min-h-24 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
            spellCheck={false}
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-muted-foreground">
          User id
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
            Cancel
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save token
          </button>
        </div>
      </div>
    </div>
  )
}
