// lib/auth-helpers.ts
// Помощни функции за автентикация и 2FA

import type { User } from '@supabase/supabase-js'
import type { TwoFAClaims } from '@/types'

/**
 * Извлича 2FA данни от Supabase User обекта.
 * Supabase MFA записва верифицираните фактори в user.factors[].
 */
export function extract2FAClaims(user: User): TwoFAClaims {
  const factors = user?.factors ?? []
  const verified = factors.find((f) => f.status === 'verified')

  return {
    mfa_verified: !!verified,
    method: verified?.factor_type ?? 'none',
    verified_at: verified?.updated_at ?? null,
    factor_id: verified?.id ?? null,
  }
}

/**
 * Проверява дали потребителят е преминал 2FA в текущата сесия.
 * Използва Supabase Authenticator Assurance Level (AAL).
 * AAL2 = 2FA е верифициран, AAL1 = само парола.
 */
export function is2FAVerified(
  aalData: { currentLevel: string | null; nextLevel: string | null } | null,
): boolean {
  return aalData?.currentLevel === 'aal2'
}

/**
 * Форматира метода на автентикация за показване в UI и PDF.
 */
export function formatAuthMethod(method: string): string {
  const map: Record<string, string> = {
    totp: 'TOTP (Authenticator App)',
    phone: 'SMS OTP',
    none: 'Няма',
  }
  return map[method] ?? method.toUpperCase()
}

/**
 * Извлича IP адрес от Request headers.
 * Работи с Vercel, Cloudflare, и директен Node.js.
 */
export function extractIP(headers: Headers): string {
  return (
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
