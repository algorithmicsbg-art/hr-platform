'use client'
// app/auth/verify-2fa/page.tsx
// Верификация на TOTP при всеки вход

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

export default function Verify2FAPage() {
  const router = useRouter()
  const supabase = createClient()

  const [factorId, setFactorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setFocus,
  } = useForm<TOTPVerifyFormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    async function loadFactors() {
      const { data } = await supabase.auth.mfa.listFactors()
      const totp = data?.totp?.[0]

      if (!totp) {
        // Няма enrollment → към setup
        router.push('/auth/setup-2fa')
        return
      }

      setFactorId(totp.id)
      setLoading(false)
      setTimeout(() => setFocus('code'), 100)
    }

    loadFactors()
  }, [supabase, router, setFocus])

  async function onSubmit(formData: TOTPVerifyFormData) {
    if (!factorId) return
    setVerifying(true)
    setError(null)

    // Стъпка 1: Създаваме challenge
    const { data: challengeData, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId })

    if (challengeErr || !challengeData) {
      setError('Грешка при верификация. Опитайте отново.')
      setVerifying(false)
      return
    }

    // Стъпка 2: Верифицираме с кода
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: formData.code,
    })

    if (verifyErr) {
      setError('Грешен код. Проверете приложението и опитайте отново.')
      setVerifying(false)
      return
    }

    // Записваме LOGIN_2FA в audit log
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'LOGIN_2FA',
        metadata: { factor_id: factorId },
      }),
    })

    router.push('/dashboard')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Двуфакторна проверка</h1>
          <p className="mt-1 text-sm text-gray-500">
            Въведете кода от вашето Authenticator приложение
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <label htmlFor="code">6-цифрен код</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                className="text-center font-mono text-2xl tracking-[0.5em]"
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
              {verifying ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Верифициране...
                </>
              ) : 'Потвърди'}
            </button>
          </form>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <button
              onClick={handleLogout}
              className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition"
            >
              Изход → Вход с друг акаунт
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Кодът е валиден 30 секунди и се обновява автоматично
        </p>
      </div>
    </div>
  )
}
