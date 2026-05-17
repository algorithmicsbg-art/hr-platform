// app/app/dashboard/page.tsx
// Сървърен компонент — зарежда заявките на текущия потребител

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/ui/StatusBadge'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'
import type { Request } from '@/types'

export default async function DashboardPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: requests } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const pending = requests?.filter((r) => r.status === 'pending').length ?? 0
  const approved = requests?.filter((r) => r.status === 'approved').length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Здравей, {profile?.full_name?.split(' ')[0] ?? 'Потребителю'} 👋
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Твоите заявки за отпуск и болнични</p>
        </div>
        <Link href="/request/new" className="btn-primary">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Нова заявка
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-semibold text-gray-900">{requests?.length ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Общо заявки</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-semibold text-amber-600">{pending}</p>
          <p className="mt-1 text-xs text-gray-500">Изчакващи</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-semibold text-green-600">{approved}</p>
          <p className="mt-1 text-xs text-gray-500">Одобрени</p>
        </div>
      </div>

      {/* Requests list */}
      <div className="card p-0 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-900">Всички заявки</h2>
        </div>

        {!requests || requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">Нямаш заявки все още</p>
            <p className="mt-1 text-xs text-gray-400">Създай първата си заявка</p>
            <Link href="/request/new" className="btn-primary mt-4 text-xs">
              Нова заявка
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {(requests as Request[]).map((req) => (
              <Link
                key={req.id}
                href={`/request/${req.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    req.type === 'vacation' ? 'bg-blue-50' : 'bg-orange-50'
                  }`}>
                    {req.type === 'vacation' ? (
                      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {req.type === 'vacation' ? 'Платен отпуск' : 'Болничен'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(req.date_from), 'd MMM', { locale: bg })} –{' '}
                      {format(new Date(req.date_to), 'd MMM yyyy', { locale: bg })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={req.status} />
                  <svg className="h-4 w-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
