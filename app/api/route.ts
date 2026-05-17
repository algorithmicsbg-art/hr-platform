// app/api/requests/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { appendAuditLog } from '@/lib/audit'
import { extract2FAClaims, extractIP } from '@/lib/auth-helpers'
import { generateRequestPDF } from '@/lib/pdf/generate'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    console.error('DEBUG body:', JSON.stringify(body))

    return NextResponse.json({ debug: 'ok', body })
  } catch(e: any) {
    console.error('FATAL:', e.message, e.stack)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Проверка за 2FA
  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalData?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: '2FA required' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIP(req.headers)
  const ua = req.headers.get('user-agent') ?? 'unknown'

  // Взимаме профила
  const profile = { full_name: user.email ?? 'Служител' }

  // Взимаме 2FA claims
  const { data: userData } = await supabase.auth.getUser()
  const claims = extract2FAClaims(userData.user!)

  // Записваме заявката
  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      user_id: user.id,
      type: body.type,
      date_from: body.date_from,
      date_to: body.date_to,
      notes: body.notes,
      document_path: body.document_path ?? null,
      auth_method: claims.method,
      auth_at: claims.verified_at,
      ip_address: ip,
      user_agent: ua,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('[requests] DB error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Генерираме PDF
  try {
    const pdfBytes = await generateRequestPDF({
      user: { email: user.email!, full_name: profile?.full_name ?? user.email! },
      request,
      claims,
      ip,
      ua,
    })

    const pdfPath = `requests/${request.id}/document.pdf`
    await supabase.storage
      .from('documents')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

    await supabase
      .from('requests')
      .update({ pdf_path: pdfPath })
      .eq('id', request.id)

    request.pdf_path = pdfPath
  } catch (pdfErr) {
    console.error('[pdf] Failed to generate PDF:', pdfErr)
    // Не спираме flow-а ако PDF генерацията се провали
  }

  // Одитен лог
  await appendAuditLog({
    user_id: user.id,
    action: 'SUBMIT_REQUEST',
    request_id: request.id,
    metadata: { type: body.type, ip, ua },
  })

  return NextResponse.json({ id: request.id })
}
