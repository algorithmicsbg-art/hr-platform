'use client'
// app/auth/setup-2fa/page.tsx
// Потребителят настройва TOTP за първи път

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { TOTPVerifyFormData } from '@/types'

const schema = z.object({
  code: z
    .string()
    .length(6, 'Кодът е точно 6 цифри')
    .regex(/^\d+$/, 'Само цифри'),
})

interface EnrollData {
  id: string
  totp: {
    qr_code: string   // SVG QR код
    secret: string    // За ръчно въвеждане
    uri: string
  }
}

export default function Setup2FAPage() {
  const router = useRouter()
  const supabase = createClient()

  const [enrollData, setEnrollData] = useState<EnrollData | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TOTPVerifyFormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    async function enrollTOTP() {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'HR Platform',
      })

      if (error || !data) {
        setError('Грешка при настройка на 2FA. Моля, опитайте отново.')
        setLoading(false)
        return
      }

      setEnrollData(data as EnrollData)
      setLoading(false)
    }

    enrollTOTP()
  }, [supabase])

  async function onSubmit(formData: TOTPVerifyFormData) {
    if (!enrollData) return
    setVerifying(true)
    setError(null)

    // Стъпка 1: Challenge
    const { data: challengeData, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId: enrollData.id })

    if (challengeErr || !challengeData) {
      setError('Грешка при верификация. Опитайте отново.')
      setVerifying(false)
      return
    }

    // Стъпка 2: Verify с кода
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrollData.id,
      challengeId: challengeData.id,
      code: formData.code,
    })

    if (verifyErr) {
      setError('Грешен код. Проверете приложението и опитайте отново.')
      setVerifying(false)
      return
    }

    // Записваме в audit log чрез API route
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SETUP_2FA', metadata: { factor_id: enrollData.id } }),
    })

    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="mt-2 text-sm text-gray-500">Генериране на QR код...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Настройка на 2FA</h1>
          <p className="mt-1 text-sm text-gray-500">
            Задължително за достъп до системата
          </p>
        </div>

        <div className="card space-y-6">
          {/* Стъпка 1 */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">1</span>
              <p className="text-sm font-medium text-gray-700">
                Инсталирайте Authenticator приложение
              </p>
            </div>
            <p className="ml-8 text-xs text-gray-500">
              Google Authenticator, Authy, или друго TOTP приложение.
            </p>
          </div>

          {/* Стъпка 2 — QR */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">2</span>
              <p className="text-sm font-medium text-gray-700">Сканирайте QR кода</p>
            </div>

            {enrollData && (
              <div className="ml-8 space-y-3">
                <div
                  className="inline-block rounded-lg border border-gray-200 bg-white p-3"
                  dangerouslySetInnerHTML={{ __html: enrollData.totp.qr_code }}
                />

                <div>
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {showSecret ? 'Скрий' : 'Не можете да сканирате? Въведете ръчно'}
                  </button>

                  {showSecret && (
                    <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2">
                      <p className="text-xs text-gray-500 mb-1">Таен ключ:</p>
                      <code className="font-mono text-sm font-medium tracking-wider text-gray-900">
                        {enrollData.totp.secret}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Стъпка 3 — Verify */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-medium text-white">3</span>
              <p className="text-sm font-medium text-gray-700">Въведете кода за потвърждение</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="ml-8 space-y-3">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center font-mono text-xl tracking-[0.5em]"
                  {...register('code')}
                />
                {errors.code && (
                  <p className="form-error">{errors.code.message}</p>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={verifying}>
                {verifying ? 'Верифициране...' : 'Активирай 2FA'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
