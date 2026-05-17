# HR Platform — Фаза 1: Auth + Основа

**Версия:** 1.0.0  
**Дата:** 2026-05-15  
**Статус:** ✅ Завършена

---

## Съдържание

1. [Преглед](#преглед)
2. [Структура на файловете](#структура-на-файловете)
3. [Технологичен стек](#технологичен-стек)
4. [Auth Flow](#auth-flow)
5. [Middleware Logic](#middleware-logic)
6. [База данни](#база-данни)
7. [Audit Log](#audit-log)
8. [Как да стартираш локално](#как-да-стартираш-локално)
9. [Следващи стъпки — Фаза 2](#следващи-стъпки--фаза-2)

---

## Преглед

Фаза 1 имплементира:

- Email/парола вход чрез Supabase Auth
- Задължителна TOTP 2FA (Authenticator App) за всички потребители
- AAL2 (Authenticator Assurance Level 2) проверка на всяко protected route
- Автоматичен trigger за създаване на `profiles` запис при регистрация
- Append-only одитен лог за `LOGIN_2FA` и `SETUP_2FA` събития
- Middleware защита на routes с роля-базиран достъп
- Dashboard с преглед на заявките (без заявки — добавя се Фаза 2)

---

## Структура на файловете

```
hr-platform/
├── app/
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Tailwind + custom components
│   ├── auth/
│   │   ├── login/page.tsx          # Email + парола вход
│   │   ├── setup-2fa/page.tsx      # TOTP enrollment (първи вход)
│   │   └── verify-2fa/page.tsx     # TOTP верификация (всеки вход)
│   ├── app/
│   │   ├── layout.tsx              # Protected layout с NavBar
│   │   └── dashboard/page.tsx      # Списък заявки на служителя
│   └── api/
│       └── audit/route.ts          # POST endpoint за одитен лог
├── components/
│   └── ui/
│       ├── NavBar.tsx              # Навигация с logout
│       └── StatusBadge.tsx         # Цветни badge-ове за статус
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client
│   │   └── server.ts               # Server + Service Role client
│   ├── auth-helpers.ts             # extract2FAClaims, is2FAVerified, extractIP
│   └── audit.ts                    # appendAuditLog функция
├── middleware.ts                   # Route protection + AAL2 check
├── types/index.ts                  # TypeScript типове
└── supabase/migrations/
    └── 001_initial.sql             # profiles, requests, audit_log таблици
```

---

## Технологичен стек

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Framework | Next.js App Router | 14.2.0 |
| Auth + DB | Supabase | ^2.43.0 |
| 2FA | Supabase MFA (TOTP) | вградено |
| Стилове | Tailwind CSS | ^3.4 |
| Форми | react-hook-form + zod | ^7 / ^3 |
| PDF | pdf-lib | ^1.17 (Фаза 2) |
| Хостинг | Vercel | — |
| DB регион | eu-central-1 (Frankfurt) | GDPR изискване |

---

## Auth Flow

### Пълен flow при вход

```
[Потребител въвежда email + парола]
        ↓
[Supabase signInWithPassword]
        ↓
[Проверка на AAL ниво]
        ↓
┌──────────────────────────────────────┐
│ nextLevel = 'aal2' AND               │
│ currentLevel ≠ 'aal2'               │ → /auth/verify-2fa
├──────────────────────────────────────┤
│ currentLevel = 'aal1' AND            │
│ nextLevel = 'aal1'                   │ → /auth/setup-2fa (задължително)
├──────────────────────────────────────┤
│ currentLevel = 'aal2'                │ → /dashboard ✅
└──────────────────────────────────────┘
```

### TOTP Setup Flow (първи вход)

```
1. supabase.auth.mfa.enroll({ factorType: 'totp' })
   → получаваме QR код (SVG) и secret key

2. Потребителят сканира QR в Authenticator App

3. supabase.auth.mfa.challenge({ factorId })
   → получаваме challengeId

4. supabase.auth.mfa.verify({ factorId, challengeId, code })
   → AAL ниво се покачва до 'aal2'

5. Записваме SETUP_2FA в audit_log
```

### TOTP Verify Flow (всеки вход)

```
1. supabase.auth.mfa.listFactors()
   → намираме enrollnатия TOTP фактор

2. supabase.auth.mfa.challenge({ factorId })

3. supabase.auth.mfa.verify({ factorId, challengeId, code })
   → сесията получава AAL2

4. Записваме LOGIN_2FA в audit_log
```

---

## Middleware Logic

```typescript
// Приоритетен ред на проверките:

1. Непознат потребител → /auth/login
2. Логнат + auth route → /dashboard
3. AAL2 нужен, но не верифициран → /auth/verify-2fa
4. Без 2FA enrollment → /auth/setup-2fa
5. Admin route + не-admin роля → /dashboard
6. / (root) → redirect по статус
```

**Matcher:** всички routes освен `_next/static`, `_next/image`, `favicon`, и файлове с разширения.

---

## База данни

### profiles

| Колона | Тип | Описание |
|--------|-----|----------|
| `id` | uuid (PK) | Foreign key към `auth.users` |
| `full_name` | text | Пълно ime |
| `role` | text | `'employee'` или `'admin'` |
| `created_at` | timestamptz | Дата на създаване |

**Trigger:** `handle_new_user()` — автоматично създава profile при нов auth user. `full_name` се взема от `user_metadata` или от частта преди `@` в email-а.

### requests

| Колона | Тип | Описание |
|--------|-----|----------|
| `id` | uuid (PK) | Генериран UUID |
| `user_id` | uuid (FK) | Към `profiles.id` |
| `type` | text | `'vacation'` или `'sick_leave'` |
| `date_from` / `date_to` | date | Период |
| `status` | text | `'pending'` / `'approved'` / `'rejected'` |
| `document_path` | text | Болничен лист в Storage |
| `pdf_path` | text | Генериран одитен PDF |
| `auth_method` | text | `'totp'` — метод на 2FA |
| `auth_at` | timestamptz | Кога е верифициран 2FA |
| `ip_address` | text | IP при подаване |
| `user_agent` | text | Браузър/ОС при подаване |

**Constraint:** `date_to >= date_from`

### audit_log

| Колона | Тип | Описание |
|--------|-----|----------|
| `id` | bigserial (PK) | Auto-increment |
| `user_id` | uuid | Кой е извършил действието |
| `action` | text | Вж. `AuditAction` тип |
| `request_id` | uuid | Засегната заявка (ако има) |
| `metadata` | jsonb | IP, UA, factor_id и др. |
| `created_at` | timestamptz | Неизменяем timestamp |

---

## Audit Log

### Действия (AuditAction)

| Константа | Кога се записва |
|-----------|----------------|
| `SETUP_2FA` | При успешен enrollment на TOTP |
| `LOGIN_2FA` | При успешна 2FA верификация при вход |
| `SUBMIT_REQUEST` | При подаване на заявка (Фаза 2) |
| `UPLOAD_DOCUMENT` | При качване на болничен (Фаза 2) |
| `APPROVE_REQUEST` | При одобрение от admin (Фаза 2) |
| `REJECT_REQUEST` | При отказ от admin (Фаза 2) |
| `GENERATE_PDF` | При генериране на PDF (Фаза 2) |

### RLS правила за audit_log

- `INSERT` — позволен за всички автентицирани потребители
- `SELECT` — само за `role = 'admin'`
- `UPDATE` — **забранен** (revoke на ниво DB)
- `DELETE` — **забранен** (revoke на ниво DB)

---

## Как да стартираш локално

### 1. Предварителни изисквания

- Node.js 18+
- npm / yarn / pnpm
- Supabase акаунт (безплатен план)
- Supabase CLI: `npm install -g supabase`

### 2. Supabase проект

```bash
# Влез в Supabase и създай нов проект
# ВАЖНО: Избери регион eu-central-1 (Frankfurt)

# Копирай URL и anon key от Project Settings → API
```

### 3. Инсталация

```bash
git clone <repo>
cd hr-platform

npm install

# Копирай env файла
cp .env.example .env.local
# Попълни NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

### 4. База данни

```bash
# Инициализирай Supabase CLI
npx supabase init

# Линк към твоя проект
npx supabase link --project-ref ТВОЯ_PROJECT_REF

# Push миграциите
npx supabase db push
```

### 5. Supabase Dashboard конфигурация

```
Authentication → Settings:
  ✅ Enable Email/Password sign-in
  ✅ Require email confirmation: OFF (за вътрешна система)

Authentication → MFA:
  ✅ Enable TOTP MFA

Storage → New Bucket:
  Name: documents
  Public: NO (private)
  File size limit: 10MB
  Allowed MIME types: application/pdf, image/jpeg, image/png
```

### 6. Стартиране

```bash
npm run dev
# → http://localhost:3000
```

### 7. Създаване на първи потребители

В Supabase Dashboard → Authentication → Users → Invite user:

```
# Или чрез SQL Editor:
-- Потребителят се създава при регистрация
-- За да дадеш admin права:
UPDATE profiles SET role = 'admin' WHERE id = 'USER_UUID';
```

---

## Следващи стъпки — Фаза 2

- [ ] `app/app/request/new/page.tsx` — форма за нова заявка (отпуск/болничен)
- [ ] `components/requests/RequestForm.tsx` — react-hook-form + zod валидация
- [ ] `components/requests/FileUpload.tsx` — drag & drop upload за болничен лист
- [ ] `app/api/requests/route.ts` — POST /api/requests (създаване + PDF генерация)
- [ ] `app/api/upload/route.ts` — качване в Supabase Storage
- [ ] `app/api/generate-pdf/route.ts` — pdf-lib генерация на одитен документ
- [ ] `app/app/request/[id]/page.tsx` — детайли на заявка + download PDF
- [ ] `lib/pdf/generate.ts` — PDF с 2FA данни, IP, timestamp

---

## Сигурност — бележки

| Тема | Имплементация |
|------|--------------|
| 2FA enforcement | Middleware проверява AAL2 на всеки request |
| RLS | Row Level Security на всяка таблица |
| Service key | Само server-side, никога в client bundle |
| Audit log | Append-only, revoke UPDATE/DELETE на DB ниво |
| GDPR регион | eu-central-1 (Frankfurt) — задължително |
| Health data | Болничните — ограничен достъп чрез Storage RLS |
| Input validation | zod схеми на client и server |

---

*Документ генериран автоматично — HR Platform Фаза 1*
