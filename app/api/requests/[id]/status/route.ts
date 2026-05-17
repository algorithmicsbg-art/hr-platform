// app/api/requests/[id]/status/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { appendAuditLog } from '@/lib/audit'
import { extractIP } from '@/lib/auth-helpers'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Само admin може да сменя статус
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { status } = await req.json()

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabase
    .from('requests')
    .update({ status })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await appendAuditLog({
    user_id: user.id,
    action: status === 'approved' ? 'APPROVE_REQUEST' : 'REJECT_REQUEST',
    request_id: id,
    metadata: {
      ip: extractIP(req.headers),
      ua: req.headers.get('user-agent') ?? 'unknown',
    },
  })

  return NextResponse.json({ ok: true })
}
