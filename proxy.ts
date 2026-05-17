// middleware.ts
// Защита на routes — проверява сесия и 2FA ниво

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes, изискващи само валидна сесия (без 2FA)
const AUTH_ROUTES = ['/auth/login', '/auth/verify-2fa', '/auth/setup-2fa']

// Routes, изискващи пълна 2FA сесия (AAL2)
const PROTECTED_ROUTES = ['/dashboard', '/request', '/admin']

export async function proxy(request: NextRequest) {  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { pathname } = request.nextUrl

  // Пропусни статични файлове и API routes (освен защитените)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return response
  }

  // Вземи текущата сесия
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r))
  const isAdmin = pathname.startsWith('/admin')

  // 1. Непознат потребител се опитва да достъпи защитен route
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // 2. Логнат потребител се опитва да отиде в auth routes → към dashboard
  if (user && isAuthRoute && pathname !== '/auth/setup-2fa' && pathname !== '/auth/verify-2fa') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 3. Проверка на AAL (Authenticator Assurance Level) за защитени routes
  if (user && isProtected) {
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    // Потребителят има 2FA enrolled, но не е верифицирал в тази сесия
    if (
      aalData?.nextLevel === 'aal2' &&
      aalData?.currentLevel !== 'aal2' &&
      pathname !== '/auth/verify-2fa'
    ) {
      return NextResponse.redirect(new URL('/auth/verify-2fa', request.url))
    }

    // Потребителят няма 2FA настроен → към setup
    if (
      aalData?.currentLevel === 'aal1' &&
      aalData?.nextLevel === 'aal1' &&
      pathname !== '/auth/setup-2fa'
    ) {
      return NextResponse.redirect(new URL('/auth/setup-2fa', request.url))
    }
  }

  // 4. Admin check — само потребители с роля 'admin'
  if (user && isAdmin) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // 5. Root redirect
  if (pathname === '/') {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url))
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  return response
}
export { proxy as middleware }
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
