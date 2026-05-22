import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, resolveLocale } from '@/lib/i18n/config'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import type { Locale } from '@/lib/i18n/translations'
import { useAuthStore } from '@/lib/stores/authStore'

useAuthStore.getState().init()

function getInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  return resolveLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY), DEFAULT_LOCALE)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider initialLocale={getInitialLocale()}>
      <HashRouter>
        <App />
      </HashRouter>
    </LanguageProvider>
  </StrictMode>
)
