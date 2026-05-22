import { Link, useParams } from 'react-router-dom'
import StudioEditorClient from '@/components/studio/StudioEditorClient'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

export default function StudioEditorPage(): React.JSX.Element {
  const { projectId } = useParams()
  const { t } = useLanguage()
  const id = Number(projectId)

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
        <p className="text-sm text-muted-foreground">{t('studioTimelineSaveFailed')}</p>
        <Link className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white" to="/studio">
          {t('studioTitle')}
        </Link>
      </div>
    )
  }

  return (
    <div className="studio-layout flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <StudioEditorClient projectId={id} />
    </div>
  )
}
