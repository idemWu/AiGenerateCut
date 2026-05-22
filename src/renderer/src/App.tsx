import { Navigate, Route, Routes, useMatch } from 'react-router-dom'
import { Toaster } from 'sonner'
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
      {!inStudioEditor ? <AppSettingsButton /> : null}
      <AuthTokenDialog />
      <Toaster theme="dark" richColors position="top-center" />
    </>
  )
}

export default App
