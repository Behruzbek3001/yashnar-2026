# YASHNAR — Ishga tushirish va Deploy qo‘llanmasi (DEPLOYMENT.md)

## 1. Muhit o‘zgaruvchilari (`.env.example` asosida)

Ilova quyidagi server o‘zgaruvchilaridan foydalanadi:

- `SQL_HOST`, `SQL_PORT`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME` — PostgreSQL (Cloud SQL) ulanish ma’lumotlari.
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` — Drizzle sxema migratsiyalari uchun.
- `GEMINI_API_KEY` (yoki ixtiyoriy `OPENAI_API_KEY`) — **YASHNAR AI** (`/api/admin/ai`) tahlil xizmati uchun.
- `APP_URL` — Ilovaning joriy URL manzili.

## 2. AI Studio / Cloud Run + Cloud SQL Deploy

1. Cloud SQL PostgreSQL instansiyasi (`asia-southeast1`) proviziyalangan va `src/db/schema.ts` bo‘yicha 32 ta jadval yaratilgan.
2. Build buyrug‘i:
   ```bash
   npm run build
   ```
3. Production start buyrug‘i (`package.json`):
   ```bash
   npm run start
   ```
   (`node server.ts` — Express server port `3000` da `dist/` statik fayllarni, `/api/*` marshrutlarini va `/ws` WebSocket xizmatini birga ishga tushiradi.)

## 3. Tashqi PostgreSQL (masalan, mustaqil Cloud Run / VPS / Render) ga ko‘chirish

1. PostgreSQL 15+ bazasini yarating va `.env` ga `SQL_*` o‘zgaruvchilarini kiriting.
2. Drizzle sxemasini qo‘llang:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   ```
3. `npm run build && npm run start` orqali ishga tushiring.
4. `private_storage/reports/` katalogi uchun doimiy disk (persistent volume) ulang yoki S3/GCS mos adapterga yo‘naltiring.
5. Google Sign-In ishlashi uchun Firebase konsolida yangi domeningizni `Authorized domains` ro‘yxatiga qo‘shing.
