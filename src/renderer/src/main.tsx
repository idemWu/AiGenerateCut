import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { DEFAULT_LOCALE } from '@/lib/i18n/config'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { useAuthStore } from '@/lib/stores/authStore'

useAuthStore.getState().init()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider initialLocale={DEFAULT_LOCALE}>
      <HashRouter>
        <App />
      </HashRouter>
    </LanguageProvider>
  </StrictMode>
)
