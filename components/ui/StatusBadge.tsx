// components/ui/StatusBadge.tsx
import type { RequestStatus } from '@/types'

const map: Record<RequestStatus, { label: string; cls: string }> = {
  pending:  { label: 'Изчакваща', cls: 'badge-pending' },
  approved: { label: 'Одобрена',  cls: 'badge-approved' },
  rejected: { label: 'Отказана',  cls: 'badge-rejected' },
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, cls } = map[status] ?? map.pending
  return <span className={cls}>{label}</span>
}
