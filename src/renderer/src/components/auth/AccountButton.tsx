import { useCallback, useState } from 'react'
import { LogIn, LogOut, RefreshCcw, UserRound } from 'lucide-react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { Locale } from '@/lib/i18n/translations'
import { useAuthStore } from '@/lib/stores/authStore'

const ACCOUNT_COPY: Record<
  Locale,
  {
    login: string
    account: string
    signedInAs: string
    switchUser: string
    logout: string
    close: string
  }
> = {
  en: {
    login: 'Log in',
    account: 'Account',
    signedInAs: 'Signed in as',
    switchUser: 'Switch user',
    logout: 'Log out',
    close: 'Close account menu'
  },
  zh: {
    login: '登录',
    account: '账号',
    signedInAs: '当前用户',
    switchUser: '切换用户',
    logout: '退出登录',
    close: '关闭账号菜单'
  },
  ja: {
    login: 'ログイン',
    account: 'アカウント',
    signedInAs: 'ログイン中',
    switchUser: 'ユーザー切替',
    logout: 'ログアウト',
    close: 'アカウントメニューを閉じる'
  }
}

interface AccountButtonProps {
  placement?: 'floating' | 'inline'
}

export default function AccountButton({
  placement = 'floating'
}: AccountButtonProps): React.JSX.Element {
  const { locale } = useLanguage()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const uid = useAuthStore((s) => s.uid)
  const openLoginDrawer = useAuthStore((s) => s.openLoginDrawer)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const copy = ACCOUNT_COPY[locale]

  const wrapperBaseClass = placement === 'floating' ? 'fixed right-16 top-4' : 'relative shrink-0'
  const wrapperClass = `${wrapperBaseClass} ${open ? 'z-[140]' : 'z-[130]'}`

  const handleLogin = useCallback(() => {
    setOpen(false)
    openLoginDrawer()
  }, [openLoginDrawer])

  const handleSwitchUser = useCallback(() => {
    logout()
    openLoginDrawer()
    setOpen(false)
  }, [logout, openLoginDrawer])

  const handleLogout = useCallback(() => {
    logout()
    setOpen(false)
  }, [logout])

  if (!isLoggedIn) {
    return (
      <div className={wrapperClass}>
        <button
          type="button"
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-studio-dialog/90 px-4 text-sm font-medium text-foreground shadow-xl backdrop-blur transition hover:border-primary/50 hover:bg-white/10"
          onClick={handleLogin}
        >
          <LogIn className="h-4 w-4" />
          {copy.login}
        </button>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <button
        type="button"
        aria-label={copy.account}
        className="inline-flex h-10 max-w-44 cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-studio-dialog/90 px-3 text-sm font-medium text-foreground shadow-xl backdrop-blur transition hover:border-primary/50 hover:bg-white/10"
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound className="h-4 w-4 shrink-0" />
        <span className="truncate">{uid ?? copy.account}</span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 cursor-default bg-transparent"
            aria-label={copy.close}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 mt-3 w-56 rounded-2xl border border-white/10 bg-studio-dialog p-2 shadow-2xl"
            role="menu"
            aria-label={copy.account}
          >
            <div className="border-b border-white/10 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{copy.signedInAs}</p>
              <p className="mt-0.5 truncate text-sm font-medium text-foreground">{uid}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              className="mt-2 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground hover:bg-white/10"
              onClick={handleSwitchUser}
            >
              <RefreshCcw className="h-4 w-4" />
              {copy.switchUser}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {copy.logout}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
