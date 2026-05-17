// app/api/requests/[id]/pdf/route.ts
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: request } = await supabase
    .from('requests')
    .select('pdf_path, user_id')
    .eq('id', id)
    .single()

  if (!request?.pdf_path) {
    return NextResponse.json({ error: 'PDF not found', id, pdf_path: request?.pdf_path }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from('documents')
    .download(request.pdf_path)

  if (error || !data) {
    return NextResponse.json({ error: 'Download failed', details: error?.message }, { status: 500 })
  }

  const buffer = await data.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="request-${id.slice(0, 8)}.pdf"`,
    },
  })
}
