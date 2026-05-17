// types/index.ts

export type UserRole = 'employee' | 'admin'

export type RequestType = 'vacation' | 'sick_leave'

export type RequestStatus = 'pending' | 'approved' | 'rejected'

export type AuditAction =
  | 'LOGIN_2FA'
  | 'SETUP_2FA'
  | 'SUBMIT_REQUEST'
  | 'UPLOAD_DOCUMENT'
  | 'APPROVE_REQUEST'
  | 'REJECT_REQUEST'
  | 'GENERATE_PDF'

// ─── Database rows ────────────────────────────────────────

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface Request {
  id: string
  user_id: string
  type: RequestType
  date_from: string          // ISO date: "2026-05-20"
  date_to: string
  notes: string | null
  status: RequestStatus
  document_path: string | null   // болничен в Supabase Storage
  pdf_path: string | null        // генериран PDF
  auth_method: string | null     // 'totp'
  auth_at: string | null         // ISO timestamptz
  ip_address: string | null
  user_agent: string | null
  created_at: string
  // joined
  profile?: Profile
}

export interface AuditLog {
  id: number
  user_id: string | null
  action: AuditAction
  request_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ─── 2FA Claims (извличани от JWT) ───────────────────────

export interface TwoFAClaims {
  mfa_verified: boolean
  method: string          // 'totp' | 'none'
  verified_at: string | null
  factor_id: string | null
}

// ─── Form schemas ─────────────────────────────────────────

export interface LoginFormData {
  email: string
  password: string
}

export interface TOTPVerifyFormData {
  code: string            // 6-цифрен код
}

export interface RequestFormData {
  type: RequestType
  date_from: string
  date_to: string
  notes: string
  document?: File         // само за sick_leave
}
