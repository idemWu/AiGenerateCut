import { Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import AuthTokenDialog from '@/components/auth/AuthTokenDialog'
import StudioEditorPage from '@/pages/StudioEditorPage'
import StudioProjectListPage from '@/pages/StudioProjectListPage'

function App(): React.JSX.Element {
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
      <AuthTokenDialog />
      <Toaster theme="dark" richColors position="top-center" />
    </>
  )
}

export default App
