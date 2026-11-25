# YASHNAR — Toza mahalla, yashil kelajak!

**YASHNAR** — Namangan viloyatida chiqindilarni samarali yig‘ish, nazorat qilish va aholining ekologik faolligini rag‘batlantirish uchun yaratilgan to‘liq funksional, PostgreSQL bazasiga ulangan o‘zbek (lotin) tilidagi veb-ilova (PWA).

## Rollar va asosiy imkoniyatlar

- **Fuqaro (`/citizen/*`)**:
  - Namangan viloyati tumanlari va MFYlari bo‘yicha ro‘yxatdan o‘tish va qidiriladigan ro‘yxat (yangi MFY qo‘shish barcha foydalanuvchilar uchun saqlanadi).
  - Kamera yoki fayl orqali chiqindi murojaati yuborish (`sharp` server-side validatsiya, EXIF o‘chirish, yopiq saqlash).
  - Murojaatlar holat tarixi (timeline), bekor qilish va e’tiroz bildirish.
  - 256-bitli shaxsiy Eco ID QR kodi (10 daqiqalik muddat, qayta yaratish va bekor qilish).
  - Faqat o‘z MFYsiga biriktirilgan faol haydovchini xaritada kuzatish.
  - Toshkent vaqti (UTC+5) bilan 00:00 da yangilanadigan kundalik topshiriqlar (server-side javob tekshiruvi).
  - Tuman reytingi (`Bugun / Haftalik / Oylik / Umumiy`), Eco Market (tranzaksion qoldiq va balans tekshiruvi), Eco Hamyon.

- **Haydovchi (`/driver/*`)**:
  - Faqat biriktirilgan MFYlar ro‘yxati va taxminiy yuklama indikatori (`>60%` da `"Yig‘ish tavsiya etiladi"`).
  - Bir vaqtda faqat 1 ta faol reys ochish, MFY fuqarolariga avtomatik bildirishnoma yuborish.
  - 15 soniya / 20 metr / 60 soniya siyosati bilan GPS ulashish va reys yakunida joylashuvni darhol o‘chirish.
  - Kamera (`jsQR`) orqali QR skanerlash, haqiqiy yig‘ilgan hajmni (litr) kiritib atomar tasdiqlash (XP va Eco Ball faqat bir marta beriladi).

- **Administrator (`/admin/*`)**:
  - Haqiqiy PostgreSQL agregatsiyalariga asoslangan analitika (`Bugun / 7 kun / 30 kun / 90 kun / Maxsus`), jonli xarita.
  - Tuman va MFYlarni boshqarish (tasdiqlash, chegara litrini tahrirlash, MFYlarni birlashtirish).
  - Haydovchilarni tasdiqlash, to‘xtatish va MFYlarga biriktirish; fuqarolarni sahifalab (`25 / 50 / 100`) boshqarish.
  - Murojaat mukofotini tasdiqlash, e’tirozlarni hal qilish, topshiriqlar, eko-faktlar, sovrinlar, buyurtmalarni topshirish va idempotent qaytarish (refund).
  - O‘zgarmas audit jurnali, mukofot qoidalari sozlamalari va **YASHNAR AI** (nazorat qilinadigan server-side analitika asosida tahlil).

## Texnologik stek

- **Frontend**: React 19, TypeScript (strict), Tailwind CSS v4, React Router, TanStack Query, Recharts, Leaflet / OpenStreetMap, `qrcode`, `jsqr`, `vite-plugin-pwa`.
- **Backend**: Express + TypeScript (`server.ts`), WebSockets (`/ws`), `sharp`, Zod.
- **Ma’lumotlar bazasi**: Cloud SQL PostgreSQL + Drizzle ORM (`src/db/schema.ts` — 32 ta jadval).
- **Autentifikatsiya**: Email/Parol (`scrypt` + HttpOnly session cookie) va Firebase Authentication Google Sign-In.

## Ishga tushirish

```bash
npm install
npm run dev
```

## Sinov hisoblari (Reference Seed)

Ilova ilk so‘rovda `ensureSeeded()` orqali Namangan viloyati, 14 ta tuman, 5 ta boshlang‘ich MFY, 100 ta daraja, mukofot qoidalari, topshiriqlar, eko-faktlar, Eco Market sovrinlari hamda quyidagi sinov xodim hisoblarini yaratadi:

- **Administrator**: `admin@yashnar.uz` / `AdminYashnar2026!`
- **Haydovchi**: `driver@yashnar.uz` / `DriverYashnar2026!`
- **Fuqaro**: Istalgan yangi fuqaro hisobini `/register` orqali ochishingiz mumkin (public ro‘yxatdan o‘tish faqat `citizen` rolini yaratadi).

## Testlar va tekshirish

```bash
npm run test        # Pure domain logic unit tests (node:test)
npm run lint        # TypeScript strict typecheck (tsc --noEmit)
npm run build       # Production Vite + PWA build
```
