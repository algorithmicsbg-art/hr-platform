// app/api/audit/route.ts
// Записва одитни събития — само за автентицирани потребители

import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { appendAuditLog } from '@/lib/audit'
import { extractIP } from '@/lib/auth-helpers'
import type { AuditAction } from '@/types'

export async function POST(req: Request) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const action = body.action as AuditAction
  const metadata = body.metadata ?? {}

  await appendAuditLog({
    user_id: user.id,
    action,
    request_id: body.request_id ?? null,
    metadata: {
      ...metadata,
      ip: extractIP(req.headers),
      ua: req.headers.get('user-agent') ?? 'unknown',
    },
  })

  return NextResponse.json({ ok: true })
}
