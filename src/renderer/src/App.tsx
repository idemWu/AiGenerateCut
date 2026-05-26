import { Navigate, Route, Routes, useMatch } from 'react-router-dom'
import { Toaster } from 'sonner'
import AccountButton from '@/components/auth/AccountButton'
import AuthTokenDialog from '@/components/auth/AuthTokenDialog'
import AppSettingsButton from '@/components/settings/AppSettingsButton'
import StudioEditorPage from '@/pages/StudioEditorPage'
import StudioProjectListPage from '@/pages/StudioProjectListPage'

function App(): React.JSX.Element {
  const studioEditorMatch = useMatch('/studio/:projectId')
  const localizedStudioEditorMatch = useMatch('/:locale/studio/:projectId')
  const inStudioEditor = Boolean(studioEditorMatch || localizedStudioEditorMatch)

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="/studio" element={<StudioProjectListPage />} />
        <Route path="/studio/:projectId" element={<StudioEditorPage />} />
        <Route path="/:locale/studio" element={<StudioProjectListPage />} />
        <Route path="/:locale/studio/:projectId" element={<StudioEditorPage />} />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
      {!inStudioEditor ? (
        <>
          <div className="app-region-drag fixed left-0 right-[138px] top-0 z-[90] h-10" />
          <div className="app-region-no-drag fixed right-[150px] top-2 z-[130] flex items-center gap-2">
            <AccountButton placement="inline" />
            <AppSettingsButton placement="inline" />
          </div>
        </>
      ) : null}
      <AuthTokenDialog />
      <Toaster theme="dark" richColors position="top-center" />
    </>
  )
}

export default App
