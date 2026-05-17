// app/admin/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import StatusBadge from '@/components/ui/StatusBadge'
import { format } from 'date-fns'
import { bg } from 'date-fns/locale'

export default async function AdminPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: requests } = await supabase
    .from('requests')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })

  const pending = requests?.filter(r => r.status === 'pending').length ?? 0
  const approved = requests?.filter(r => r.status === 'approved').length ?? 0
  const rejected = requests?.filter(r => r.status === 'rejected').length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Администрация</h1>
        <p className="mt-0.5 text-sm text-gray-500">Всички заявки от служителите</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-semibold text-amber-600">{pending}</p>
          <p className="mt-1 text-xs text-gray-500">Изчакващи</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-semibold text-green-600">{approved}</p>
          <p className="mt-1 text-xs text-gray-500">Одобрени</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-semibold text-red-600">{rejected}</p>
          <p className="mt-1 text-xs text-gray-500">Отказани</p>
        </div>
      </div>

      {/* Requests list */}
      <div className="card p-0 overflow-hidden">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-900">Всички заявки</h2>
        </div>

        {!requests || requests.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">Няма заявки</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map((req: any) => (
              <Link
                key={req.id}
                href={`/admin/${req.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{req.type === 'vacation' ? '🏖️' : '🏥'}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {req.profiles?.full_name ?? 'Служител'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {req.type === 'vacation' ? 'Платен отпуск' : 'Болничен'} · {' '}
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
