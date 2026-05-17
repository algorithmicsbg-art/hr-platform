'use client'
// app/request/new/page.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { RequestFormData } from '@/types'

const schema = z.object({
  type: z.enum(['vacation', 'sick_leave']),
  date_from: z.string().min(1, 'Изберете начална дата'),
  date_to: z.string().min(1, 'Изберете крайна дата'),
  notes: z.string().max(500).optional(),
}).refine(d => d.date_to >= d.date_from, {
  message: 'Крайната дата трябва да е след началната',
  path: ['date_to'],
})

export default function NewRequestPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'vacation' },
  })

  const type = watch('type')

  async function onSubmit(data: RequestFormData) {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не сте влезли в системата')

      // Вземаме 2FA данни
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData?.currentLevel !== 'aal2') {
        router.push('/auth/verify-2fa')
        return
      }

      let documentPath = null

      // Качваме болничния документ ако има
      if (data.type === 'sick_leave' && file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file)

        if (uploadError) throw new Error('Грешка при качване на документа')
        documentPath = fileName
      }

      // Създаваме заявката
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: data.type,
          date_from: data.date_from,
          date_to: data.date_to,
          notes: data.notes ?? '',
          document_path: documentPath,
        }),
      })

      if (!res.ok) throw new Error('Грешка при създаване на заявката')
      const result = await res.json()
      router.push(`/request/${result.id}`)

    } catch (err: any) {
      setError(err.message ?? 'Възникна грешка')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Нова заявка</h1>
        <p className="mt-0.5 text-sm text-gray-500">Заявка за отпуск или болничен</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

          {/* Тип */}
          <div>
            <label>Тип заявка</label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition ${
                type === 'vacation' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}>
                <input type="radio" value="vacation" {...register('type')} className="hidden" />
                <span className="text-2xl">🏖️</span>
                <div>
                  <p className="text-sm font-medium">Отпуск</p>
                  <p className="text-xs text-gray-500">Платен отпуск</p>
                </div>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition ${
                type === 'sick_leave' ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
              }`}>
                <input type="radio" value="sick_leave" {...register('type')} className="hidden" />
                <span className="text-2xl">🏥</span>
                <div>
                  <p className="text-sm font-medium">Болничен</p>
                  <p className="text-xs text-gray-500">Медицински отпуск</p>
                </div>
              </label>
            </div>
          </div>

          {/* Дати */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="date_from">От дата</label>
              <input id="date_from" type="date" {...register('date_from')} />
              {errors.date_from && <p className="form-error">{errors.date_from.message}</p>}
            </div>
            <div>
              <label htmlFor="date_to">До дата</label>
              <input id="date_to" type="date" {...register('date_to')} />
              {errors.date_to && <p className="form-error">{errors.date_to.message}</p>}
            </div>
          </div>

          {/* Бележка */}
          <div>
            <label htmlFor="notes">Бележка (незадължително)</label>
            <textarea
              id="notes"
              rows={3}
              placeholder="Допълнителна информация..."
              {...register('notes')}
              style={{ resize: 'none' }}
            />
          </div>

          {/* Upload за болничен */}
          {type === 'sick_leave' && (
            <div>
              <label>Болничен лист</label>
              <div className={`mt-1 rounded-lg border-2 border-dashed p-4 text-center transition ${
                file ? 'border-green-400 bg-green-50' : 'border-gray-300'
              }`}>
                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-700">✓ {file.name}</p>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Премахни
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-sm text-gray-500">Натиснете за качване</p>
                    <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG до 10MB</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1"
            >
              Назад
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? 'Изпращане...' : 'Подай заявка'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
