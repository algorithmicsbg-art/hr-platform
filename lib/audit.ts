// lib/audit.ts
// Append-only одитен лог — никога не се трие или редактира

import type { AuditAction } from '@/types'
import { createServiceClient } from '@/lib/supabase/server'

interface AuditEntry {
  user_id: string | null
  action: AuditAction
  request_id?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Записва събитие в одитния лог.
 * Използва service role client за да заобиколи RLS (само INSERT е позволен).
 * При грешка — логва в конзолата, но НЕ хвърля exception,
 * за да не блокира основния flow при временен DB проблем.
 */
export async function appendAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createServiceClient()

    const { error } = await supabase.from('audit_log').insert({
      user_id: entry.user_id,
      action: entry.action,
      request_id: entry.request_id ?? null,
      metadata: entry.metadata ?? {},
    })

    if (error) {
      console.error('[audit] Failed to write audit log:', error.message)
    }
  } catch (err) {
    console.error('[audit] Unexpected error:', err)
  }
}
