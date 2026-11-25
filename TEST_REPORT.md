# YASHNAR — Test va Tekshirish Hisoboti (TEST_REPORT.md)

## 1. Avtomatlashtirilgan Unit Testlar (`src/lib/domain.test.ts`)
- **Buyruq**: `npx --yes tsx --test src/lib/domain.test.ts`
- **Natija**: **7 / 7 o‘tdi**
- **Tekshirilgan mantiq**:
  - MFY nomlarini normallashtirish (Unicode, apostrof, tinish belgilari, registr va bo‘shliqlar).
  - 100 ta daraja formulasi (`25 * (n - 1)^2`) va daraja unvonlari.
  - `Asia/Tashkent` (UTC+5) kun almashish chegarasi (00:00).
  - Kundalik seriya (streak) va 7/30 kunlik bonuslar hisob-kitobi.
  - MFY yuklama formulasi (analitika uchun cheklanmagan %, vizual panel uchun `<=100%`, `>60%` tavsiya).
  - GPS yangilash siyosati (15 soniya cheklov, 20 metr siljish, 60 soniya yurak urishi, 120 soniya eskirish).
  - Zod validatsiya sxemalari (`+998` telefon, >=12 belgi parol, haqiqiy hajm `0 < L <= 100000`, e’tiroz sababi).

## 2. Jonli API + Cloud SQL PostgreSQL Integratsiya Testlari (`src/server/integration.test.ts`)
- **Buyruq**: `npx --yes tsx --test src/server/integration.test.ts`
- **Baza**: Cloud SQL PostgreSQL (`ai-studio-a1501964`, `asia-southeast1`, 32 ta jadval)
- **Natija**: **Barcha tekshiruvlar muvaffaqiyatli o‘tdi**
- **Tekshirilgan oqimlar**:
  - Ommaviy ro‘yxatdan o‘tish (`POST /api/auth/register`) hatto `role: "admin"` yuborilganda ham qat’iy `citizen` rolini yaratadi; fuqaro `/api/admin/*` va `/api/driver/*` da `403` oladi.
  - Ikki mustaqil fuqaro + yangi MFY qo‘shish, normallashtirilgan dublikatni `409` bilan rad etish, ikkinchi fuqaroda MFYning darhol ko‘rinishi.
  - Haqiqiy JPEG rasm yuklash (`sharp` orqali siqish va EXIF o‘chirish) + yopiq saqlash izolyatsiyasi (begona fuqaro `403`, egasi/biriktirilgan haydovchi/admin `200`).
  - Haydovchi bitta faol reys qoidasi (2-reysga `409`), MFY fuqarolariga bazada saqlanadigan bildirishnoma, GPS 15 soniya cheklovi va reys yakunida joylashuvni darhol o‘chirish.
  - Eco ID QR aylantirish, eski tokenni bekor qilish, skanerlashning o‘zida mukofot bermaslik, noto‘g‘ri hajmni rad etish, atomar tasdiqlash va takroriy so‘rovda (idempotency) XP/Eco Ballni faqat bir marta berish.
  - Kundalik viktorinada `correctOptionIndex` klientga uzatilmasligi.
  - Eco Market atomar almashtirish (klient yuborgan soxta narxni e’tiborsiz qoldirish) + Admin idempotent qaytarish (ball va ombor qoldig‘ini faqat bir marta tiklash) + o‘zgarmas audit jurnali.

## 3. Brauzer (Playwright Headless Chromium) Tekshiruvi
- **1-raund (1440×900 Desktop + 390×844 Mobile, Light & Dark)**:
  - Kirish sahifasi (`/`), Administrator Analitika (`/admin/analytics`), YASHNAR AI Tungi rejim (`/admin/ai`), Haydovchi MFYlar mobil ko‘rinishi (`/driver/mfys`) — **0 ta konsol xatoligi**, **0 ta gorizontal toshish**.
  - Aniqlangan va tuzatilgan kamchiliklar:
    - Mobil pastki navigatsiyadagi uzun yorliqlar (`Xarita va G...`) qisqa va aniq yorliqlarga (`Xarita`, `Asosiy`, `Xabar`, `QR kod`) o‘tkazildi.
    - Recharts ustunli grafikda yakka kategoriya kengligi `maxBarSize={56}` bilan muvozanatlandi.
    - Marshrut almashganda sahifa yuqoriga qaytishi uchun `ScrollToTop` qo‘shildi.
- **2-raund (Fuqaro to‘liq UI oqimi)**:
  - Ro‘yxatdan o‘tish (`/register`) → Onboarding (`/onboarding`) → Fuqaro bosh sahifasi (`/citizen`) → Shaxsiy QR (`/citizen/qr`) → Eco Market (`/citizen/market`, 4 ta mahsulot rasmi yuklandi) → Mobil 390×844 ko‘rinishi — **0 ta konsol xatoligi**.

## 4. Tekshirilmagan / Tashqi konfiguratsiya talab qiladigan qismlar
- **Google Sign-In popup oqimi**: Firebase Auth konfiguratsiyasi (`firebase-applet-config.json`) va `/api/auth/google` endpoint tayyor, ammo haqiqiy Google OAuth oynasi foydalanuvchi brauzerida real Google hisobi bilan bosib sinovdan o‘tkaziladi.
- **Tashqi Web Push (VAPID)**: Jadvallar tayyor; brauzer push-bildirishnomalari uchun tashqi VAPID kalitlari sozlanmagan, ichki bildirishnomalar va WebSocket (`/ws`) to‘liq ishlaydi.
- **Tashqi Vercel / Supabase deploy**: Ilova joriy AI Studio Cloud SQL + Express muhitida tekshirilgan; tashqi deploy qadamlari `DEPLOYMENT.md` da keltirilgan.
