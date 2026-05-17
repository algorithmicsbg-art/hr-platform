'use client'
// components/admin/AdminActions.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminActions({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAction(status: 'approved' | 'rejected') {
    setLoading(status === 'approved' ? 'approve' : 'reject')
    setError(null)

    const res = await fetch(`/api/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })

    if (!res.ok) {
      setError('Грешка. Опитайте отново.')
      setLoading(null)
      return
    }

    router.refresh()
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-medium text-gray-900">Действие</h2>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleAction('rejected')}
          disabled={!!loading}
          className="btn-secondary border-red-200 text-red-600 hover:bg-red-50"
        >
          {loading === 'reject' ? 'Отказване...' : '✕ Откажи'}
        </button>
        <button
          onClick={() => handleAction('approved')}
          disabled={!!loading}
          className="btn-primary bg-green-600 hover:bg-green-700"
        >
          {loading === 'approve' ? 'Одобряване...' : '✓ Одобри'}
        </button>
      </div>
    </div>
  )
}
