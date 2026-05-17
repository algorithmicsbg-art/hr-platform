// app/admin/[id]/page.tsx
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { formatAuthMethod } from '@/lib/auth-helpers'
import StatusBadge from '@/components/ui/StatusBadge'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import AdminActions from '@/components/admin/AdminActions'

export default async function AdminRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: request } = await supabase
    .from('requests')
    .select('*, profiles(full_name)')
    .eq('id', id)
    .single()

  if (!request) notFound()

  const dateFrom = new Date(request.date_from)
  const dateTo = new Date(request.date_to)
  const days = Math.ceil((dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {request.type === 'vacation' ? 'Платен отпуск' : 'Болничен'}
          </h1>
          <p className="text-xs text-gray-400 font-mono">REQ-{request.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={request.status} />
        </div>
      </div>

      {/* Служител */}
      <div className="card space-y-3">
        <h2 className="font-medium text-gray-900">Служител</h2>
        <p className="text-sm text-gray-700">{request.profiles?.full_name ?? 'Неизвестен'}</p>
      </div>

      {/* Детайли */}
      <div className="card space-y-4">
        <h2 className="font-medium text-gray-900">Детайли на заявката</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">От дата</p>
            <p className="font-medium">{format(dateFrom, 'd MMMM yyyy', { locale: bg })}</p>
          </div>
          <div>
            <p className="text-gray-500">До дата</p>
            <p className="font-medium">{format(dateTo, 'd MMMM yyyy', { locale: bg })}</p>
          </div>
          <div>
            <p className="text-gray-500">Дни</p>
            <p className="font-medium">{days}</p>
          </div>
          <div>
            <p className="text-gray-500">Подадена на</p>
            <p className="font-medium">{format(new Date(request.created_at), 'd MMM yyyy', { locale: bg })}</p>
          </div>
        </div>
        {request.notes && (
          <div>
            <p className="text-gray-500 text-sm">Бележка</p>
            <p className="text-sm mt-1">{request.notes}</p>
          </div>
        )}
      </div>

      {/* 2FA данни */}
      <div className="card space-y-3">
        <h2 className="font-medium text-gray-900">Автентикация при подаване</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Метод</span>
            <span className="font-medium">{formatAuthMethod(request.auth_method ?? 'totp')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">IP адрес</span>
            <span className="font-mono text-xs">{request.ip_address ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Системна дата</span>
            <span className="font-mono text-xs">
              {format(new Date(request.created_at), 'dd.MM.yyyy HH:mm:ss')} UTC
            </span>
          </div>
        </div>
      </div>

      {/* PDF */}
      {request.pdf_path && (
        <a
          href={`/api/requests/${id}/pdf`}
          className="btn-secondary w-full text-center block"
          target="_blank"
        >
          📄 Свали PDF документ
        </a>
      )}

      {/* Admin Actions */}
      {request.status === 'pending' && (
        <AdminActions requestId={id} />
      )}
    </div>
  )
}
