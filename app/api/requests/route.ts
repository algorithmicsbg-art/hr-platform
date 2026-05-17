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
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalData?.currentLevel !== 'aal2') {
    return NextResponse.json({ error: '2FA required' }, { status: 403 })
  }

  const body = await req.json()
  const ip = extractIP(req.headers)
  const ua = req.headers.get('user-agent') ?? 'unknown'
  const { data: userData } = await supabase.auth.getUser()
  const claims = extract2FAClaims(userData.user!)

  // Генерираме временен ID за заявката
  const tempId = crypto.randomUUID()

  // Генерираме PDF преди INSERT
  let pdfPath: string | null = null
  try {
    const pdfBytes = await generateRequestPDF({
      user: { email: user.email!, full_name: user.email! },
      request: {
        id: tempId,
        type: body.type,
        date_from: body.date_from,
        date_to: body.date_to,
        notes: body.notes,
        created_at: new Date().toISOString(),
      },
      claims,
      ip,
      ua,
    })

    pdfPath = `requests/${tempId}/document.pdf`
    await supabase.storage
      .from('documents')
      .upload(pdfPath, pdfBytes, { contentType: 'application/pdf', upsert: true })

  } catch (pdfErr: any) {
    console.error('[pdf] Error:', pdfErr?.message)
  }

  // INSERT с pdf_path наведнъж
  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      id: tempId,
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
      pdf_path: pdfPath,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await appendAuditLog({
    user_id: user.id,
    action: 'SUBMIT_REQUEST',
    request_id: request.id,
    metadata: { type: body.type, ip, ua },
  })

  return NextResponse.json({ id: request.id })
}
