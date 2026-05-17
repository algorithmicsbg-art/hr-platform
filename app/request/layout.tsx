// app/request/layout.tsx
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import NavBar from '@/components/ui/NavBar'

export default async function RequestLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

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
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
