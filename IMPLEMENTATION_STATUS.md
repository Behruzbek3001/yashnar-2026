# YASHNAR — Amalga oshirish holati (IMPLEMENTATION_STATUS.md)

## Platforma va arxitektura izohi

Ushbu ilova Google AI Studio to‘liq-stek muhiti uchun **React 19 + Vite + Express (`server.ts`) + Cloud SQL PostgreSQL (Drizzle ORM) + Firebase Auth (Google Sign-In) + WebSockets (`/ws`)** stekida qurilgan.

| Modul | Holat | Izoh |
|---|---|---|
| PostgreSQL 32 jadval sxemasi (`src/db/schema.ts`) | Tayyor va bazaga qo‘llangan | Cloud SQL `ai-studio-a1501964` (`asia-southeast1`) da barcha 32 jadval yaratilgan va tekshirilgan. |
| Email/Parol autentifikatsiya (`scrypt` + HttpOnly cookie) | Tayyor va tekshirilgan | Public ro‘yxatdan o‘tish faqat `citizen` roli bilan cheklangan. |
| Google orqali kirish (Firebase Auth) | Konfiguratsiya qilingan | `firebase-applet-config.json` mavjud va `/api/auth/google` Firebase ID tokenni tekshiradi; brauzer popup oqimi real Google hisobini talab qiladi. |
| Onboarding va foydalanuvchi qo‘shadigan MFY | Tayyor va tekshirilgan | Namangan viloyati + 14 tuman; yangi MFY normallashtirilib (`normalized_name`) bazaga saqlanadi va barcha foydalanuvchilarga darhol ko‘rinadi. |
| Chiqindi murojaati + kamera + rasmni qayta ishlash (`sharp`) | Tayyor va tekshirilgan | `sharp` orqali JPEG 82% ga siqiladi (<=1600px, EXIF tozalanadi), `private_storage/reports/` da saqlanadi; `/api/storage/reports/:id` rol va MFY huquqini tekshiradi. |
| Shaxsiy Eco ID QR (256-bit, digest, 10 daqiqa) | Tayyor va tekshirilgan | Baza faqat SHA-256 digest saqlaydi; rotate/revoke/expiry ishlaydi; skanerlashning o‘zi mukofot bermaydi. |
| Haydovchi MFY yuklamasi, reyslar, GPS va QR tasdiqlash | Tayyor va tekshirilgan | 1 ta faol reys cheklovi, 15s/20m/60s GPS qoidasi, reys tugashida joylashuvni o‘chirish, atomar va idempotent QR yig‘im tasdiqlash. |
| XP, 100 daraja, seriyalar, kundalik topshiriqlar (Asia/Tashkent) | Tayyor va tekshirilgan | Server-side viktorina tekshiruvi (`correctOptionIndex` klientga uzatilmaydi), ledger asosidagi hisob-kitob. |
| Tuman reytingi, Eco Market, Hamyon va Admin Refund | Tayyor va tekshirilgan | `FOR UPDATE` qator qulflari bilan atomar almashtirish, bazadagi narx ustuvorligi, idempotent qaytarish (ball va ombor qoldig‘ini bir marta tiklaydi). |
| Administrator paneli (14 bo‘lim + Audit jurnali) | Tayyor va tekshirilgan | Analitika (`Recharts`), MFY tasdiqlash/birlashtirish, haydovchi biriktirish, sahifalangan fuqarolar, sozlamalar, audit jurnali. |
| YASHNAR AI (`/admin/ai`) | Tayyor | Faqat nazorat qilinadigan server-side PostgreSQL agregatsiyalarini uzatadi (erkin SQL yo‘q). `OPENAI_API_KEY` yoki `GEMINI_API_KEY` orqali ishlaydi. |
| PWA (Manifest, ikonalar, Service Worker, `offline.html`) | Tayyor | `vite-plugin-pwa` orqali generatsiya qilinadi; `/api/*` so‘rovlari `NetworkOnly`. |
| Tashqi Web Push (VAPID) | Jadval tayyor, VAPID kalitlari ixtiyoriy | `push_subscriptions` va `notification_deliveries` jadvallari yaratilgan; ichki bildirishnomalar va WebSocket real-time yangilanish to‘liq ishlaydi. |
| Tashqi Vercel / Supabase deploy | Qo‘llanma tayyor | Ushbu muhit AI Studio Cloud Run + Cloud SQL da ishlaydi; tashqi deploy qadamlari `DEPLOYMENT.md` da keltirilgan. |
