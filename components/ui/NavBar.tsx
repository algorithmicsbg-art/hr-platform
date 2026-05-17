'use client'
// components/ui/NavBar.tsx

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/types'

interface NavBarProps {
  userName: string
  userRole: UserRole
}

export default function NavBar({ userName, userRole }: NavBarProps) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900">HR Platform</span>
        </Link>

        {/* Links */}
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
          >
            Моите заявки
          </Link>
          <Link
            href="/request/new"
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition"
          >
            Нова заявка
          </Link>
          {userRole === 'admin' && (
            <Link
              href="/admin"
              className="rounded-lg px-3 py-1.5 text-sm text-brand-600 hover:bg-brand-50 transition font-medium"
            >
              Администрация
            </Link>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-400">
              {userRole === 'admin' ? 'Администратор' : 'Служител'} · 2FA активен
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-800">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition"
            title="Изход"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
