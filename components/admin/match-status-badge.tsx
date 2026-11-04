import { MATCH_STATUS_LABELS, MATCH_STATUS_TONE } from '@/lib/labels'
import type { Enums } from '@/lib/supabase/database.types'

export function MatchStatusBadge({ status }: { status: Enums<'match_status'> }) {
  return (
    <span className={`status-badge status-${MATCH_STATUS_TONE[status]}`}>
      <span className="status-dot" />
      {MATCH_STATUS_LABELS[status]}
    </span>
  )
}
