export interface DailyQuizSeedItem {
  templateCode: string;
  title: string;
  description: string;
  questionText: string;
  options: [string, string, string, string];
  correctOptionIndex: 0 | 1 | 2 | 3;
}

interface RawQuizItem {
  topic: string;
  q: string;
  o: [string, string, string, string];
  a: 0 | 1 | 2 | 3;
}

const RAW_QUIZ_ITEMS: RawQuizItem[] = [
  // 1–20: Chiqindini saralash va plastik
  {
    topic: 'Plastik qayta ishlash',
    q: 'Plastik ichimlik shishasi tabiiy muhitda to‘liq parchalanishi o‘rtacha qancha vaqt oladi?',
    o: ['1–2 yil', '10–15 yil', '400–450 yil', '6 oy'],
    a: 2,
  },
  {
    topic: 'Chiqindini saralash',
    q: 'Qaysi turdagi chiqindini qayta ishlashga topshirishdan oldin yuvib, quruq holda saqlash tavsiya etiladi?',
    o: ['Plastik va shisha idishlarni', 'Oziq-ovqat qoldiqlarini', 'Nam daraxt barglarini', 'Qurilish qumini'],
    a: 0,
  },
  {
    topic: 'Plastik markirovkasi',
    q: 'Plastik idishlar tagidagi “1 (PET)” belgisi nimani anglatadi?',
    o: ['Qayta ishlanmaydigan metall', 'Ichimlik shishalari uchun qayta ishlanadigan PET plastik', 'Organik o‘g‘it', 'Shisha turi'],
    a: 1,
  },
  {
    topic: 'Plastikni ixchamlash',
    q: 'Plastik shishani chiqindi qutisiga tashlashdan oldin nega uni siqib (ezib) qo‘yish foydali?',
    o: ['Og‘irligini oshirish uchun', 'Kamroq joy egallashi va tashish xarajatini kamaytirish uchun', 'Rangini o‘zgartirish uchun', 'Suvga aylanishi uchun'],
    a: 1,
  },
  {
    topic: 'Plastik paketlar',
    q: 'Bir martalik plastik paketlar o‘rniga eng ekologik muqobil nima?',
    o: ['Qalinroq plastik paket', 'Ko‘p martalik mato (paxta) eko sumka', 'Alyuminiy folga', 'Karton quti har safar tashlash uchun'],
    a: 1,
  },
  {
    topic: 'Mikroplastik',
    q: 'Mikroplastik zarrachalar atrof-muhitga qanday xavf tug‘diradi?',
    o: ['Tuproqni tez unumdor qiladi', 'Suv va oziq-ovqat zanjiriga kirib tirik organizmlarga zarar yetkazadi', 'Havoni kislorod bilan boyitadi', 'Hech qanday ta’sir ko‘rsatmaydi'],
    a: 1,
  },
  {
    topic: 'HDPE plastik',
    q: 'Shampun va kir yuvish vositasi idishlari odatda qaysi qayta ishlanadigan plastikdan tayyorlanadi?',
    o: ['2 (HDPE)', 'Faqat shishadan', 'Yog‘ochdan', 'Misdan'],
    a: 0,
  },
  {
    topic: 'Qayta ishlangan plastik',
    q: 'Qayta ishlangan PET shishalardan quyidagilardan qaysi birini ishlab chiqarish mumkin?',
    o: ['Sport kiyimlari uchun tolalar va yangi qadoqlar', 'Tabiiy paxta', 'Toza ichimlik suvi', 'Tabiiy tosh'],
    a: 0,
  },
  {
    topic: 'Bir martalik idishlar',
    q: 'Kundalik hayotda plastik chiqindini eng tez kamaytirish usuli qaysi?',
    o: ['Ko‘p martalik termo suv idishidan foydalanish', 'Har kuni yangi plastik shisha olish', 'Plastikni yoqib yuborish', 'Plastikni ariqqa tashlash'],
    a: 0,
  },
  {
    topic: 'Plastikni yoqish xavfi',
    q: 'Nima uchun plastik chiqindilarni hovlida yoki ochiq havoda yoqish qat’iyan taqiqlanadi?',
    o: ['Olov tez o‘chib qoladi', 'Havoga dioksin kabi zaharli va kanserogen gazlar chiqadi', 'Kul ko‘payib ketadi', 'Plastik umuman yonmaydi'],
    a: 1,
  },
  {
    topic: 'Qadoqlash madaniyati',
    q: 'Do‘kondan meva-sabzavot xarid qilganda chiqindini kamaytirish uchun nima qilish kerak?',
    o: ['Har bir mevani alohida paketga solish', 'Ko‘p martalik to‘r xaltachadan foydalanish', 'Ikki qavat paket olish', 'Qadoqlanganini tanlab, paketini ko‘chaga tashlash'],
    a: 1,
  },
  {
    topic: 'Plastik qopqoqlar',
    q: 'Plastik shisha qopqoqlari odatda shishaning o‘zidan qaysi jihati bilan farq qiladi?',
    o: ['Boshqa turdagi plastikdan (HDPE/PP) tayyorlanadi va alohida ham qayta ishlanadi', 'Metalldan yasaladi', 'Qog‘ozdan yasaladi', 'Qayta ishlanmaydi'],
    a: 0,
  },
  {
    topic: 'Stakanlar',
    q: 'Qahvaxonalardagi “qog‘oz” bir martalik stakanlar nima uchun oson qayta ishlanmaydi?',
    o: ['Juda og‘ir bo‘lgani uchun', 'Ichki qismida yupqa plastik qoplama bo‘lgani uchun', 'Rangli bo‘lgani uchun', 'Issiq suvga chidamsiz bo‘lgani uchun'],
    a: 1,
  },
  {
    topic: 'Chiqindini saralash',
    q: 'Chiqindilarni uyda saralashning eng asosiy foydasi nima?',
    o: ['Poligonlarga boradigan chiqindi hajmi kamayadi va xomashyo qayta ishlanadi', 'Chiqindi mashinasi kelmaydi', 'Elektr sarfi oshadi', 'Suv iste’moli ko‘payadi'],
    a: 0,
  },
  {
    topic: 'Plastik naychalar',
    q: 'Bir martalik plastik ichimlik naychalari (trubochkalar) o‘rniga nima tavsiya etiladi?',
    o: ['Ko‘p martalik metall, shisha yoki bambuk naychalar yoxud umuman ishlatmaslik', 'Ikkita plastik naycha ishlatish', 'Kattaroq plastik naycha', 'Plastik paket'],
    a: 0,
  },
  {
    topic: 'Chiqindi konteynerlari',
    q: 'Agar qayta ishlanadigan qog‘ozga yog‘ yoki ovqat to‘kilsa nima bo‘ladi?',
    o: ['Sifati yaxshilanadi', 'Qayta ishlashga yaroqsiz bo‘lib qoladi', 'Tezroq qog‘ozga aylanadi', 'Hech narsa o‘zgarmaydi'],
    a: 1,
  },
  {
    topic: 'Aralash chiqindi',
    q: 'Quruq qayta ishlanadigan chiqindilar bilan nam oziq-ovqat qoldiqlarini aralashtirmaslik nima uchun muhim?',
    o: ['Nam qoldiqlar qog‘oz va plastikni ifloslantirib, qayta ishlashni qiyinlashtiradi', 'Og‘irlikni tenglashtirish uchun', 'Faqat hid chiqmasligi uchun emas, balki rang uchun', 'Aralashtirish yaxshiroq'],
    a: 0,
  },
  {
    topic: 'Qayta ishlash tamoyili',
    q: 'Ekologiyadagi mashhur “3R” tamoyili nimani anglatadi?',
    o: ['Kamaytirish (Reduce), Qayta foydalanish (Reuse), Qayta ishlash (Recycle)', 'Yig‘ish, Yoqish, Ko‘mish', 'Sotib olish, Saqlash, Tashlash', 'Yuvish, Quritish, Bo‘yash'],
    a: 0,
  },
  {
    topic: '3R ustuvorligi',
    q: '“3R” tamoyilida eng birinchi va eng samarali qadam qaysi?',
    o: ['Chiqindini yoqish', 'Ortiqcha iste’mol va chiqindi hosil bo‘lishini kamaytirish (Reduce)', 'Ko‘proq qadoq olish', 'Faqat poligonga tashlash'],
    a: 1,
  },
  {
    topic: 'Poligonlar',
    q: 'Chiqindi poligonlarida organik moddalar kislorodsiz chiriganda qaysi kuchli issiqxona gazi ajraladi?',
    o: ['Kislorod', 'Metan (CH4)', 'Azot', 'Geliy'],
    a: 1,
  },

  // 21–35: Qog‘oz, Shisha va Metall
  {
    topic: 'Qog‘ozni qayta ishlash',
    q: '1 tonna makulatura (qog‘oz) ni qayta ishlash o‘rtacha nechta katta daraxtni saqlab qoladi?',
    o: ['2 ta daraxtni', '17 ta daraxtni', '1 ta daraxtni', 'Daraxtlarni saqlamaydi'],
    a: 1,
  },
  {
    topic: 'Qog‘oz tejash',
    q: 'Ofis va maktablarda qog‘oz sarfini ikki baravar kamaytirishning eng oddiy yo‘li qaysi?',
    o: ['Qog‘ozning ikki tomoniga chop etish va raqamli hujjatlardan foydalanish', 'Qalinroq qog‘oz ishlatish', 'Har sahifani rangli chiqarish', 'Qog‘ozni saqlab qo‘yish'],
    a: 0,
  },
  {
    topic: 'Karton qutilar',
    q: 'Karton qutilarni makulaturaga topshirishdan oldin qanday tayyorlash kerak?',
    o: ['Suvga ivitish', 'Buklab tekislash va ortiqcha skotchlarni olib tashlash', 'Maydalab yoqish', 'Bo‘yoq surtish'],
    a: 1,
  },
  {
    topic: 'Chek qog‘ozlari',
    q: 'Do‘kon kassa cheklari (termoqog‘oz) nima uchun oddiy makulatura bilan birga qayta ishlanmaydi?',
    o: ['Juda kichik bo‘lgani uchun', 'Tarkibida BPA/BPS kimyoviy qoplamasi bo‘lgani uchun', 'Qimmat bo‘lgani uchun', 'Suvda erib ketgani uchun'],
    a: 1,
  },
  {
    topic: 'Alyuminiy',
    q: 'Alyuminiy ichimlik bankalarini sifatini yo‘qotmasdan necha marta qayta ishlash mumkin?',
    o: ['Faqat 1 marta', '3 marta', 'Cheksiz marta', 'Qayta ishlab bo‘lmaydi'],
    a: 2,
  },
  {
    topic: 'Alyuminiy energiyasi',
    q: 'Alyuminiyni qayta ishlash uni rudalardan yangidan ishlab chiqarishga nisbatan qancha energiya tejaydi?',
    o: ['5%', '20%', '95% gacha', 'Energiya tejamaydi'],
    a: 2,
  },
  {
    topic: 'Shisha qayta ishlash',
    q: 'Shisha idishlarni qayta ishlashning asosiy afzalligi nimada?',
    o: ['Shisha 100% qayta eritiladi va sifatini yo‘qotmaydi', 'Shisha tez chirib ketadi', 'Shisha plastikdan yengil', 'Shisha faqat bir marta qayta ishlanadi'],
    a: 0,
  },
  {
    topic: 'Shisha parchalanishi',
    q: 'Shisha shisha idish tabiiy muhitda qancha vaqt saqlanib qolishi mumkin?',
    o: ['1 yil', '10 yil', 'Ming yillardan ortiq (deyarli parchalanmaydi)', '3 oy'],
    a: 2,
  },
  {
    topic: 'Shisha turlari',
    q: 'Qaysi shisha mahsulotini oddiy shisha idishlar bilan aralashtirmaslik kerak?',
    o: ['Murabbo bankasini', 'Sharbat shishasini', 'Singan oyna, lampochka va issiqqa chidamli shisha idishlarni', 'Mineral suv shishasini'],
    a: 2,
  },
  {
    topic: 'Metall chiqindilar',
    q: 'Po‘lat va tunuka konserva bankalarini saralashda qanday oddiy usul bilan ularni ajratish mumkin?',
    o: ['Suvga solib', 'Magnit yordamida (po‘lat magnitga tortiladi)', 'Quyoshda quritib', 'Bo‘yab'],
    a: 1,
  },
  {
    topic: 'Qog‘oz qayta ishlash sikli',
    q: 'Oddiy qog‘oz tolalari taxminan necha marta qayta ishlanishi mumkin?',
    o: ['1 marta', '5–7 marta', '100 marta', 'Hech qachon'],
    a: 1,
  },
  {
    topic: 'Qog‘oz va suv',
    q: '1 tonna qog‘ozni qayta ishlash qancha chuchuk suvni tejaydi?',
    o: ['10 litr', '100 litr', '26 000 litrgacha', 'Suv tejamaydi'],
    a: 2,
  },
  {
    topic: 'Daftarlardan foydalanish',
    q: 'Maktab o‘quv yili tugagach, toza varaqlari qolgan eski daftarlarni nima qilish eng to‘g‘ri?',
    o: ['Axlatga tashlash', 'Qoralama sifatida ishlatish yoki makulaturaga topshirish', 'Yoqib yuborish', 'Ariqqa tashlash'],
    a: 1,
  },
  {
    topic: 'Qayta ishlangan shisha',
    q: 'Singan shishani qayta eritishda yangi xomashyoga qaraganda pech harorati qanday bo‘ladi?',
    o: ['Pastroq bo‘ladi, shu sababli energiya va CO2 kamayadi', 'Ikki baravar yuqori bo‘ladi', 'O‘zgarmaydi', 'Eritib bo‘lmaydi'],
    a: 0,
  },
  {
    topic: 'Kiyim-kechak',
    q: 'Yaxshi holatdagi, ammo kiyilmaydigan kiyimlarni nima qilish ekologik jihatdan to‘g‘ri?',
    o: ['Chiqindiga tashlash', 'Muhtojlarga xayriya qilish yoki qayta ishlash punktiga topshirish', 'Yoqish', 'Yerga ko‘mish'],
    a: 1,
  },

  // 36–50: Organik chiqindi va kompost
  {
    topic: 'Organik chiqindi',
    q: 'Maishiy chiqindilarning katta qismini tashkil etuvchi organik qoldiqlardan qanday foydali mahsulot olish mumkin?',
    o: ['Plastik granula', 'Tabiiy o‘g‘it — kompost', 'Metall qotishma', 'Shisha'],
    a: 1,
  },
  {
    topic: 'Kompost tarkibi',
    q: 'Quyidagilardan qaysi biri uy kompostiga solish uchun mos keladi?',
    o: ['Meva va sabzavot po‘choqlari, choy sha’masi', 'Plastik paketlar', 'Eski batareyalar', 'Singan shisha'],
    a: 0,
  },
  {
    topic: 'Kompostga solinmaydi',
    q: 'Quyidagilardan qaysi birini uy kompostiga SOLMASLIK kerak?',
    o: ['Sabzi po‘choqlari', 'Quruq barglar', 'Plastik, metall va kimyoviy chiqindilar', 'Tuxum po‘choqlari'],
    a: 2,
  },
  {
    topic: 'Oziq-ovqat isrofi',
    q: 'Oziq-ovqat chiqindilarini kamaytirishning eng samarali usuli qaysi?',
    o: ['Bozorga ro‘yxat bilan borish va kerakli miqdorda xarid qilish', 'Har safar ikki baravar ko‘p ovqat pishirish', 'Muzlatkichni tekshirmasdan mahsulot olish', 'Qolgan nonni axlatga tashlash'],
    a: 0,
  },
  {
    topic: 'Xazon yoqish xavfi',
    q: 'Kuzda daraxt barglarini (xazonni) yoqish nima uchun zararli?',
    o: ['Tuproqdagi foydali mikroorganizmlar nobud bo‘ladi va havoga tutun hamda zaharli moddalar tarqaladi', 'Daraxtlar tez o‘sadi', 'Havo tozalanadi', 'Yomg‘ir ko‘payadi'],
    a: 0,
  },
  {
    topic: 'Xazonlardan foydalanish',
    q: 'To‘kilgan daraxt barglarini yoqish o‘rniga nima qilish eng foydali?',
    o: ['Kompost qilib daraxt tagiga tabiiy o‘g‘it sifatida ishlatish', 'Ariqqa tashlash', 'Plastik paketga solib ko‘mish', 'Yo‘lga sochish'],
    a: 0,
  },
  {
    topic: 'Qahva va choy qoldiqlari',
    q: 'Ishlatilgan choy barglari va qahva quyqasidan qanday ekologik foydalanish mumkin?',
    o: ['Xona gullari va bog‘ tuprog‘i uchun tabiiy oziqa sifatida', 'Plastik o‘rnida', 'Yoqilg‘i sifatida', 'Qayta ichish mumkin'],
    a: 0,
  },
  {
    topic: 'Muzlatkich tartibi',
    q: 'Muzlatkichda “birinchi kirgan — birinchi chiqadi” qoidasi nimaga yordam beradi?',
    o: ['Mahsulotlar muddati o‘tib buzilishining va isrofning oldini oladi', 'Elektrni ko‘paytiradi', 'Suvni muzlatadi', 'Hech qanday foydasi yo‘q'],
    a: 0,
  },
  {
    topic: 'Yomg‘ir chuvalchanglari',
    q: 'Vermikompost (chuvalchanglar yordamida kompostlash) nimani tezlashtiradi?',
    o: ['Plastik parchalanishini', 'Organik qoldiqlarning boy biogumus o‘g‘itiga aylanishini', 'Metall zanglashini', 'Shisha erishini'],
    a: 1,
  },
  {
    topic: 'Kompost namligi',
    q: 'Kompost tez va hidsiz yetilishi uchun qanday sharoit zarur?',
    o: ['Yashil (nam) va jigarrang (quruq) qoldiqlar muvozanati hamda havo almashinuvi', 'To‘liq suvga botirib qo‘yish', 'Havo kirmaydigan qilib yopib qo‘yish', 'Benzin sepish'],
    a: 0,
  },
  {
    topic: 'Non isrofi',
    q: 'Qotib qolgan nonni chiqindiga tashlash o‘rniga nima qilish mumkin?',
    o: ['Quritilgan non bo‘laklari (suxarik) yoki qushlar uchun ozuqa tayyorlash', 'Plastik bilan aralashtirish', 'Suvga tashlash', 'Yoqib yuborish'],
    a: 0,
  },
  {
    topic: 'Oziq-ovqat muddati',
    q: 'Qadoqdagi yaroqlilik muddatini xarid paytida tekshirish nimaga foyda beradi?',
    o: ['Sifatsiz mahsulot va oziq-ovqat isrofining oldini oladi', 'Narxni oshiradi', 'Vaqtni behuda ketkazadi', 'Qadoqni og‘irlashtiradi'],
    a: 0,
  },
  {
    topic: 'Bog‘ chiqindilari',
    q: 'Kesilgan kichik shox-shabbalar va o‘tlarni maydalab daraxt tagiga yotqizish (mulchalash) qanday foyda beradi?',
    o: ['Tuproqda namlikni saqlaydi va begona o‘tlarni kamaytiradi', 'Daraxtni quritadi', 'Suvni tez bug‘latadi', 'Hech qanday foyda bermaydi'],
    a: 0,
  },
  {
    topic: 'Organik va metan',
    q: 'Oziq-ovqat qoldiqlarini umumiy chiqindixonaga tashlamay kompost qilish iqlimga qanday ta’sir qiladi?',
    o: ['Metan chiqindisini kamaytirib iqlim o‘zgarishini sekinlashtiradi', 'Metanni ko‘paytiradi', 'Haroratni oshiradi', 'Ta’sir qilmaydi'],
    a: 0,
  },
  {
    topic: 'Tabiiy tuproq',
    q: 'Kompost qo‘shilgan tuproq qanday xususiyatga ega bo‘ladi?',
    o: ['Suvni yaxshi ushlaydi va unumdorligi oshadi', 'Toshga aylanadi', 'O‘simlik o‘smaydi', 'Sho‘rlanadi'],
    a: 0,
  },

  // 51–65: Xavfli va elektron chiqindilar (E-waste)
  {
    topic: 'Batareykalar',
    q: 'Bitta ishlatilgan barmoq batareykasi oddiy axlatga tashlansa, taxminan qancha tuproqni og‘ir metallar bilan ifloslantirishi mumkin?',
    o: ['10 sm²', '20 kvadrat metrgacha tuproqni', 'Hech qancha', 'Faqat 1 gramm'],
    a: 1,
  },
  {
    topic: 'Batareyani topshirish',
    q: 'Ishdan chiqqan batareykalarni qayerga tashlash kerak?',
    o: ['Oddiy maishiy axlat qutisiga', 'Maxsus xavfli chiqindilar yig‘ish qutisiga', 'Ariqqa', 'Kompost chuquriga'],
    a: 1,
  },
  {
    topic: 'Elektron chiqindi',
    q: 'Eski telefon, quvvatlagich va kompyuter qismlari qanday chiqindi turiga kiradi?',
    o: ['Organik chiqindi', 'Elektron chiqindi (E-waste)', 'Qog‘oz chiqindi', 'Qurilish chiqindisi'],
    a: 1,
  },
  {
    topic: 'E-waste qimmati',
    q: 'Eski elektronika qurilmalarini maxsus qayta ishlash nima uchun foydali?',
    o: ['Tarkibidagi mis, oltin va litiy kabi nodir metallar ajratib olinadi hamda zaharli moddalar tabiatga chiqmaydi', 'Faqat plastik olinadi', 'Elektronlar chirib o‘g‘it bo‘ladi', 'Hech qanday foydasi yo‘q'],
    a: 0,
  },
  {
    topic: 'Simobli lampalar',
    q: 'Eski lyuminessent (simobli) lampochkalar sinib qolsa yoki yaroqsiz bo‘lsa, nima uchun ularni oddiy chiqindiga tashlab bo‘lmaydi?',
    o: ['Tarkibida inson salomatligi uchun xavfli simob bug‘lari bor', 'Juda arzon bo‘lgani uchun', 'Plastikdan yasalgani uchun', 'Og‘ir bo‘lgani uchun'],
    a: 0,
  },
  {
    topic: 'LED lampalar',
    q: 'Simobli lampalar o‘rniga LED lampalardan foydalanishning ekologik foydasi nimada?',
    o: ['Kam elektr sarflaydi, uzoq xizmat qiladi va tarkibida simob bo‘lmaydi', 'Ko‘p issiqlik chiqaradi', 'Tez kuyadi', 'Ko‘p elektr sarflaydi'],
    a: 0,
  },
  {
    topic: 'Muddati o‘tgan dorilar',
    q: 'Muddati o‘tgan dori vositalarini unitaz yoki rakovinaga to‘kish nima uchun xavfli?',
    o: ['Quvurni tozalaydi', 'Kimyoviy moddalar suv tizimiga tushib ekotizimni ifloslantiradi', 'Suvni yumshatadi', 'Xavfi yo‘q'],
    a: 1,
  },
  {
    topic: 'Ishlatilgan moy',
    q: 'Avtomobilning ishlatilgan motor moyini yerga yoki kanalizatsiyaga to‘kish qanday oqibatga olib keladi?',
    o: ['1 litr moy minglab litr yer osti suvini ifloslantirishi mumkin', 'Tuproqni oziqlantiradi', 'Suvni tozalaydi', 'Bug‘lanib ketadi'],
    a: 0,
  },
  {
    topic: 'Qayta zaryadlanuvchi batareya',
    q: 'Bir martalik batareykalar o‘rniga qayta zaryadlanuvchi (akkumulyator) batareyalardan foydalanish nimani kamaytiradi?',
    o: ['Xavfli kimyoviy chiqindilar miqdorini yuzlab baravar kamaytiradi', 'Qurilma tezligini', 'Elektr tarmog‘ini', 'Hech narsani'],
    a: 0,
  },
  {
    topic: 'Simobli termometr',
    q: 'Uy sharoitida simobli termometr o‘rniga qaysi turdagi termometrdan foydalanish xavfsizroq?',
    o: ['Raqamli (elektron) yoki simobsiz termometrdan', 'Kattaroq simobli termometrdan', 'Shisha sinig‘idan', 'Farqi yo‘q'],
    a: 0,
  },
  {
    topic: 'Ta’mirlash madaniyati',
    q: 'Kichik nosozligi bor maishiy texnikani darhol tashlash o‘rniga ta’mirlatish nima uchun muhim?',
    o: ['Elektron chiqindini kamaytiradi va tabiiy resurslarni tejaydi', 'Chiqindini ko‘paytiradi', 'Yangi texnika sifatini tushiradi', 'Foydasi yo‘q'],
    a: 0,
  },
  {
    topic: 'Oshxona yog‘i',
    q: 'Qovurishdan qolgan ko‘p miqdordagi o‘simlik yog‘ini rakovinaga quyish nima uchun noto‘g‘ri?',
    o: ['Quvurlarni tiqib qo‘yadi va oqova suvlarni tozalashni qiyinlashtiradi', 'Quvurni yog‘lab yaxshilaydi', 'Suvni tozalaydi', 'Hidsizlantiradi'],
    a: 0,
  },
  {
    topic: 'Bo‘yoq va erituvchilar',
    q: 'Qolgan bo‘yoq va kimyoviy erituvchilarni qanday saqlash yoki yo‘q qilish kerak?',
    o: ['Ariqqa quyish', 'Qopqog‘ini mahkam yopib qayta ishlatish yoki maxsus xavfli chiqindi punktiga topshirish', 'Hovliga sepish', 'Qog‘oz bilan yoqish'],
    a: 1,
  },
  {
    topic: 'Shinalar',
    q: 'Eski avtomobil shinalarini yoqish o‘rniga qanday qayta ishlash mumkin?',
    o: ['Sport va bolalar maydonchalari uchun rezina qoplama tayyorlash', 'Kompost qilish', 'Suvga cho‘ktirish', 'Qog‘oz tayyorlash'],
    a: 0,
  },
  {
    topic: 'Telefon quvvatlagichi',
    q: 'Telefon to‘liq quvvatlangandan so‘ng zaryadlovchini rozetkadan uzib qo‘yish qanday foyda beradi?',
    o: ['Bekorchi (“vampir”) elektr sarfini kamaytiradi va xavfsizlikni oshiradi', 'Telefon xotirasini tozalaydi', 'Internetni tezlashtiradi', 'Foydasi yo‘q'],
    a: 0,
  },

  // 66–80: Suv va energiya tejash
  {
    topic: 'Suv tejash',
    q: 'Tish yuvayotganda suv jo‘mragini yopib qo‘yish bir kishiga kuniga taxminan qancha suv tejash imkonini beradi?',
    o: ['0.1 litr', '10–15 litrgacha', '1000 litr', 'Suv tejamaydi'],
    a: 1,
  },
  {
    topic: 'Tomchilayotgan jo‘mrak',
    q: 'Sekundiga bir tomchi suv oqayotgan nosoz jo‘mrak bir yilda qancha suvni isrof qilishi mumkin?',
    o: ['5 litr', '50 litr', 'Minglab litr (taxminan 5 000–10 000 litr)', '1 litr'],
    a: 2,
  },
  {
    topic: 'Sug‘orish vaqti',
    q: 'Bog‘ va ekinlarni suv tejash maqsadida kunning qaysi paytida sug‘organ ma’qul?',
    o: ['Tush paytida jazirama oftobda', 'Erta tongda yoki kechqurun salqinda (bug‘lanish kam bo‘lganda)', 'Faqat shamolli havoda', 'Farqi yo‘q'],
    a: 1,
  },
  {
    topic: 'Tomchilatib sug‘orish',
    q: 'O‘zbekiston sharoitida qishloq xo‘jaligida suvni 40–50% gacha tejaydigan usul qaysi?',
    o: ['Ariqdan to‘lib oqizish', 'Tomchilatib sug‘orish texnologiyasi', 'Shlang bilan yuvish', 'Tushda sug‘orish'],
    a: 1,
  },
  {
    topic: 'Chuchuk suv zaxirasi',
    q: 'Yer yuzidagi barcha suvning qancha qismi insonlar ichishi mumkin bo‘lgan chuchuk suvdir?',
    o: ['90%', '50%', 'Taxminan 2.5–3% (uning ham katta qismi muzliklarda)', '75%'],
    a: 2,
  },
  {
    topic: 'Ichimlik suvini asrash',
    q: 'Avtomobilni toza ichimlik suvi bilan shlangdan uzoq yuvish o‘rniga nima qilish to‘g‘ri?',
    o: ['Chelak va gubka yordamida yoki suvni qayta aylanuvchi avtoyuvish shoxobchasida yuvish', 'Ikki soat shlangni yoqib qo‘yish', 'Ariq suviga moy to‘kish', 'Farqi yo‘q'],
    a: 0,
  },
  {
    topic: 'Kir yuvish mashinasi',
    q: 'Kir yuvish mashinasidan foydalanganda suv va elektrni qanday tejash mumkin?',
    o: ['Har bir kiyimni alohida yuvish', 'Mashinani me’yorida to‘ldirib va past haroratli (30–40°C) eko-rejimda yuvish', 'Doim 90°C da yuvish', 'Suvni qo‘lda to‘kish'],
    a: 1,
  },
  {
    topic: 'Quyosh energiyasi',
    q: 'Quyosh panellari qaysi energiya turiga kiradi?',
    o: ['Qayta tiklanuvchi (yashil) energiya', 'Qazilma yoqilg‘i', 'Yadroviy energiya', 'Qayta tiklanmaydigan energiya'],
    a: 0,
  },
  {
    topic: 'Energiya samaradorligi',
    q: 'Maishiy texnika yorlig‘idagi qaysi belgi eng yuqori energiya tejamkorligini bildiradi?',
    o: ['A+++ yoki A sinf', 'D sinf', 'G sinf', 'Z sinf'],
    a: 0,
  },
  {
    topic: 'Xona harorati',
    q: 'Yozda konditsionerni 18°C o‘rniga 24–25°C ga sozlash nima beradi?',
    o: ['Elektr energiyasini sezilarli tejaydi va salomatlik uchun qulayroq bo‘ladi', 'Xonani isitib yuboradi', 'Ko‘proq tok sarflaydi', 'Konditsionerni buzadi'],
    a: 0,
  },
  {
    topic: 'Tabiiy yorug‘lik',
    q: 'Kunduzi elektr energiyasini tejashning eng oson usuli qaysi?',
    o: ['Pardalarni ochib tabiiy quyosh yorug‘ligidan foydalanish va keraksiz chiroqlarni o‘chirish', 'Barcha chiroqlarni yoqib qo‘yish', 'Derazalarni yopib qo‘yish', 'Lampochkalarni ko‘paytirish'],
    a: 0,
  },
  {
    topic: 'Issiqlik saqlash',
    q: 'Qishda uyda isitish energiyasini tejash uchun nima qilish muhim?',
    o: ['Deraza va eshik tirqishlarini izolyatsiya qilish', 'Derazalarni doim ochiq qoldirish', 'Isitgichni maksimal darajada yoqib uydan chiqish', 'Devorlarni yupqalashtirish'],
    a: 0,
  },
  {
    topic: 'Choynakda suv qaynatish',
    q: 'Elektr choynakda suv qaynatayotganda energiyani qanday tejash mumkin?',
    o: ['Faqat o‘sha payt kerak bo‘ladigan miqdorda suv quyish', 'Har safar choynakni to‘ldirib qaynatish', 'Suvni qayta-qayta 5 marta qaynatish', 'Qopqog‘ini ochib qaynatish'],
    a: 0,
  },
  {
    topic: 'Suv havzalari tozaligi',
    q: 'Mahalladagi ariq va soylarga chiqindi tashlash qanday muammoga olib keladi?',
    o: ['Suv yo‘llari to‘siladi, qishloq xo‘jaligi va ichimlik suvi sifati buziladi', 'Suv tezroq oqadi', 'Baliqlar ko‘payadi', 'Muammo bo‘lmaydi'],
    a: 0,
  },
  {
    topic: 'Dush va vanna',
    q: 'Suvni tejash nuqtai nazaridan qaysi biri afzalroq?',
    o: ['5 daqiqalik qisqa dush qabul qilish', 'Vannani to‘ldirib suvni oqizib qo‘yish', '30 daqiqa suvni yoqib turish', 'Farqi yo‘q'],
    a: 0,
  },

  // 81–92: Daraxtlar, Havo sifati va O‘zbekiston ekologiyasi
  {
    topic: 'Yashil makon',
    q: 'Shahar va mahallalarda daraxt ekish yozgi jaziramada qanday foyda beradi?',
    o: ['Soya beradi, havo haroratini pasaytiradi va changni ushlab qoladi', 'Haroratni ko‘taradi', 'Changni ko‘paytiradi', 'Foydasi yo‘q'],
    a: 0,
  },
  {
    topic: 'Fotosintez',
    q: 'Daraxtlar fotosintez jarayonida havodan qaysi gazni yutib, kislorod ajratib chiqaradi?',
    o: ['Karbonat angidrid (CO2)', 'Oltingugurt', 'Metan', 'Argon'],
    a: 0,
  },
  {
    topic: 'Orol dengizi sabog‘i',
    q: 'Orol dengizi qurishining asosiy sababi nimadan iborat bo‘lgan?',
    o: ['Amudaryo va Sirdaryo suvlaridan haddan tashqari ko‘p va isrofgarchilik bilan foydalanish', 'Yomg‘ir ko‘p yog‘ishi', 'Daraxtlar ko‘pligi', 'Shamolsiz havo'],
    a: 0,
  },
  {
    topic: 'Saksovul ekish',
    q: 'Orolbo‘yi hududida saksovul o‘rmonzorlari yaratishning asosiy maqsadi nima?',
    o: ['Tuz va qum bo‘ronlarini to‘xtatib, tuproqni mustahkamlash', 'Yog‘och eksport qilish', 'Suvni bug‘latish', 'Yo‘l qurish'],
    a: 0,
  },
  {
    topic: 'Farg‘ona vodiysi suvlari',
    q: 'Namangan viloyati hududidan oqib o‘tadigan va vodiy uchun hayotiy muhim daryo qaysi?',
    o: ['Sirdaryo (Norin va Qoradaryo qo‘shilishidan hosil bo‘ladi)', 'Nil daryosi', 'Amazonka', 'Volga'],
    a: 0,
  },
  {
    topic: 'Ekologik transport',
    q: 'Qisqa masofalarga (1–3 km) borishda havoni eng kam ifloslantiradigan harakatlanish usuli qaysi?',
    o: ['Piyoda yurish yoki velosiped haydash', 'Eski dizel avtomobilida yolg‘iz yurish', 'Mototsikl', 'Yuk mashinasi'],
    a: 0,
  },
  {
    topic: 'Jamoat transporti',
    q: 'Shaxsiy avtomobil o‘rniga jamoat transporti yoki elektrobusdan foydalanish qanday foyda beradi?',
    o: ['Har bir yo‘lovchiga to‘g‘ri keladigan zararli gaz chiqindisini keskin kamaytiradi', 'Tirbandlikni oshiradi', 'Havoni ko‘proq ifloslantiradi', 'Foydasi yo‘q'],
    a: 0,
  },
  {
    topic: 'Avtomobil dvigateli',
    q: 'Avtomobilni to‘xtab turgan holatda dvigatelini o‘chirmay uzoq kutish nima uchun zararli?',
    o: ['Yoqilg‘i behuda yonadi va mahalla havosiga zaharli gazlar tarqaladi', 'Dvigatelni tozalaydi', 'Yoqilg‘i tejaydi', 'Zarari yo‘q'],
    a: 0,
  },
  {
    topic: 'Daraxt parvarishi',
    q: 'Yangi ekilgan ko‘chatning tutib ketishi uchun eng muhim omil nima?',
    o: ['Iqlimga mos nav tanlash va muntazam parvarish hamda sug‘orish', 'Faqat ekib tashlab ketish', 'Qishda muzlatish', 'Plastik bilan o‘rash'],
    a: 0,
  },
  {
    topic: 'PM2.5 chang zarralari',
    q: 'Shaharlardagi havoda PM2.5 mayda chang zarralarini kamaytirishga nima eng ko‘p yordam beradi?',
    o: ['Yashil hududlarni kengaytirish, chiqindi yoqmaslik va ekologik transportga o‘tish', 'Xazonlarni yoqish', 'Daraxtlarni kesish', 'Plastikni yoqish'],
    a: 0,
  },
  {
    topic: 'Biologik xilma-xillik',
    q: 'Qushlar va asalarilar kabi foydali jonivorlarni asrash ekotizim uchun nima uchun zarur?',
    o: ['O‘simliklarni changlatadi va tabiiy muvozanatni saqlaydi', 'Hosilni kamaytiradi', 'Hech qanday ahamiyati yo‘q', 'Faqat shovqin qiladi'],
    a: 0,
  },
  {
    topic: 'Tabiatda dam olish',
    q: 'Tog‘ yoki tabiat qo‘ynida dam olgandan so‘ng nima qilish shart?',
    o: ['Barcha chiqindilarni yig‘ib o‘zi bilan olib ketish va belgilangan qutiga tashlash', 'Daraxt tagiga ko‘mish', 'Soyga oqizib yuborish', 'Shunday qoldirib ketish'],
    a: 0,
  },

  // 93–100: YASHNAR madaniyati va mas’uliyatli iste’mol
  {
    topic: 'YASHNAR murojaati',
    q: 'YASHNAR ilovasida chiqindi murojaatini yuborayotganda nima uchun aniq fotosurat va toifa tanlash muhim?',
    o: ['Haydovchi kerakli hajm va chiqindi turini oldindan bilib, yig‘imni samarali rejalashtirishi uchun', 'Faqat chiroyli ko‘rinishi uchun', 'Ahamiyati yo‘q', 'Rasm avtomatik o‘chib ketadi'],
    a: 0,
  },
  {
    topic: 'YASHNAR QR Eco ID',
    q: 'YASHNAR tizimida chiqindi topshirilganda Eco Ball va XP qachon hisobga o‘tkaziladi?',
    o: ['Haydovchi shaxsiy QR kodingizni skanerlab, haqiqiy hajmni kiritib tasdiqlaganidan so‘ng', 'Faqat ro‘yxatdan o‘tganda', 'Rasmni telefonda saqlaganda', 'Tasdiqlanmasdan avtomatik'],
    a: 0,
  },
  {
    topic: 'Mahalla hashari',
    q: 'Mahalla tozalik hasharlarida qatnashishning asosiy ahamiyati nimada?',
    o: ['Jamoaviy ekologik madaniyatni kuchaytiradi va yashash muhitini toza saqlaydi', 'Vaqtni bekorga sarflaydi', 'Chiqindini ko‘paytiradi', 'Faqat rasmiyatchilik'],
    a: 0,
  },
  {
    topic: 'Mas’uliyatli xarid',
    q: 'Mahalliy ishlab chiqarilgan mavsumiy meva-sabzavotlarni xarid qilish nima uchun ekologik jihatdan foydali?',
    o: ['Uzoq masofaga tashishdagi yoqilg‘i sarfi va uglerod izi kamayadi', 'Ko‘proq plastik ishlatiladi', 'Sifati past bo‘ladi', 'Transport ko‘payadi'],
    a: 0,
  },
  {
    topic: 'Qayta foydalanish',
    q: 'Bo‘shagan shisha bankalardan uyda qanday foydalanish mumkin?',
    o: ['Don-dun, ziravor va murabbo saqlash uchun ko‘p marta ishlatish', 'Darhol sindirib tashlash', 'Ko‘chaga tashlash', 'Yoqish'],
    a: 0,
  },
  {
    topic: 'Ekologik ta’lim',
    q: 'Bolalarda ekologik odatlarni shakllantirishning eng ta’sirli usuli qaysi?',
    o: ['Kattalarning shaxsiy namunasi: birgalikda saralash, daraxt ekish va suvni tejash', 'Faqat kitob o‘qitib qo‘yish', 'Chiqindini ko‘chaga tashlash', 'E’tibor bermaslik'],
    a: 0,
  },
  {
    topic: 'Uglerod izi',
    q: '“Uglerod izi” (carbon footprint) tushunchasi nimani anglatadi?',
    o: ['Inson yoki tashkilot faoliyati natijasida atmosferaga chiqariladigan issiqxona gazlari umumiy miqdorini', 'Tuproqdagi ko‘mir konini', 'Poyabzal izini', 'Daraxt soyasini'],
    a: 0,
  },
  {
    topic: 'Yashil kelajak',
    q: 'Toza mahalla va yashil kelajakni barpo etishda eng muhim qadam nima?',
    o: ['Har bir fuqaroning kundalik kichik, ammo muntazam ekologik odatlari', 'Faqat boshqalarni kutib turish', 'Chiqindini yashirincha tashlash', 'Tabiat resurslarini ayamasdan sarflash'],
    a: 0,
  },
];

export const DAILY_QUIZ_BANK: DailyQuizSeedItem[] = RAW_QUIZ_ITEMS.map((item, idx) => {
  const num = String(idx + 1).padStart(3, '0');
  return {
    templateCode: `daily_quiz_${num}`,
    title: `Kunlik Eko Viktorina #${idx + 1}`,
    description: `Mavzu: ${item.topic}. To‘g‘ri javob topib kunlik XP va Eco Ball oling.`,
    questionText: item.q,
    options: item.o,
    correctOptionIndex: item.a,
  };
});
