// app/app/layout.tsx
// Layout за защитените pages — проверява сесия server-side

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import NavBar from '@/components/ui/NavBar'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // Зареждаме профила за navbar
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar
        userName={profile?.full_name ?? user.email ?? 'Потребител'}
        userRole={profile?.role ?? 'employee'}
      />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  )
}
