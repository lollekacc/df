(() => {
  const partials = {
    header: 'partials/header.html',
    footer: 'partials/footer.html',
  };

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const languageCatalog = [
    ['sv', 'Svenska'],
    ['en', 'English'],
    ['ar', 'العربية'],
    ['so', 'Soomaali'],
    ['fa', 'فارسی'],
    ['fi', 'Suomi'],
    ['de', 'Deutsch'],
    ['fr', 'Français'],
    ['es', 'Español'],
    ['pl', 'Polski'],
    ['uk', 'Українська'],
    ['ru', 'Русский'],
    ['tr', 'Türkçe'],
    ['ku', 'Kurdî'],
    ['ti', 'ትግርኛ'],
    ['am', 'አማርኛ'],
    ['da', 'Dansk'],
    ['no', 'Norsk'],
    ['nl', 'Nederlands'],
    ['it', 'Italiano'],
    ['pt', 'Português'],
    ['ro', 'Română'],
    ['cs', 'Čeština'],
    ['hu', 'Magyar'],
    ['el', 'Ελληνικά'],
    ['he', 'עברית'],
    ['ur', 'اردو'],
    ['hi', 'हिन्दी'],
    ['bn', 'বাংলা'],
    ['zh', '中文'],
    ['ja', '日本語'],
    ['ko', '한국어'],
    ['th', 'ไทย'],
    ['vi', 'Tiếng Việt'],
  ];
  const supportedLanguages = languageCatalog.map(([code]) => code);
  const primaryLanguages = new Set(['sv', 'en', 'ar', 'so', 'fa']);
  const rtlLanguages = new Set(['ar', 'fa', 'he', 'ur']);
  const preservedExactTexts = new Set([
    'Amazon Prime',
    'Apollo',
    'Apple',
    'BankID',
    'Dealett',
    'Disney+',
    'Elgiganten',
    'Facebook',
    'Google',
    'H&M',
    'HBO',
    'ICA Maxi',
    'Instagram',
    'Kivra',
    'Mio',
    'Netflix',
    'Swish',
    'Tele2',
    'Telia',
    'Telenor',
    'Ticketmaster',
    'TikTok',
    'Tre',
    'TV4',
    'Viaplay',
    'YouTube',
    'Zalando',
  ]);
  const translatableAttributeNames = [
    'alt',
    'aria-description',
    'aria-label',
    'aria-placeholder',
    'aria-valuetext',
    'label',
    'placeholder',
    'title',
  ];
  const textNodeMemory = new WeakMap();
  const attrMemory = new WeakMap();
  const remoteTranslationCache = new Map();
  const translationCacheStorageKey = 'dealettTranslationCache:v2';
  const maxStoredTranslations = 2500;
  const attemptedRemoteTranslations = new Set();
  const remoteTranslationFailures = new Map();
  const configuredApiBase = 'https://db-qtmd.onrender.com';
  const translationEndpoint = `${configuredApiBase}/api/translate`;
  const queuedRemoteTranslations = new Set();
  let activeLanguage = 'sv';
  let translationObserver = null;
  let translationFrame = 0;
  let translationRequestTimer = 0;
  let queuedTranslationLanguage = 'sv';
  let isApplyingTranslations = false;
  let originalDocumentTitle = '';

  try {
    const storedTranslations = JSON.parse(localStorage.getItem(translationCacheStorageKey) || '[]');
    if (Array.isArray(storedTranslations)) {
      storedTranslations.slice(-maxStoredTranslations).forEach((entry) => {
        if (
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string'
        ) {
          remoteTranslationCache.set(entry[0], entry[1]);
        }
      });
    }
  } catch {
    // Translation continues with an in-memory cache when browser storage is unavailable.
  }

  const translations = {
    en: {
      'Bättre deals, helt enkelt.': 'Better deals, made simple.',
      'Språk': 'Language',
      'Snabblänkar': 'Quick links',
      'Privat': 'Personal',
      'Företag': 'Business',
      'Varukorg': 'Cart',
      'Mina sidor': 'My pages',
      'bättre deals, helt enkelt.': 'better deals, made simple.',
      'Hemsida': 'Website',
      'Start': 'Home',
      'Tjänster': 'Services',
      'Mobilabonnemang': 'Mobile plans',
      'Familjabonnemang': 'Family plans',
      '5G-Bredband': '5G broadband',
      'Jämför täckning': 'Compare coverage',
      'Om oss': 'About us',
      'Kontakt': 'Contact',
      'Få Personlig rådgivning': 'Get personal advice',
      'Få rätt prisplan': 'Get the right price plan',
      'Få ett presentkort': 'Get a gift card',
      'Tar mindre än 2 minuter, ingen registrering.': 'Takes less than 2 minutes, no registration.',
      'Se om du kan spara': 'See if you can save',
      'Tillbaka': 'Back',
      'Steg': 'Step',
      'Hur många abonnemang': 'How many subscriptions',
      'vill ni ha?': 'do you want?',
      'Vi använder svaren för att hitta rätt abonnemang för er.': 'We use your answers to find the right plan for you.',
      'Visa fler': 'Show more',
      'Dölj': 'Hide',
      'DÃ¶lj': 'Hide',
      'Vilken operatör har ni?': 'Which operator do you have?',
      'Vilken operatör har du?': 'Which operator do you have?',
      'Vilka operatörer har ni?': 'Which operators do you have?',
      'Vi tar med allt i kalkylen': 'We include everything in the calculation',
      'Fortsätt': 'Continue',
      'Person': 'Person',
      'Andra': 'Other',
      'Datum': 'Date',
      'Ingen bindningstid': 'No contract period',
      'Hur används mobilen?': 'How is the mobile used?',
      'Mest wifi & sociala medier': 'Mostly Wi-Fi and social media',
      'Streaming & video': 'Streaming and video',
      'Max surf': 'Maximum data',
      '100 GB – Obegränsad': '100 GB - Unlimited',
      'Pris per abonnemang idag?': 'Price per subscription today?',
      'Under 300 kr': 'Under 300 SEK',
      '300–400 kr': '300-400 SEK',
      '400–500+ kr': '400-500+ SEK',
      'Bindningstid kvar?': 'Contract period remaining?',
      'Nej': 'No',
      'Ja': 'Yes',
      'Vet inte': "I don't know",
      'Vi hittade dina bästa alternativ': 'We found your best options',
      'Baserat på dina svar har vi matchat de abonnemang som passar ditt hushålls behov och budget bäst.': 'Based on your answers, we matched the plans that best fit your household needs and budget.',
      'Abonnemangspaket': 'Subscription packages',
      '4 abonnemang': '4 subscriptions',
      'Obegränsad surf': 'Unlimited data',
      'Obegränsad': 'Unlimited',
      'Samtal & SMS ingår': 'Calls and SMS included',
      '5G & eSIM': '5G and eSIM',
      'presentkort': 'gift card',
      'Presentkort': 'Gift card',
      'Visa paketet': 'View package',
      'Vår smarta guide hjälper dig hitta rätt snabbare': 'Our smart guide helps you find the right plan faster',
      'Rekommenderas': 'Recommended',
      'Vi ger presentkort på varje köp': 'We give a gift card with every purchase',
      'Välj bland populära varumärken och få ett presentkort när du hittar rätt abonnemang via Dealett.': 'Choose from popular brands and receive a gift card when you find the right subscription through Dealett.',
      'Exempel på presentkort': 'Gift card examples',
      'Täckning & nät': 'Coverage and network',
      'Välj operatör och utforska kartan': 'Choose an operator and explore the map',
      'Se täckning, jämför nät och sök direkt på adress eller stad för att få en tydligare bild av läget där du bor.': 'View coverage, compare networks, and search by address or city to get a clearer picture where you live.',
      'Operatörer': 'Operators',
      'Välj operatör': 'Choose operator',
      'Filter': 'Filter',
      'Nät': 'Network',
      'Täckningsinformationen är en uppskattning och inte ett löfte.': 'Coverage information is an estimate, not a promise.',
      'Läs mer →': 'Read more ->',
      'Sök': 'Search',
      'Sök adress eller plats': 'Search address or place',
      'Ingen täckning': 'No coverage',
      'Begränsad': 'Limited',
      'Grundläggande': 'Basic',
      'Bra': 'Good',
      'Utmärkt täckning': 'Excellent coverage',
      'Nuvarande plats': 'Current location',
      'Helskärm': 'Fullscreen',
      'Zooma ut': 'Zoom out',
      'Zooma in': 'Zoom in',
      'Zoomnivå:': 'Zoom level:',
      'Analyserar svar...': 'Analyzing answers...',
      'Inga träffar just nu': 'No matches right now',
      'Testa att gå tillbaka och justera prisnivå eller surfbehov så visar vi fler relevanta alternativ.': 'Try going back and adjusting price level or data needs so we can show more relevant options.',
      'Bäst match': 'Best match',
      'Surf': 'Data',
      'Pris': 'Price',
      'Till varukorg': 'To cart',
      'Fria samtal och sms': 'Free calls and SMS',
      'Dubbel surf i 24 mån': 'Double data for 24 months',
      'Dubbel surf i 24 mÃ¥n': 'Double data for 24 months',
      'Streaming ingår': 'Streaming included',
      'Streaming ingÃ¥r': 'Streaming included',
      '5G och fria samtal': '5G and free calls',
      'Surfpotten ingår': 'Data pool included',
      'Surfpotten ingÃ¥r': 'Data pool included',
      'Netflix, HBO, Disney+ ingår': 'Netflix, HBO, Disney+ included',
      'Netflix, HBO, Disney+ ingÃ¥r': 'Netflix, HBO, Disney+ included',
      '5G upp till 100 Mbit/s': '5G up to 100 Mbit/s',
      'Säkerhetspaket': 'Security package',
      'SÃ¤kerhetspaket': 'Security package',
      '5G upp till 1000 Mbit/s': '5G up to 1000 Mbit/s',
      'EU-roaming': 'EU roaming',
      '5G ingår': '5G included',
      '5G ingÃ¥r': '5G included',
      'Miniabonnemang': 'Mini subscription',
      'För dig som surfar mycket': 'For heavy data users',
      'FÃ¶r dig som surfar mycket': 'For heavy data users',
      'Tel: 08-123 45 67': 'Phone: 08-123 45 67'
    },
    ar: {
      'Bättre deals, helt enkelt.': 'عروض أفضل، ببساطة.',
      'Språk': 'اللغة',
      'Snabblänkar': 'روابط سريعة',
      'Privat': 'أفراد',
      'Företag': 'شركات',
      'Varukorg': 'السلة',
      'Mina sidor': 'صفحتي',
      'bättre deals, helt enkelt.': 'عروض أفضل، ببساطة.',
      'Hemsida': 'الموقع',
      'Start': 'الرئيسية',
      'Tjänster': 'الخدمات',
      'Mobilabonnemang': 'باقات الجوال',
      'Familjabonnemang': 'باقات العائلة',
      '5G-Bredband': 'إنترنت 5G منزلي',
      'Jämför täckning': 'قارن التغطية',
      'Om oss': 'من نحن',
      'Kontakt': 'اتصل بنا',
      'Få Personlig rådgivning': 'احصل على استشارة شخصية',
      'Få rätt prisplan': 'احصل على خطة السعر المناسبة',
      'Få ett presentkort': 'احصل على بطاقة هدية',
      'Tar mindre än 2 minuter, ingen registrering.': 'يستغرق أقل من دقيقتين، بدون تسجيل.',
      'Se om du kan spara': 'اعرف إن كان بإمكانك التوفير',
      'Tillbaka': 'رجوع',
      'Steg': 'الخطوة',
      'Hur många abonnemang': 'كم عدد الاشتراكات',
      'vill ni ha?': 'التي تريدونها؟',
      'Vi använder svaren för att hitta rätt abonnemang för er.': 'نستخدم إجاباتك للعثور على الاشتراك المناسب لك.',
      'Visa fler': 'عرض المزيد',
      'Dölj': 'إخفاء',
      'DÃ¶lj': 'إخفاء',
      'Vilken operatör har ni?': 'ما شركة الاتصالات لديك؟',
      'Vilken operatör har du?': 'ما شركة الاتصالات لديك؟',
      'Vilka operatörer har ni?': 'ما شركات الاتصالات لديكم؟',
      'Vi tar med allt i kalkylen': 'نحسب كل شيء ضمن التقدير',
      'Fortsätt': 'متابعة',
      'Person': 'الشخص',
      'Andra': 'أخرى',
      'Datum': 'التاريخ',
      'Ingen bindningstid': 'بدون مدة التزام',
      'Hur används mobilen?': 'كيف يُستخدم الجوال؟',
      'Mest wifi & sociala medier': 'غالبا واي فاي وتواصل اجتماعي',
      'Streaming & video': 'بث وفيديو',
      'Max surf': 'أقصى بيانات',
      '100 GB – Obegränsad': '100 GB - غير محدود',
      'Pris per abonnemang idag?': 'السعر الحالي لكل اشتراك؟',
      'Under 300 kr': 'أقل من 300 كرونة',
      '300–400 kr': '300-400 كرونة',
      '400–500+ kr': '400-500+ كرونة',
      'Bindningstid kvar?': 'هل توجد مدة التزام متبقية؟',
      'Nej': 'لا',
      'Ja': 'نعم',
      'Vet inte': 'لا أعرف',
      'Vi hittade dina bästa alternativ': 'وجدنا أفضل الخيارات لك',
      'Baserat på dina svar har vi matchat de abonnemang som passar ditt hushålls behov och budget bäst.': 'بناء على إجاباتك، اخترنا الباقات الأنسب لاحتياجات منزلك وميزانيتك.',
      'Abonnemangspaket': 'حزم الاشتراك',
      '4 abonnemang': '4 اشتراكات',
      'Obegränsad surf': 'بيانات غير محدودة',
      'Obegränsad': 'غير محدود',
      'Samtal & SMS ingår': 'المكالمات والرسائل مشمولة',
      '5G & eSIM': '5G و eSIM',
      'presentkort': 'بطاقة هدية',
      'Presentkort': 'بطاقة هدية',
      'Visa paketet': 'عرض الباقة',
      'Vår smarta guide hjälper dig hitta rätt snabbare': 'دليلنا الذكي يساعدك في العثور على الخيار المناسب أسرع',
      'Rekommenderas': 'موصى به',
      'Vi ger presentkort på varje köp': 'نقدم بطاقة هدية مع كل عملية شراء',
      'Välj bland populära varumärken och få ett presentkort när du hittar rätt abonnemang via Dealett.': 'اختر من علامات تجارية مشهورة واحصل على بطاقة هدية عند العثور على الاشتراك المناسب عبر Dealett.',
      'Exempel på presentkort': 'أمثلة على بطاقات الهدايا',
      'Täckning & nät': 'التغطية والشبكة',
      'Välj operatör och utforska kartan': 'اختر شركة اتصالات واستكشف الخريطة',
      'Se täckning, jämför nät och sök direkt på adress eller stad för att få en tydligare bild av läget där du bor.': 'شاهد التغطية، قارن الشبكات، وابحث مباشرة بالعنوان أو المدينة لمعرفة الوضع في مكان سكنك.',
      'Operatörer': 'شركات الاتصالات',
      'Välj operatör': 'اختر شركة اتصالات',
      'Filter': 'تصفية',
      'Nät': 'الشبكة',
      'Täckningsinformationen är en uppskattning och inte ett löfte.': 'معلومات التغطية تقديرية وليست وعدا.',
      'Läs mer →': 'اقرأ المزيد ->',
      'Sök': 'بحث',
      'Sök adress eller plats': 'ابحث عن عنوان أو مكان',
      'Ingen täckning': 'لا توجد تغطية',
      'Begränsad': 'محدودة',
      'Grundläggande': 'أساسية',
      'Bra': 'جيدة',
      'Utmärkt täckning': 'تغطية ممتازة',
      'Nuvarande plats': 'الموقع الحالي',
      'Helskärm': 'ملء الشاشة',
      'Zooma ut': 'تصغير',
      'Zooma in': 'تكبير',
      'Zoomnivå:': 'مستوى التكبير:',
      'Analyserar svar...': 'جار تحليل الإجابات...',
      'Inga träffar just nu': 'لا توجد نتائج حاليا',
      'Testa att gå tillbaka och justera prisnivå eller surfbehov så visar vi fler relevanta alternativ.': 'جرّب الرجوع وتعديل السعر أو حاجة البيانات لنعرض خيارات أكثر ملاءمة.',
      'Bäst match': 'أفضل تطابق',
      'Surf': 'البيانات',
      'Pris': 'السعر',
      'Till varukorg': 'إلى السلة',
      'Fria samtal och sms': 'مكالمات ورسائل مجانية',
      'Dubbel surf i 24 mån': 'ضعف البيانات لمدة 24 شهرا',
      'Dubbel surf i 24 mÃ¥n': 'ضعف البيانات لمدة 24 شهرا',
      'Streaming ingår': 'البث مشمول',
      'Streaming ingÃ¥r': 'البث مشمول',
      '5G och fria samtal': '5G ومكالمات مجانية',
      'Surfpotten ingår': 'رصيد البيانات مشمول',
      'Surfpotten ingÃ¥r': 'رصيد البيانات مشمول',
      'Netflix, HBO, Disney+ ingår': 'Netflix وHBO وDisney+ مشمولة',
      'Netflix, HBO, Disney+ ingÃ¥r': 'Netflix وHBO وDisney+ مشمولة',
      '5G upp till 100 Mbit/s': '5G حتى 100 مbit/s',
      'Säkerhetspaket': 'حزمة أمان',
      'SÃ¤kerhetspaket': 'حزمة أمان',
      '5G upp till 1000 Mbit/s': '5G حتى 1000 مbit/s',
      'EU-roaming': 'تجوال داخل الاتحاد الأوروبي',
      '5G ingår': '5G مشمول',
      '5G ingÃ¥r': '5G مشمول',
      'Miniabonnemang': 'اشتراك صغير',
      'För dig som surfar mycket': 'لمن يستخدم بيانات كثيرة',
      'FÃ¶r dig som surfar mycket': 'لمن يستخدم بيانات كثيرة',
      'Tel: 08-123 45 67': 'الهاتف: 08-123 45 67'
    },
    so: {
      'Bättre deals, helt enkelt.': 'Heshiisyo fiican, si fudud.',
      'Språk': 'Luqad',
      'Snabblänkar': 'Xiriirro degdeg ah',
      'Privat': 'Shakhsi',
      'Företag': 'Ganacsi',
      'Varukorg': 'Gaari',
      'Mina sidor': 'Boggeyga',
      'bättre deals, helt enkelt.': 'heshiisyo fiican, si fudud.',
      'Hemsida': 'Mareeg',
      'Start': 'Bilow',
      'Tjänster': 'Adeegyo',
      'Mobilabonnemang': 'Qorshayaasha mobilka',
      'Familjabonnemang': 'Qorshayaasha qoyska',
      '5G-Bredband': '5G internet guri',
      'Jämför täckning': 'Isbarbar dhig daboolista',
      'Om oss': 'Nagu saabsan',
      'Kontakt': 'Xiriir',
      'Få Personlig rådgivning': 'Hel talo shakhsi ah',
      'Få rätt prisplan': 'Hel qorshaha qiimaha saxda ah',
      'Få ett presentkort': 'Hel kaarka hadiyadda',
      'Tar mindre än 2 minuter, ingen registrering.': 'Waxay qaadaneysaa wax ka yar 2 daqiiqo, diiwaangelin la’aan.',
      'Se om du kan spara': 'Eeg haddii aad kaydin karto',
      'Tillbaka': 'Dib u noqo',
      'Steg': 'Tallaabo',
      'Hur många abonnemang': 'Immisa rukun',
      'vill ni ha?': 'ayaad rabtaan?',
      'Vi använder svaren för att hitta rätt abonnemang för er.': 'Jawaabahaaga ayaan u isticmaalnaa si aan kuugu helno qorshaha kugu habboon.',
      'Visa fler': 'Muuji wax badan',
      'Dölj': 'Qari',
      'DÃ¶lj': 'Qari',
      'Vilken operatör har ni?': 'Shirkaddee ayaad haysataan?',
      'Vilken operatör har du?': 'Shirkaddee ayaad haysataa?',
      'Vilka operatörer har ni?': 'Shirkado kee ayaad haysataan?',
      'Vi tar med allt i kalkylen': 'Wax walba waxaan ku darnaa xisaabta',
      'Fortsätt': 'Sii wad',
      'Person': 'Qof',
      'Andra': 'Kale',
      'Datum': 'Taariikh',
      'Ingen bindningstid': 'Qandaraas la’aan',
      'Hur används mobilen?': 'Sidee mobilka loo isticmaalaa?',
      'Mest wifi & sociala medier': 'Inta badan Wi-Fi iyo baraha bulshada',
      'Streaming & video': 'Daawasho iyo muuqaal',
      'Max surf': 'Xog ugu badan',
      '100 GB – Obegränsad': '100 GB - Aan xadidnayn',
      'Pris per abonnemang idag?': 'Qiimaha rukun kasta maanta?',
      'Under 300 kr': 'Ka yar 300 kr',
      '300–400 kr': '300-400 kr',
      '400–500+ kr': '400-500+ kr',
      'Bindningstid kvar?': 'Qandaraas ma kuu harsan yahay?',
      'Nej': 'Maya',
      'Ja': 'Haa',
      'Vet inte': 'Ma aqaan',
      'Vi hittade dina bästa alternativ': 'Waxaan helnay xulashooyinka kuugu fiican',
      'Baserat på dina svar har vi matchat de abonnemang som passar ditt hushålls behov och budget bäst.': 'Anagoo ku saleyneyna jawaabahaaga, waxaan helnay qorshayaal ku habboon baahida iyo miisaaniyadda qoyskaaga.',
      'Abonnemangspaket': 'Xirmooyinka rukunka',
      '4 abonnemang': '4 rukun',
      'Obegränsad surf': 'Xog aan xadidnayn',
      'Obegränsad': 'Aan xadidnayn',
      'Samtal & SMS ingår': 'Wicitaan iyo SMS way ku jiraan',
      '5G & eSIM': '5G iyo eSIM',
      'presentkort': 'kaarka hadiyadda',
      'Presentkort': 'Kaarka hadiyadda',
      'Visa paketet': 'Eeg xirmada',
      'Vår smarta guide hjälper dig hitta rätt snabbare': 'Hagahayaga caqliga leh wuxuu kaa caawinayaa inaad si dhakhso ah u hesho midka saxda ah',
      'Rekommenderas': 'Lagu taliyay',
      'Vi ger presentkort på varje köp': 'Waxaan bixinaa kaar hadiyad iib kasta',
      'Välj bland populära varumärken och få ett presentkort när du hittar rätt abonnemang via Dealett.': 'Ka dooro sumado caan ah oo hel kaar hadiyad markaad Dealett ka hesho rukunka saxda ah.',
      'Exempel på presentkort': 'Tusaalooyinka kaarka hadiyadda',
      'Täckning & nät': 'Daboolis iyo shabakad',
      'Välj operatör och utforska kartan': 'Dooro shirkad oo sahami khariidadda',
      'Se täckning, jämför nät och sök direkt på adress eller stad för att få en tydligare bild av läget där du bor.': 'Eeg daboolista, isbarbar dhig shabakadaha, kana raadi cinwaan ama magaalo si aad u fahanto xaaladda meesha aad degan tahay.',
      'Operatörer': 'Shirkado',
      'Välj operatör': 'Dooro shirkad',
      'Filter': 'Shaandhee',
      'Nät': 'Shabakad',
      'Täckningsinformationen är en uppskattning och inte ett löfte.': 'Macluumaadka daboolistu waa qiyaas, ma aha ballan.',
      'Läs mer →': 'Akhri wax dheeraad ah ->',
      'Sök': 'Raadi',
      'Sök adress eller plats': 'Raadi cinwaan ama meel',
      'Ingen täckning': 'Daboolis ma jirto',
      'Begränsad': 'Xaddidan',
      'Grundläggande': 'Aasaasi',
      'Bra': 'Fiican',
      'Utmärkt täckning': 'Daboolis aad u fiican',
      'Nuvarande plats': 'Goobta hadda',
      'Helskärm': 'Shaashad buuxda',
      'Zooma ut': 'Ka fogee',
      'Zooma in': 'Soo dhowee',
      'Zoomnivå:': 'Heerka zoom:',
      'Analyserar svar...': 'Jawaabaha waa la falanqeynayaa...',
      'Inga träffar just nu': 'Hadda wax natiijo ah ma jiraan',
      'Testa att gå tillbaka och justera prisnivå eller surfbehov så visar vi fler relevanta alternativ.': 'Isku day inaad dib u noqoto oo hagaajiso qiimaha ama baahida xogta si aan kuu tusno xulashooyin habboon.',
      'Bäst match': 'Isku aadka ugu fiican',
      'Surf': 'Xog',
      'Pris': 'Qiime',
      'Till varukorg': 'Gaari u gudub',
      'Fria samtal och sms': 'Wicitaan iyo SMS bilaash ah',
      'Dubbel surf i 24 mån': 'Xog labanlaab ah 24 bilood',
      'Dubbel surf i 24 mÃ¥n': 'Xog labanlaab ah 24 bilood',
      'Streaming ingår': 'Daawasho way ku jirtaa',
      'Streaming ingÃ¥r': 'Daawasho way ku jirtaa',
      '5G och fria samtal': '5G iyo wicitaan bilaash ah',
      'Surfpotten ingår': 'Kaydka xogta wuu ku jiraa',
      'Surfpotten ingÃ¥r': 'Kaydka xogta wuu ku jiraa',
      'Netflix, HBO, Disney+ ingår': 'Netflix, HBO, Disney+ way ku jiraan',
      'Netflix, HBO, Disney+ ingÃ¥r': 'Netflix, HBO, Disney+ way ku jiraan',
      '5G upp till 100 Mbit/s': '5G ilaa 100 Mbit/s',
      'Säkerhetspaket': 'Xirmo amni',
      'SÃ¤kerhetspaket': 'Xirmo amni',
      '5G upp till 1000 Mbit/s': '5G ilaa 1000 Mbit/s',
      'EU-roaming': 'Roaming EU',
      '5G ingår': '5G wuu ku jiraa',
      '5G ingÃ¥r': '5G wuu ku jiraa',
      'Miniabonnemang': 'Rukun yar',
      'För dig som surfar mycket': 'Adiga isticmaal xog badan',
      'FÃ¶r dig som surfar mycket': 'Adiga isticmaal xog badan',
      'Tel: 08-123 45 67': 'Tel: 08-123 45 67'
    },
    fa: {
      'Bättre deals, helt enkelt.': 'پیشنهادهای بهتر، به سادگی.',
      'Språk': 'زبان',
      'Snabblänkar': 'پیوندهای سریع',
      'Privat': 'شخصی',
      'Företag': 'کسب‌وکار',
      'Varukorg': 'سبد خرید',
      'Mina sidor': 'صفحه من',
      'bättre deals, helt enkelt.': 'پیشنهادهای بهتر، به سادگی.',
      'Hemsida': 'وب‌سایت',
      'Start': 'خانه',
      'Tjänster': 'خدمات',
      'Mobilabonnemang': 'اشتراک موبایل',
      'Familjabonnemang': 'اشتراک خانوادگی',
      '5G-Bredband': 'اینترنت خانگی 5G',
      'Jämför täckning': 'مقایسه پوشش',
      'Om oss': 'درباره ما',
      'Kontakt': 'تماس',
      'Få Personlig rådgivning': 'مشاوره شخصی بگیرید',
      'Få rätt prisplan': 'طرح قیمتی مناسب بگیرید',
      'Få ett presentkort': 'کارت هدیه بگیرید',
      'Tar mindre än 2 minuter, ingen registrering.': 'کمتر از ۲ دقیقه زمان می‌برد، بدون ثبت‌نام.',
      'Se om du kan spara': 'ببینید می‌توانید صرفه‌جویی کنید',
      'Tillbaka': 'بازگشت',
      'Steg': 'مرحله',
      'Hur många abonnemang': 'چند اشتراک',
      'vill ni ha?': 'می‌خواهید؟',
      'Vi använder svaren för att hitta rätt abonnemang för er.': 'از پاسخ‌های شما برای پیدا کردن اشتراک مناسب استفاده می‌کنیم.',
      'Visa fler': 'نمایش بیشتر',
      'Dölj': 'پنهان کردن',
      'DÃ¶lj': 'پنهان کردن',
      'Vilken operatör har ni?': 'کدام اپراتور را دارید؟',
      'Vilken operatör har du?': 'کدام اپراتور را دارید؟',
      'Vilka operatörer har ni?': 'کدام اپراتورها را دارید؟',
      'Vi tar med allt i kalkylen': 'همه چیز را در محاسبه لحاظ می‌کنیم',
      'Fortsätt': 'ادامه',
      'Person': 'نفر',
      'Andra': 'سایر',
      'Datum': 'تاریخ',
      'Ingen bindningstid': 'بدون مدت تعهد',
      'Hur används mobilen?': 'موبایل چگونه استفاده می‌شود؟',
      'Mest wifi & sociala medier': 'بیشتر وای‌فای و شبکه‌های اجتماعی',
      'Streaming & video': 'استریم و ویدیو',
      'Max surf': 'بیشترین دیتا',
      '100 GB – Obegränsad': '100 GB - نامحدود',
      'Pris per abonnemang idag?': 'قیمت هر اشتراک امروز؟',
      'Under 300 kr': 'کمتر از 300 کرون',
      '300–400 kr': '300-400 کرون',
      '400–500+ kr': '400-500+ کرون',
      'Bindningstid kvar?': 'مدت تعهد باقی مانده؟',
      'Nej': 'خیر',
      'Ja': 'بله',
      'Vet inte': 'نمی‌دانم',
      'Vi hittade dina bästa alternativ': 'بهترین گزینه‌های شما را پیدا کردیم',
      'Baserat på dina svar har vi matchat de abonnemang som passar ditt hushålls behov och budget bäst.': 'بر اساس پاسخ‌های شما، اشتراک‌هایی را انتخاب کردیم که با نیاز و بودجه خانه شما بهتر هماهنگ هستند.',
      'Abonnemangspaket': 'بسته‌های اشتراک',
      '4 abonnemang': '۴ اشتراک',
      'Obegränsad surf': 'دیتای نامحدود',
      'Obegränsad': 'نامحدود',
      'Samtal & SMS ingår': 'تماس و پیامک شامل است',
      '5G & eSIM': '5G و eSIM',
      'presentkort': 'کارت هدیه',
      'Presentkort': 'کارت هدیه',
      'Visa paketet': 'مشاهده بسته',
      'Vår smarta guide hjälper dig hitta rätt snabbare': 'راهنمای هوشمند ما کمک می‌کند سریع‌تر گزینه مناسب را پیدا کنید',
      'Rekommenderas': 'پیشنهاد شده',
      'Vi ger presentkort på varje köp': 'با هر خرید کارت هدیه می‌دهیم',
      'Välj bland populära varumärken och få ett presentkort när du hittar rätt abonnemang via Dealett.': 'از میان برندهای محبوب انتخاب کنید و وقتی از طریق Dealett اشتراک مناسب را پیدا کردید، کارت هدیه بگیرید.',
      'Exempel på presentkort': 'نمونه کارت هدیه',
      'Täckning & nät': 'پوشش و شبکه',
      'Välj operatör och utforska kartan': 'اپراتور را انتخاب کنید و نقشه را بررسی کنید',
      'Se täckning, jämför nät och sök direkt på adress eller stad för att få en tydligare bild av läget där du bor.': 'پوشش را ببینید، شبکه‌ها را مقایسه کنید و با آدرس یا شهر جستجو کنید تا وضعیت محل زندگی خود را بهتر ببینید.',
      'Operatörer': 'اپراتورها',
      'Välj operatör': 'انتخاب اپراتور',
      'Filter': 'فیلتر',
      'Nät': 'شبکه',
      'Täckningsinformationen är en uppskattning och inte ett löfte.': 'اطلاعات پوشش تخمینی است و وعده قطعی نیست.',
      'Läs mer →': 'بیشتر بخوانید ->',
      'Sök': 'جستجو',
      'Sök adress eller plats': 'جستجوی آدرس یا مکان',
      'Ingen täckning': 'بدون پوشش',
      'Begränsad': 'محدود',
      'Grundläggande': 'پایه',
      'Bra': 'خوب',
      'Utmärkt täckning': 'پوشش عالی',
      'Nuvarande plats': 'مکان فعلی',
      'Helskärm': 'تمام‌صفحه',
      'Zooma ut': 'کوچک‌نمایی',
      'Zooma in': 'بزرگ‌نمایی',
      'Zoomnivå:': 'سطح زوم:',
      'Analyserar svar...': 'در حال تحلیل پاسخ‌ها...',
      'Inga träffar just nu': 'در حال حاضر نتیجه‌ای نیست',
      'Testa att gå tillbaka och justera prisnivå eller surfbehov så visar vi fler relevanta alternativ.': 'برگردید و سطح قیمت یا نیاز دیتا را تغییر دهید تا گزینه‌های مرتبط‌تری نمایش دهیم.',
      'Bäst match': 'بهترین تطابق',
      'Surf': 'دیتا',
      'Pris': 'قیمت',
      'Till varukorg': 'رفتن به سبد خرید',
      'Fria samtal och sms': 'تماس و پیامک رایگان',
      'Dubbel surf i 24 mån': 'دیتای دوبرابر برای ۲۴ ماه',
      'Dubbel surf i 24 mÃ¥n': 'دیتای دوبرابر برای ۲۴ ماه',
      'Streaming ingår': 'استریم شامل است',
      'Streaming ingÃ¥r': 'استریم شامل است',
      '5G och fria samtal': '5G و تماس رایگان',
      'Surfpotten ingår': 'بسته دیتا شامل است',
      'Surfpotten ingÃ¥r': 'بسته دیتا شامل است',
      'Netflix, HBO, Disney+ ingår': 'Netflix، HBO و Disney+ شامل است',
      'Netflix, HBO, Disney+ ingÃ¥r': 'Netflix، HBO و Disney+ شامل است',
      '5G upp till 100 Mbit/s': '5G تا 100 Mbit/s',
      'Säkerhetspaket': 'بسته امنیتی',
      'SÃ¤kerhetspaket': 'بسته امنیتی',
      '5G upp till 1000 Mbit/s': '5G تا 1000 Mbit/s',
      'EU-roaming': 'رومینگ اتحادیه اروپا',
      '5G ingår': '5G شامل است',
      '5G ingÃ¥r': '5G شامل است',
      'Miniabonnemang': 'اشتراک کوچک',
      'För dig som surfar mycket': 'برای مصرف دیتای زیاد',
      'FÃ¶r dig som surfar mycket': 'برای مصرف دیتای زیاد',
      'Tel: 08-123 45 67': 'تلفن: 08-123 45 67'
    }
  };

  const normalizeTranslationKey = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const persistRemoteTranslations = () => {
    try {
      localStorage.setItem(
        translationCacheStorageKey,
        JSON.stringify([...remoteTranslationCache.entries()].slice(-maxStoredTranslations))
      );
    } catch {
      // Translation still works for the current page if browser storage is unavailable.
    }
  };

  const setTranslationState = (state) => {
    document.documentElement.dataset.translationState = state;
    if (state === 'ready' || state === 'error') {
      document.documentElement.removeAttribute('data-translation-boot');
    }
  };

  const isPreservedTranslationText = (text) => {
    const normalized = normalizeTranslationKey(text);
    if (preservedExactTexts.has(normalized)) return true;
    if (/^(?:[A-ZÅÄÖ0-9]{1,6}|[235]G|eSIM|GB|Mbit\/s|N)$/.test(normalized)) return true;
    return false;
  };

  const getSavedLanguage = () => {
    const saved = localStorage.getItem('dealettLanguage');
    return supportedLanguages.includes(saved) ? saved : 'sv';
  };

  const applyPatternTranslation = (text, language) => {
    const replacements = {
      en: [
        [/^(\d+) var(?:a|or) i varukorgen$/, '$1 item(s) in the cart'],
        [/^Alternativ (\d+)$/, 'Option $1'],
        [/^(\d+) abonnemang$/, '$1 subscriptions'],
        [/^(\d[\d\s]*) kr\/p$/, '$1 SEK/person'],
        [/^(\d[\d\s]*) kr\/mån$/, '$1 SEK/month'],
        [/^(\d[\d\s]*) kr\/mÃ¥n$/, '$1 SEK/month'],
        [/^(\d[\d\s]*) kr totalt$/, '$1 SEK total'],
        [/^Presentkort ([\d\s]+) kr$/, 'Gift card $1 SEK']
      ],
      ar: [
        [/^(\d+) var(?:a|or) i varukorgen$/, '$1 عنصر في السلة'],
        [/^Alternativ (\d+)$/, 'الخيار $1'],
        [/^(\d+) abonnemang$/, '$1 اشتراكات'],
        [/^(\d[\d\s]*) kr\/p$/, '$1 كرونة/شخص'],
        [/^(\d[\d\s]*) kr\/mån$/, '$1 كرونة/شهر'],
        [/^(\d[\d\s]*) kr\/mÃ¥n$/, '$1 كرونة/شهر'],
        [/^(\d[\d\s]*) kr totalt$/, '$1 كرونة إجمالا'],
        [/^Presentkort ([\d\s]+) kr$/, 'بطاقة هدية $1 كرونة']
      ],
      so: [
        [/^(\d+) var(?:a|or) i varukorgen$/, '$1 shay gaadhiga ku jira'],
        [/^Alternativ (\d+)$/, 'Xulasho $1'],
        [/^(\d+) abonnemang$/, '$1 rukun'],
        [/^(\d[\d\s]*) kr\/p$/, '$1 kr/qof'],
        [/^(\d[\d\s]*) kr\/mån$/, '$1 kr/bil'],
        [/^(\d[\d\s]*) kr\/mÃ¥n$/, '$1 kr/bil'],
        [/^(\d[\d\s]*) kr totalt$/, '$1 kr wadar'],
        [/^Presentkort ([\d\s]+) kr$/, 'Kaar hadiyad $1 kr']
      ],
      fa: [
        [/^(\d+) var(?:a|or) i varukorgen$/, '$1 مورد در سبد خرید'],
        [/^Alternativ (\d+)$/, 'گزینه $1'],
        [/^(\d+) abonnemang$/, '$1 اشتراک'],
        [/^(\d[\d\s]*) kr\/p$/, '$1 کرون/نفر'],
        [/^(\d[\d\s]*) kr\/mån$/, '$1 کرون/ماه'],
        [/^(\d[\d\s]*) kr\/mÃ¥n$/, '$1 کرون/ماه'],
        [/^(\d[\d\s]*) kr totalt$/, '$1 کرون مجموع'],
        [/^Presentkort ([\d\s]+) kr$/, 'کارت هدیه $1 کرون']
      ]
    };

    for (const [pattern, replacement] of replacements[language] || []) {
      if (pattern.test(text)) {
        return text.replace(pattern, replacement);
      }
    }

    return null;
  };

  const translateKey = (key, language = activeLanguage) => {
    if (!key) return key;
    const cached = remoteTranslationCache.get(`${language}\u0000${key}`);
    return translations[language]?.[key] || applyPatternTranslation(key, language) || cached || key;
  };

  const isRemoteTranslatable = (text) => {
    if (!text || text.length > 1200) return false;
    if (!/[\p{L}]/u.test(text)) return false;
    if (/^(?:https?:\/\/|mailto:|tel:)/i.test(text)) return false;
    if (isPreservedTranslationText(text)) return false;
    return true;
  };

  const requestTranslationBatch = async (language, texts) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(translationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, texts }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.translations)) {
        throw new Error(payload.error || 'Translation request failed');
      }

      payload.translations.forEach(({ source, translated }) => {
        if (source && translated) {
          remoteTranslationCache.set(`${language}\u0000${source}`, translated);
          attemptedRemoteTranslations.delete(`${language}\u0000${source}`);
          remoteTranslationFailures.delete(`${language}\u0000${source}`);
        }
      });
      persistRemoteTranslations();
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const flushRemoteTranslations = async () => {
    translationRequestTimer = 0;
    const language = queuedTranslationLanguage;
    const texts = [...queuedRemoteTranslations].filter((text) => {
      const key = `${language}\u0000${text}`;
      return !remoteTranslationCache.has(key) && !attemptedRemoteTranslations.has(key);
    });
    queuedRemoteTranslations.clear();

    if (language === 'sv' || !texts.length) return;

    texts.forEach((text) => attemptedRemoteTranslations.add(`${language}\u0000${text}`));
    setTranslationState('loading');

    try {
      const batches = [];
      let batch = [];
      let batchCharacters = 0;

      texts.forEach((text) => {
        if (batch.length >= 35 || (batch.length && batchCharacters + text.length > 12_000)) {
          batches.push(batch);
          batch = [];
          batchCharacters = 0;
        }
        batch.push(text);
        batchCharacters += text.length;
      });
      if (batch.length) batches.push(batch);

      for (const translationBatch of batches) {
        await requestTranslationBatch(language, translationBatch);
      }
      setTranslationState('ready');
      if (activeLanguage === language) applyTranslations();
    } catch {
      const retryTexts = new Set();
      texts.forEach((text) => {
        const key = `${language}\u0000${text}`;
        attemptedRemoteTranslations.delete(key);
        const failures = (remoteTranslationFailures.get(key) || 0) + 1;
        remoteTranslationFailures.set(key, failures);
        if (failures < 3) retryTexts.add(text);
      });

      if (activeLanguage === language && retryTexts.size) {
        setTranslationState('loading');
        window.setTimeout(() => queueRemoteTranslation(retryTexts, language), 500);
      } else {
        setTranslationState('error');
      }
    }
  };

  const queueRemoteTranslation = (texts, language = activeLanguage) => {
    if (language === 'sv' || !texts?.size) return;

    if (queuedTranslationLanguage !== language) {
      queuedRemoteTranslations.clear();
      queuedTranslationLanguage = language;
    }

    texts.forEach((text) => {
      const key = `${language}\u0000${text}`;
      if (
        isRemoteTranslatable(text) &&
        !remoteTranslationCache.has(key) &&
        !attemptedRemoteTranslations.has(key)
      ) {
        queuedRemoteTranslations.add(text);
      }
    });

    if (!queuedRemoteTranslations.size) return;
    window.clearTimeout(translationRequestTimer);
    translationRequestTimer = window.setTimeout(flushRemoteTranslations, 60);
  };

  const withOriginalWhitespace = (source, translated) => {
    const leading = source.match(/^\s*/)?.[0] || '';
    const trailing = source.match(/\s*$/)?.[0] || '';
    return `${leading}${translated}${trailing}`;
  };

  const translateTextNode = (node, missingTranslations) => {
    const rawValue = node.nodeValue || '';
    const key = normalizeTranslationKey(rawValue);

    if (!key) {
      return;
    }

    const existing = textNodeMemory.get(node);
    const original = existing && key === existing.lastKey ? existing.original : key;
    const translated = translateKey(original);
    const remoteKey = `${activeLanguage}\u0000${original}`;

    if (
      activeLanguage !== 'sv' &&
      translated === original &&
      !remoteTranslationCache.has(remoteKey) &&
      isRemoteTranslatable(original)
    ) {
      missingTranslations.add(original);
    }

    if (translated !== key) {
      const nextValue = withOriginalWhitespace(rawValue, translated);
      node.nodeValue = nextValue;
      textNodeMemory.set(node, {
        original,
        lastKey: normalizeTranslationKey(nextValue)
      });
    } else if (!existing) {
      textNodeMemory.set(node, { original, lastKey: key });
    }
  };

  const shouldSkipNode = (node) => {
    const parent = node.parentElement;
    return !parent ||
      ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName) ||
      Boolean(parent.closest('[data-no-translate], [data-translation-complete], [data-translation-preserve], [translate="no"]')) ||
      Boolean(parent.tagName === 'OPTION' && parent.closest('[data-language-switcher]'));
  };

  const getTranslatableAttributeNames = (element) => {
    const names = [...translatableAttributeNames];
    if (
      element.tagName === 'INPUT' &&
      ['button', 'reset', 'submit'].includes(String(element.type || '').toLowerCase())
    ) {
      names.push('value');
    }
    return names;
  };

  const shouldSkipAttribute = (element, attributeName) => {
    if (
      element.closest('[data-translation-complete], [data-translation-preserve], [translate="no"]') ||
      (element.closest('[data-no-translate]') && attributeName !== 'aria-label')
    ) return true;
    return false;
  };

  const translateAttributes = (root, missingTranslations) => {
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [];

    elements.forEach((element) => {
      getTranslatableAttributeNames(element).forEach((attributeName) => {
        if (!element.hasAttribute(attributeName)) return;
        if (shouldSkipAttribute(element, attributeName)) return;

        const current = element.getAttribute(attributeName);
        const key = normalizeTranslationKey(current);
        if (!key) return;

        const storedForElement = attrMemory.get(element) || {};
        const stored = storedForElement[attributeName];
        const original = stored && key === stored.lastKey ? stored.original : key;
        const translated = translateKey(original);
        const remoteKey = `${activeLanguage}\u0000${original}`;

        if (
          activeLanguage !== 'sv' &&
          translated === original &&
          !remoteTranslationCache.has(remoteKey) &&
          isRemoteTranslatable(original)
        ) {
          missingTranslations.add(original);
        }

        if (translated !== key) {
          element.setAttribute(attributeName, translated);
          storedForElement[attributeName] = {
            original,
            lastKey: normalizeTranslationKey(translated)
          };
          attrMemory.set(element, storedForElement);
        }
      });
    });
  };

  const applyTranslations = (root = document.body) => {
    if (!root) return;

    isApplyingTranslations = true;
    const missingTranslations = new Set();
    document.documentElement.lang = activeLanguage;
    document.documentElement.dir = rtlLanguages.has(activeLanguage) ? 'rtl' : 'ltr';

    if (document.title) {
      originalDocumentTitle ||= normalizeTranslationKey(document.title);
      const translatedTitle = translateKey(originalDocumentTitle);
      document.title = translatedTitle;
      if (
        activeLanguage !== 'sv' &&
        translatedTitle === originalDocumentTitle &&
        !remoteTranslationCache.has(`${activeLanguage}\u0000${originalDocumentTitle}`) &&
        isRemoteTranslatable(originalDocumentTitle)
      ) {
        missingTranslations.add(originalDocumentTitle);
      }
    }

    translateAttributes(root, missingTranslations);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });

    let node = walker.nextNode();
    while (node) {
      translateTextNode(node, missingTranslations);
      node = walker.nextNode();
    }

    isApplyingTranslations = false;
    if (activeLanguage === 'sv' || !missingTranslations.size) {
      setTranslationState('ready');
    }
    queueRemoteTranslation(missingTranslations);
  };

  const auditTranslationCoverage = (root = document.body) => {
    if (!root || activeLanguage === 'sv') return [];

    const issues = [];
    const inspect = ({ kind, source, current, element, attribute = null }) => {
      const normalizedSource = normalizeTranslationKey(source);
      if (!isRemoteTranslatable(normalizedSource)) return;

      const expected = normalizeTranslationKey(translateKey(normalizedSource));
      if (normalizeTranslationKey(current) === expected && expected !== normalizedSource) return;
      if (
        expected === normalizedSource &&
        remoteTranslationCache.has(`${activeLanguage}\u0000${normalizedSource}`)
      ) return;

      issues.push({
        kind,
        source: normalizedSource,
        current: normalizeTranslationKey(current),
        attribute,
        element: element?.tagName?.toLowerCase() || 'document',
      });
    };

    if (originalDocumentTitle) {
      inspect({
        kind: 'document-title',
        source: originalDocumentTitle,
        current: document.title,
      });
    }

    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [];
    elements.forEach((element) => {
      getTranslatableAttributeNames(element).forEach((attributeName) => {
        if (!element.hasAttribute(attributeName) || shouldSkipAttribute(element, attributeName)) return;
        const current = element.getAttribute(attributeName);
        const stored = attrMemory.get(element)?.[attributeName];
        inspect({
          kind: 'attribute',
          source: stored?.original || current,
          current,
          element,
          attribute: attributeName,
        });
      });
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let node = walker.nextNode();
    while (node) {
      const current = node.nodeValue || '';
      inspect({
        kind: 'text',
        source: textNodeMemory.get(node)?.original || current,
        current,
        element: node.parentElement,
      });
      node = walker.nextNode();
    }

    return issues;
  };

  const scheduleTranslation = () => {
    if (isApplyingTranslations || translationFrame) return;

    translationFrame = window.requestAnimationFrame(() => {
      translationFrame = 0;
      applyTranslations();
    });
  };

  const populateLanguageSwitcher = (select) => {
    const groups = [
      {
        label: 'Huvudspråk',
        languages: languageCatalog.filter(([code]) => primaryLanguages.has(code)),
      },
      {
        label: 'Fler språk',
        languages: languageCatalog.filter(([code]) => !primaryLanguages.has(code)),
      },
    ];
    const options = document.createDocumentFragment();
    groups.forEach(({ label, languages }) => {
      const group = document.createElement('optgroup');
      group.label = label;
      languages.forEach(([code, name]) => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = `${code.toUpperCase()} - ${name}`;
        group.append(option);
      });
      options.append(group);
    });
    select.replaceChildren(options);
  };

  const setLanguage = (language) => {
    activeLanguage = supportedLanguages.includes(language) ? language : 'sv';
    try {
      localStorage.setItem('dealettLanguage', activeLanguage);
    } catch {
      // Keep the language active for this page if browser storage is unavailable.
    }
    attemptedRemoteTranslations.forEach((key) => {
      if (key.startsWith(`${activeLanguage}\u0000`)) attemptedRemoteTranslations.delete(key);
    });
    document.querySelectorAll('[data-language-switcher]').forEach((select) => {
      select.value = activeLanguage;
    });
    setTranslationState(activeLanguage === 'sv' ? 'ready' : 'loading');
    applyTranslations();
    document.dispatchEvent(new CustomEvent('dealett:language-changed', {
      detail: { language: activeLanguage },
    }));
  };

  const reloadWithLanguage = (language) => {
    const nextLanguage = supportedLanguages.includes(language) ? language : 'sv';
    if (nextLanguage === activeLanguage) return;

    try {
      localStorage.setItem('dealettLanguage', nextLanguage);
    } catch {
      setLanguage(nextLanguage);
      return;
    }

    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = rtlLanguages.has(nextLanguage) ? 'rtl' : 'ltr';
    document.documentElement.dataset.translationBoot = 'pending';
    window.location.reload();
  };

  const initTranslations = () => {
    activeLanguage = getSavedLanguage();

    document.querySelectorAll('[data-language-switcher]').forEach((select) => {
      populateLanguageSwitcher(select);
      select.value = activeLanguage;
      select.addEventListener('change', () => reloadWithLanguage(select.value));
    });

    applyTranslations();

    translationObserver?.disconnect();
    translationObserver = new MutationObserver((mutations) => {
      if (isApplyingTranslations) return;

      if (mutations.some((mutation) => (
        mutation.type === 'childList' ||
        mutation.type === 'characterData' ||
        mutation.type === 'attributes'
      ))) {
        scheduleTranslation();
      }
    });

    translationObserver.observe(document.body, {
      attributeFilter: [...translatableAttributeNames, 'value'],
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true
    });
  };

  window.DEALETT_I18N = {
    audit: auditTranslationCoverage,
    setLanguage,
    translate: translateKey,
    getLanguage: () => activeLanguage,
    getSupportedLanguages: () => languageCatalog.map(([code, name]) => ({ code, name })),
  };

  const readCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('dealettCart') || '[]');
      return Array.isArray(cart) ? cart.length : 0;
    } catch {
      return 0;
    }
  };

  const updateCartCount = () => {
    const count = readCartCount();

    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
      badge.textContent = String(count);
      badge.classList.toggle('is-hidden', count <= 0);
      badge.setAttribute('aria-label', `${count} ${count === 1 ? 'vara' : 'varor'} i varukorgen`);
    });
  };

  window.DEALETT_updateCartCount = updateCartCount;

  const includePartials = async () => {
    const includeTargets = [...document.querySelectorAll('[data-include]')];

    await Promise.all(includeTargets.map(async (target) => {
      const includeName = target.dataset.include;
      const partialPath = partials[includeName];

      if (!partialPath) {
        return;
      }

      try {
        const template = document.createElement('template');
        const html = window.DealettNetwork?.fetchText
          ? await window.DealettNetwork.fetchText(partialPath, {
            label: `Partial ${includeName}`,
          })
          : await fetch(partialPath).then((response) => {
            if (!response.ok) throw new Error(`Partial ${includeName} could not be loaded`);
            return response.text();
          });
        template.innerHTML = html.trim();
        target.replaceWith(template.content.cloneNode(true));
      } catch {
        target.hidden = true;
      }
    }));
  };

  const setHeaderActiveState = () => {
    document.querySelectorAll('.nav-item--active').forEach((item) => {
      item.classList.remove('nav-item--active');
    });

    document.querySelectorAll('.nav-menu a[href]').forEach((link) => {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');

      const targetPage = link.getAttribute('href').split('#')[0].split('/').pop() || 'index.html';

      if (targetPage === currentPage) {
        link.classList.add('is-active');
        link.setAttribute('aria-current', 'page');

        const parentDropdown = link.closest('.nav-item--dropdown');
        const parentItem = parentDropdown || link.closest('.nav-item');

        parentItem?.classList.add('nav-item--active');
      }
    });

    document.querySelectorAll('.header-topbar-link').forEach((link) => {
      const targetPage = link.getAttribute('href').split('#')[0].split('/').pop() || 'index.html';
      const isMainArea = currentPage !== 'foretag.html';
      const isActive = targetPage === currentPage || (targetPage === 'index.html' && isMainArea);

      link.classList.toggle('is-active', isActive);
    });
  };

  const initDropdowns = () => {
    const dropdowns = document.querySelectorAll('.nav-item--dropdown');
    const header = document.querySelector('.site-header');
    const navToggle = document.querySelector('.mobile-nav-toggle');
    const navMenu = document.querySelector('#site-nav-menu');

    const closeMobileNav = () => {
      header?.classList.remove('mobile-nav-open');
      navToggle?.setAttribute('aria-expanded', 'false');
      navToggle?.setAttribute('aria-label', '\u00d6ppna meny');
    };

    navToggle?.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = header?.classList.toggle('mobile-nav-open');
      navToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
      navToggle.setAttribute('aria-label', isOpen ? 'St\u00e4ng meny' : '\u00d6ppna meny');
    });

    navMenu?.addEventListener('click', (event) => {
      const target = event.target.closest('a');

      if (target) {
        closeMobileNav();
      }
    });

    dropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector('.nav-dropdown-toggle');

      if (!toggle) {
        return;
      }

      toggle.addEventListener('click', () => {
        dropdowns.forEach((item) => {
          if (item !== dropdown) {
            item.classList.remove('open');
          }
        });

        dropdown.classList.toggle('open');
      });
    });

    document.addEventListener('click', (event) => {
      if (header?.classList.contains('mobile-nav-open') && !header.contains(event.target)) {
        closeMobileNav();
      }

      dropdowns.forEach((dropdown) => {
        if (!dropdown.contains(event.target)) {
          dropdown.classList.remove('open');
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        dropdowns.forEach((dropdown) => dropdown.classList.remove('open'));
        closeMobileNav();
      }
    });
  };

  const initHeaderMotion = () => {
    const header = document.querySelector('.site-header');
    const hero = document.querySelector('.hero');

    if (!header && !hero) {
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    const updateOnScroll = () => {
      const nextScrollY = window.scrollY;

      if (header) {
        if (nextScrollY <= 0 || nextScrollY < lastScrollY) {
          header.classList.remove('is-hidden');
        } else if (nextScrollY > lastScrollY && nextScrollY > 80) {
          header.classList.add('is-hidden');
        }
      }

      if (hero) {
        const heroHeight = hero.offsetHeight || 1;
        const progress = Math.min(Math.max(nextScrollY / heroHeight, 0), 1);
        const maxShift = window.matchMedia('(max-width: 680px)').matches ? 32 : 90;
        const shift = Math.round(progress * -maxShift);

        hero.style.setProperty('--hero-shift', `${shift}px`);
      }

      lastScrollY = Math.max(nextScrollY, 0);
      ticking = false;
    };

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          window.requestAnimationFrame(updateOnScroll);
          ticking = true;
        }
      },
      { passive: true }
    );

    updateOnScroll();
  };

  const initCoveragePreview = () => {
    const coverageApp = document.querySelector('#coverageApp');
    const hasDedicatedCoverageController = document.body.classList.contains('jamfor-page');
    const hasRealCoverageMap = coverageApp?.dataset.coverageMap === 'real';

    if (!coverageApp || hasDedicatedCoverageController || hasRealCoverageMap) {
      return;
    }

    coverageApp.querySelectorAll('.operator-card').forEach((operatorButton) => {
      operatorButton.addEventListener('click', () => {
        coverageApp.querySelectorAll('.operator-card').forEach((button) => {
          button.classList.remove('is-active');
        });

        operatorButton.classList.add('is-active');
      });
    });

    coverageApp.querySelectorAll('.coverage-filter').forEach((filterButton) => {
      filterButton.addEventListener('click', () => {
        filterButton.classList.toggle('is-active');
      });
    });

    const zoomLabel = coverageApp.querySelector('#visibleZoomLabel');
    let mapZoom = zoomLabel ? Number(zoomLabel.textContent) || 5 : 5;

    const setMapZoom = (nextZoom) => {
      mapZoom = Math.min(Math.max(nextZoom, 1), 12);

      if (zoomLabel) {
        zoomLabel.textContent = mapZoom;
      }
    };

    coverageApp.querySelectorAll('#zoomInBtn, #zoomInBtn2').forEach((button) => {
      button.addEventListener('click', () => setMapZoom(mapZoom + 1));
    });

    coverageApp.querySelectorAll('#zoomOutBtn, #zoomOutBtn2').forEach((button) => {
      button.addEventListener('click', () => setMapZoom(mapZoom - 1));
    });

    const mapSearchInput = coverageApp.querySelector('#mapSearchInput');
    const mapSearchButton = coverageApp.querySelector('#mapSearchBtn');

    if (mapSearchButton && mapSearchInput) {
      mapSearchButton.addEventListener('click', () => {
        mapSearchInput.focus();
      });
    }

    const mapCard = coverageApp.querySelector('.coverage-map-card');
    const fullscreenButton = coverageApp.querySelector('#fullscreenMapBtn');

    if (mapCard && fullscreenButton) {
      fullscreenButton.addEventListener('click', () => {
        mapCard.classList.toggle('is-fullscreen');
      });
    }
  };

  const initDealettChat = () => {
    if (document.querySelector('#dealettChat')) return;

    const copy = {
      sv: {
        open: 'Öppna Dealett assistant',
        close: 'Stäng chatten',
        title: 'Dealett assistant',
        status: 'AI-rådgivare',
        placeholder: 'Fråga AI om vad som helst...',
        send: 'Skicka',
        typing: 'Dealett assistant skriver...',
        error: 'Jag kunde inte svara just nu. Kontrollera att AI-tjänsten är konfigurerad och försök igen.',
        feedbackQuestion: 'Var svaret hjälpsamt?',
        feedbackYes: 'Ja',
        feedbackNo: 'Nej',
        feedbackWhy: 'Vill du berätta varför?',
        feedbackSend: 'Skicka feedback',
        feedbackSkip: 'Hoppa över',
        feedbackThanks: 'Tack för feedbacken.',
      },
      en: {
        open: 'Open Dealett assistant',
        close: 'Close chat',
        title: 'Dealett assistant',
        status: 'AI advisor',
        placeholder: 'Ask AI anything...',
        send: 'Send',
        typing: 'Dealett assistant is typing...',
        error: 'I could not answer right now. Check that the AI service is configured and try again.',
        feedbackQuestion: 'Was this helpful?',
        feedbackYes: 'Yes',
        feedbackNo: 'No',
        feedbackWhy: 'Want to tell us why?',
        feedbackSend: 'Send feedback',
        feedbackSkip: 'Skip',
        feedbackThanks: 'Thanks for the feedback.',
      },
    };

    const getChatLanguage = () => window.DEALETT_I18N?.getLanguage?.() || 'sv';
    let chatLanguage = getChatLanguage();
    let text = copy[chatLanguage] || copy.sv;
    const messages = [];
    const qualificationKey = 'dealettChatQualification';
    const offerCalculationKey = 'dealettChatOfferCalculation';
    const chatSessionKey = 'dealettChatSessionId';
    let isSending = false;
    let lastAssistantResponse = null;
    let offerClickedInSession = false;
    let hasUserStartedChat = false;
    let activeQuizContext = null;

    const root = document.createElement('section');
    root.id = 'dealettChat';
    root.className = 'dealett-chat';
    root.innerHTML = [
      `<button class="dealett-chat-toggle" type="button" aria-label="${text.open}" aria-expanded="false">`,
      '  <i class="fa-solid fa-message" aria-hidden="true"></i>',
      '</button>',
      '<div class="dealett-chat-panel" role="dialog" aria-modal="false" aria-labelledby="dealettChatTitle" hidden>',
      '  <header class="dealett-chat-header">',
      '    <div>',
      `      <strong id="dealettChatTitle">${text.title}</strong>`,
      `      <span data-chat-status>${text.status}</span>`,
      '    </div>',
      '    <button class="dealett-chat-reset" type="button" aria-label="Starta om chatten"><i class="fa-solid fa-rotate-left"></i></button>',
      `    <button class="dealett-chat-close" type="button" aria-label="${text.close}"><i class="fa-solid fa-xmark"></i></button>`,
      '  </header>',
      '  <div class="dealett-chat-messages" role="log" aria-live="polite"></div>',
      '  <div class="dealett-chat-suggestions"></div>',
      '  <form class="dealett-chat-form">',
      `    <input class="dealett-chat-input" type="text" autocomplete="off" placeholder="${text.placeholder}" />`,
      `    <button class="dealett-chat-send" type="submit" aria-label="${text.send}"><i class="fa-solid fa-wand-magic-sparkles"></i></button>`,
      '  </form>',
      '</div>',
    ].join('');

    document.body.append(root);

    const toggle = root.querySelector('.dealett-chat-toggle');
    const panel = root.querySelector('.dealett-chat-panel');
    const resetButton = root.querySelector('.dealett-chat-reset');
    const closeButton = root.querySelector('.dealett-chat-close');
    const messageList = root.querySelector('.dealett-chat-messages');
    const suggestionArea = root.querySelector('.dealett-chat-suggestions');
    const form = root.querySelector('.dealett-chat-form');
    const input = root.querySelector('.dealett-chat-input');
    const status = root.querySelector('[data-chat-status]');

    const escapeChatText = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const getChatTimeLabel = () => new Intl.DateTimeFormat(chatLanguage, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());

    const createChatSessionId = () => [
      'dealett-chat',
      Date.now().toString(36),
      Math.random().toString(36).slice(2, 10),
    ].join('-');

    const persistChatSessionId = (sessionId) => {
      try {
        sessionStorage.setItem(chatSessionKey, sessionId);
      } catch {
        // Feedback still works for this page view if session storage is unavailable.
      }
      return sessionId;
    };

    const readChatSessionId = () => {
      try {
        const stored = sessionStorage.getItem(chatSessionKey);
        if (stored) return stored;
      } catch {
        // Fall back to an in-memory id.
      }
      return persistChatSessionId(createChatSessionId());
    };

    let chatSessionId = readChatSessionId();

    const readCartContext = () => {
      try {
        return (window.DealettCart?.readCart?.() || JSON.parse(localStorage.getItem('dealettCart') || '[]'))
          .slice(0, 4)
          .map((item) => ({
            operator: item.operator,
            title: item.title,
            data: item.data,
            price: item.price,
            persons: item.persons,
            productType: item.productType,
            rewardTotal: item.rewardTotal,
          }));
      } catch {
        return [];
      }
    };

    const createEmptyQualification = () => ({
      peopleCount: null,
      operators: [],
      bindingEnds: [],
      mobileUsage: null,
      priceRange: null,
      exactMonthlyPrice: null,
      exactMonthlyPrices: [],
      readyForOffer: false,
      missingFields: ['peopleCount', 'operators', 'bindingEnds', 'mobileUsage', 'priceRange'],
    });

    const readQualification = () => {
      try {
        const raw = sessionStorage.getItem(qualificationKey);
        return raw ? { ...createEmptyQualification(), ...JSON.parse(raw) } : createEmptyQualification();
      } catch {
        return createEmptyQualification();
      }
    };

    const writeQualification = (qualification) => {
      if (!qualification || typeof qualification !== 'object') return;

      try {
        sessionStorage.setItem(qualificationKey, JSON.stringify({
          ...createEmptyQualification(),
          ...qualification,
        }));
      } catch {
        // Keep chat usable if session storage is unavailable.
      }

      document.dispatchEvent(new CustomEvent('dealett:chat-qualification-updated', {
        detail: {
          qualification: {
            ...createEmptyQualification(),
            ...qualification,
          },
        },
      }));
    };

    const writeOfferCalculation = (offerCalculation) => {
      if (!offerCalculation || typeof offerCalculation !== 'object') return;

      try {
        sessionStorage.setItem(offerCalculationKey, JSON.stringify(offerCalculation));
      } catch {
        // Keep chat usable if session storage is unavailable.
      }
    };

    const mergeQualification = (patch) => {
      if (!patch || typeof patch !== 'object') return;
      writeQualification({
        ...readQualification(),
        ...patch,
      });
    };

    const getQuizContext = () => {
      const liveContext = window.DealettQuiz?.getChatContext?.() || null;
      if (liveContext) {
        activeQuizContext = {
          ...activeQuizContext,
          ...liveContext,
          quizHandoff: true,
        };
      }
      return activeQuizContext;
    };

    const inferSuggestion = (suggestion) => {
      const getActionFromLabel = (label, action) => {
        if (action) return action;
        if (/skriv adress|ange adress|sök adress|enter address|search address/i.test(label)) return 'openBroadbandAddress';
        if (/öppna täckningskarta|coverage map/i.test(label)) return 'openCoverageMap';
        if (/öppna 5g|5g-bredband|broadband/i.test(label)) return 'openBroadbandPage';
        if (/öppna varukorg|open cart|my cart|min varukorg/i.test(label)) return 'openCart';
        if (/mina sidor|konto|account/i.test(label)) return 'openAccount';
        if (/kontakt|support|kundservice|contact/i.test(label)) return 'openContact';
        return null;
      };

      if (suggestion && typeof suggestion === 'object') {
        const label = String(suggestion.label || '').trim();
        return {
          ...suggestion,
          label,
          action: getActionFromLabel(label, suggestion.action),
        };
      }

      const label = String(suggestion || '').trim();
      const normalized = label.toLowerCase();
      const patchMap = [
        { test: /^1$/, patch: { peopleCount: 1 } },
        { test: /^2$/, patch: { peopleCount: 2 } },
        { test: /^3$/, patch: { peopleCount: 3 } },
        { test: /^4$/, patch: { peopleCount: 4 } },
        { test: /5\+/, patch: { peopleCount: 5 } },
        { test: /lite surf|wifi|social/i, patch: { mobileUsage: 'low' } },
        { test: /streaming|video/i, patch: { mobileUsage: 'medium' } },
        { test: /max surf|obegränsad|unlimited/i, patch: { mobileUsage: 'high' } },
        { test: /under 300/i, patch: { priceRange: 'under300' } },
        { test: /300.?400/i, patch: { priceRange: '300-400' } },
        { test: /400.?500/i, patch: { priceRange: '400-500' } },
      ];
      const operator = ['Telia', 'Tele2', 'Telenor', 'Tre']
        .find((item) => item.toLowerCase() === normalized);

      if (operator) {
        return {
          label,
          qualificationPatch: {
            operators: [...readQualification().operators, operator],
          },
        };
      }

      const mapped = patchMap.find((item) => item.test.test(label));
      if (mapped) return { label, qualificationPatch: mapped.patch };
      if (/ingen bindningstid/i.test(label)) {
        return {
          label,
          qualificationPatch: {
            bindingEnds: [...readQualification().bindingEnds, 'Ingen bindningstid'],
          },
        };
      }
      if (/vet inte/i.test(label)) {
        return {
          label,
          qualificationPatch: {
            bindingEnds: [...readQualification().bindingEnds, 'Vet inte'],
          },
        };
      }
      if (/öppna täckningskarta|coverage map/i.test(label)) {
        return { label, action: 'openCoverageMap' };
      }
      if (/öppna 5g|broadband/i.test(label)) {
        return { label, action: 'openBroadbandPage' };
      }

      return { label };
    };

    const syncLanguage = (event) => {
      const previousLanguage = chatLanguage;
      chatLanguage = getChatLanguage();
      text = copy[chatLanguage] || copy.sv;
      status.textContent = text.status;
      input.placeholder = text.placeholder;
      toggle.setAttribute('aria-label', text.open);
      closeButton.setAttribute('aria-label', text.close);
      root.querySelector('.dealett-chat-send')?.setAttribute('aria-label', text.send);

      if (
        event?.type === 'dealett:language-changed' &&
        previousLanguage !== chatLanguage &&
        messages.length
      ) {
        messages.splice(0, messages.length);
        messageList.replaceChildren();
        suggestionArea.replaceChildren();
        lastAssistantResponse = null;
        hasUserStartedChat = false;
        if (!panel.hidden) loadInitialGreeting();
      }
    };

    const scrollMessages = () => {
      messageList.scrollTop = messageList.scrollHeight;
    };

    const hasOfferOptions = (offerCalculation) => Boolean(
      offerCalculation?.readyForOffer &&
      Array.isArray(offerCalculation.options) &&
      offerCalculation.options.length
    );

    const getFinalBotRecommendation = (response) => {
      const option = response?.offerCalculation?.options?.[0];
      if (!option) return String(response?.reply || '').slice(0, 1400);

      const price = Number.isFinite(Number(option.monthlyPrice))
        ? `${Number(option.monthlyPrice).toLocaleString('sv-SE')} kr/mån`
        : null;
      return [
        option.operator,
        option.title,
        price,
      ].filter(Boolean).join(' ').slice(0, 1400);
    };

    const buildFeedbackPayload = ({
      response,
      thumb = null,
      feedbackText = '',
      eventType = 'feedback',
      clickedOfferId = null,
    }) => ({
      eventType,
      sessionId: chatSessionId,
      transcriptId: chatSessionId,
      thumb,
      feedbackText,
      lastDetectedIntent: response?.intent || null,
      lastDetectedStyle: response?.conversationStyle?.style || null,
      offerShown: hasOfferOptions(response?.offerCalculation),
      offerClicked: offerClickedInSession || eventType === 'offer_click',
      finalBotRecommendation: getFinalBotRecommendation(response),
      clickedOfferId,
      page: {
        title: document.title,
        path: window.location.pathname.split('/').pop() || 'index.html',
      },
    });

    const sendChatFeedback = (payload) => {
      if (!window.DealettNetwork?.fetchJson) return Promise.resolve(null);

      return window.DealettNetwork.fetchJson('https://db-qtmd.onrender.com/api/chat-feedback', {
        label: 'Dealett chat feedback',
        method: 'POST',
        timeoutMs: 8000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);
    };

    const getSafeChatUrl = (value) => {
      const url = String(value || '').trim();
      if (!url || /^javascript:/i.test(url)) return '';
      return url;
    };

    const renderFeedbackPrompt = (messageItem, response) => {
      if (!messageItem || !response?.reply) return;

      const feedback = document.createElement('div');
      feedback.className = 'dealett-chat-feedback';

      const question = document.createElement('span');
      question.className = 'dealett-chat-feedback__question';
      question.textContent = text.feedbackQuestion;

      const actions = document.createElement('div');
      actions.className = 'dealett-chat-feedback__actions';

      const yesButton = document.createElement('button');
      yesButton.type = 'button';
      yesButton.className = 'dealett-chat-feedback__button';
      yesButton.textContent = text.feedbackYes;

      const noButton = document.createElement('button');
      noButton.type = 'button';
      noButton.className = 'dealett-chat-feedback__button';
      noButton.textContent = text.feedbackNo;

      actions.append(yesButton, noButton);

      const details = document.createElement('div');
      details.className = 'dealett-chat-feedback__details';
      details.hidden = true;

      const textarea = document.createElement('textarea');
      textarea.className = 'dealett-chat-feedback__text';
      textarea.rows = 2;
      textarea.maxLength = 1000;
      textarea.placeholder = text.feedbackWhy;

      const detailActions = document.createElement('div');
      detailActions.className = 'dealett-chat-feedback__actions';

      const sendButton = document.createElement('button');
      sendButton.type = 'button';
      sendButton.className = 'dealett-chat-feedback__button dealett-chat-feedback__button--primary';
      sendButton.textContent = text.feedbackSend;

      const skipButton = document.createElement('button');
      skipButton.type = 'button';
      skipButton.className = 'dealett-chat-feedback__button';
      skipButton.textContent = text.feedbackSkip;

      detailActions.append(sendButton, skipButton);
      details.append(textarea, detailActions);
      feedback.append(question, actions, details);
      messageItem.append(feedback);

      let selectedThumb = null;
      const setSubmitted = () => {
        feedback.replaceChildren();
        const thanks = document.createElement('span');
        thanks.className = 'dealett-chat-feedback__thanks';
        thanks.textContent = text.feedbackThanks;
        feedback.append(thanks);
        scrollMessages();
      };

      const submitFeedback = async (includeText) => {
        if (!selectedThumb || feedback.dataset.submitted === 'true') return;
        feedback.dataset.submitted = 'true';
        yesButton.disabled = true;
        noButton.disabled = true;
        sendButton.disabled = true;
        skipButton.disabled = true;
        await sendChatFeedback(buildFeedbackPayload({
          response,
          thumb: selectedThumb,
          feedbackText: includeText ? textarea.value : '',
        }));
        setSubmitted();
      };

      const chooseThumb = (thumb) => {
        selectedThumb = thumb;
        yesButton.classList.toggle('is-selected', thumb === 'up');
        noButton.classList.toggle('is-selected', thumb === 'down');
        details.hidden = false;
        scrollMessages();
        textarea.focus();
      };

      yesButton.addEventListener('click', () => chooseThumb('up'));
      noButton.addEventListener('click', () => chooseThumb('down'));
      sendButton.addEventListener('click', () => submitFeedback(true));
      skipButton.addEventListener('click', () => submitFeedback(false));
    };

    const renderQuickReplies = (messageItem, quickReplies) => {
      if (!messageItem || !Array.isArray(quickReplies) || !quickReplies.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'dealett-chat-quick-replies';

      quickReplies.slice(0, 4).forEach((reply) => {
        const label = String(reply?.label || reply || '').trim();
        if (!label) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dealett-chat-quick-reply';
        button.textContent = label;
        button.setAttribute('data-translation-complete', '');
        button.addEventListener('click', () => {
          if (isSending) return;
          wrap.querySelectorAll('button').forEach((item) => {
            item.disabled = true;
          });
          input.value = label;
          sendMessage(label);
        });
        wrap.append(button);
      });

      if (wrap.children.length) {
        messageItem.append(wrap);
        scrollMessages();
      }
    };

    const renderCoverageSelector = (messageItem, widget) => {
      if (!messageItem || widget?.type !== 'coverage_selector') return;

      const card = document.createElement('div');
      card.className = 'dealett-chat-embedded-widget dealett-chat-coverage-selector';
      card.innerHTML = [
        `<strong class="dealett-chat-widget-title"${widget.title ? ' data-translation-complete' : ''}>${escapeChatText(widget.title || 'Kontrollera täckning')}</strong>`,
        widget.description ? `<p class="dealett-chat-widget-description" data-translation-complete>${escapeChatText(widget.description)}</p>` : '',
        '<div class="dealett-chat-widget-actions"></div>',
        '<div class="dealett-chat-address-row" hidden>',
        '  <input class="dealett-chat-address-input" type="text" autocomplete="street-address" placeholder="Skriv adress" />',
        '  <button class="dealett-chat-widget-button dealett-chat-widget-button--primary" type="button">Skicka</button>',
        '</div>',
        '<p class="dealett-chat-widget-status" hidden></p>',
      ].join('');

      const actions = card.querySelector('.dealett-chat-widget-actions');
      const addressRow = card.querySelector('.dealett-chat-address-row');
      const addressInput = card.querySelector('.dealett-chat-address-input');
      const addressSubmit = addressRow.querySelector('button');
      const statusText = card.querySelector('.dealett-chat-widget-status');

      const showStatus = (message) => {
        statusText.textContent = message;
        statusText.hidden = false;
        scrollMessages();
      };

      const sendAddress = () => {
        const address = String(addressInput.value || '').trim();
        if (!address) {
          addressInput.focus();
          return;
        }
        sendMessage(`Kontrollera täckning för: ${address}`);
      };

      const handleAction = (actionId, button) => {
        if (actionId === 'use_location') {
          if (!navigator.geolocation) {
            showStatus('Skriv adressen istället.');
            addressRow.hidden = false;
            addressInput.focus();
            return;
          }

          button.disabled = true;
          button.textContent = 'Hämtar position...';
          navigator.geolocation.getCurrentPosition(
            () => {
              sendMessage('Använd min position för täckning');
            },
            () => {
              button.disabled = false;
              button.textContent = widget.actions.find((action) => action.id === 'use_location')?.label || 'Använd min position';
              showStatus('Skriv adressen istället.');
              addressRow.hidden = false;
              addressInput.focus();
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
          );
          return;
        }

        if (actionId === 'enter_address') {
          addressRow.hidden = false;
          statusText.hidden = true;
          addressInput.focus();
          scrollMessages();
          return;
        }

        if (actionId === 'compare_operators') {
          sendMessage('Jämför täckning mellan operatörer');
        }
      };

      (widget.actions || []).slice(0, 3).forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dealett-chat-widget-button';
        button.textContent = action.label;
        button.setAttribute('data-translation-complete', '');
        button.addEventListener('click', () => handleAction(action.id, button));
        actions.append(button);
      });

      addressSubmit.addEventListener('click', sendAddress);
      addressInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          sendAddress();
        }
      });

      messageItem.append(card);
      scrollMessages();
    };

    const renderEmbeddedWidget = (messageItem, embeddedWidget) => {
      if (embeddedWidget?.type === 'coverage_selector') {
        renderCoverageSelector(messageItem, embeddedWidget);
      }
    };

    const addMessage = (role, content, options = {}) => {
      const item = document.createElement('article');
      item.className = `dealett-chat-message dealett-chat-message--${role}`;
      const isUser = role === 'user';
      const contentAttributes = [
        isUser ? 'data-no-translate' : '',
        options.contentLanguage ? `lang="${escapeChatText(options.contentLanguage)}" data-translation-complete` : '',
      ].filter(Boolean).join(' ');
      item.innerHTML = [
        isUser ? '' : '<span class="dealett-chat-avatar dealett-chat-avatar--bot" aria-hidden="true"><span><b></b></span></span>',
        '<div class="dealett-chat-bubble">',
        `  <p${contentAttributes ? ` ${contentAttributes}` : ''}>${escapeChatText(content)}</p>`,
        `  <time class="dealett-chat-time">${escapeChatText(getChatTimeLabel())}</time>`,
        isUser ? '  <span class="dealett-chat-check" aria-hidden="true"></span>' : '',
        '</div>',
        isUser ? '<span class="dealett-chat-avatar dealett-chat-avatar--user" aria-hidden="true"></span>' : '',
      ].join('');
      messageList.append(item);
      messages.push({ role, content });
      if (messages.length > 10) messages.splice(0, messages.length - 10);
      scrollMessages();
      return item;
    };

    const renderSuggestions = (suggestions) => {
      suggestionArea.replaceChildren();
      if (hasUserStartedChat) return;

      suggestions.slice(0, 5).map(inferSuggestion).forEach((suggestion) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dealett-chat-chip';
        button.textContent = suggestion.label;
        button.addEventListener('click', () => {
          if (suggestion.qualificationPatch) {
            mergeQualification(suggestion.qualificationPatch);
          }

          if (suggestion.action === 'openCoverageMap') {
            if (window.location.pathname.endsWith('/5g-bredband.html')) {
              document.querySelector('#openCoverageModal')?.click();
            } else {
              window.location.href = '5g-bredband.html';
            }
            return;
          }

          if (suggestion.action === 'openBroadbandPage') {
            window.location.href = '5g-bredband.html#offersSection';
            return;
          }

          if (suggestion.action === 'openBroadbandAddress') {
            if (window.location.pathname.endsWith('/5g-bredband.html')) {
              window.DealettBroadband?.focusAddressSearch?.();
              document.querySelector('#addressSearchForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              document.querySelector('#addressInput')?.focus();
            } else {
              try {
                sessionStorage.setItem('dealettFocusBroadbandAddress', 'true');
              } catch {
                // Keep navigation usable if session storage is unavailable.
              }
              window.location.href = '5g-bredband.html#addressSearchForm';
            }
            return;
          }

          if (suggestion.action === 'openCart') {
            const cart = window.DealettCart?.readCart?.() || [];
            if (window.DealettCart?.openDrawer) {
              window.DealettCart.openDrawer(cart);
            } else {
              window.location.href = 'varukorg.html';
            }
            return;
          }

          if (suggestion.action === 'openAccount') {
            window.location.href = 'account.html';
            return;
          }

          if (suggestion.action === 'openContact') {
            window.location.href = 'kontakt.html';
            return;
          }

          sendMessage(suggestion.label);
        });
        suggestionArea.append(button);
      });
    };

    const getProviderClass = (operator) => String(operator || '')
      .toLowerCase()
      .replace('å', 'a')
      .replace('ä', 'a')
      .replace('ö', 'o')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const getOperatorLogo = (operator) => {
      const provider = getProviderClass(operator);
      return provider ? `images/${provider}.${['telia', 'tele2'].includes(provider) ? 'png' : 'jpg'}` : '';
    };

    const addCalculatedOfferToCart = async (planId, options = {}) => {
      const { announce = true, openDrawer = true } = options;
      const response = await window.DealettNetwork.fetchJson('https://db-qtmd.onrender.com/api/offers/cart-item', {
        label: 'Dealett erbjudande till varukorg',
        method: 'POST',
        timeoutMs: 10000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          qualification: readQualification(),
        }),
      });
      const cart = window.DealettCart.appendItem(response.cartItem, {
        state: response.state,
      });
      if (openDrawer) {
        window.DealettCart.openDrawer(cart);
      }
      if (announce) {
        status.textContent = `${response.cartItem.operator} ${response.cartItem.title}`;
        renderSuggestions([{ label: 'Öppna varukorg', action: 'openCart' }]);
      }
      return response;
    };

    const renderAssistantResponse = (response, options = {}) => {
      const { showFeedback = true } = options;
      const assistantText = response.reply || response.message || '';
      lastAssistantResponse = {
        ...response,
        reply: assistantText,
      };
      const assistantItem = addMessage('assistant', assistantText, {
        contentLanguage: chatLanguage,
      });
      renderQuickReplies(assistantItem, response.quickReplies);
      renderChatOfferCards(assistantItem, response.offerCards);
      renderEmbeddedWidget(assistantItem, response.embeddedWidget);
      if (showFeedback) {
        renderFeedbackPrompt(assistantItem, lastAssistantResponse);
      }
      writeQualification(response.qualification);
      writeOfferCalculation(response.offerCalculation);
      return assistantItem;
    };

    const loadInitialGreeting = async () => {
      if (messages.length || isSending) return;

      suggestionArea.replaceChildren();
      setSending(true);
      let requestFailed = false;

      try {
        const response = await window.DealettNetwork.fetchJson('https://db-qtmd.onrender.com/api/chat', {
          label: 'Dealett assistant',
          method: 'POST',
          timeoutMs: 60000,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: chatSessionId,
            message: chatLanguage === 'sv' ? 'hej' : 'hello',
            language: chatLanguage,
            messages: [],
            qualification: createEmptyQualification(),
            cart: readCartContext(),
            page: {
              title: document.title,
              path: window.location.pathname.split('/').pop() || 'index.html',
            },
            context: {
              initialGreeting: true,
            },
          }),
        });

        renderAssistantResponse(response, { showFeedback: false });
      } catch {
        requestFailed = true;
      } finally {
        setSending(false);
        if (requestFailed) {
          status.textContent = text.error;
          addMessage('assistant', text.error, {
            contentLanguage: chatLanguage,
          });
        }
        input.focus();
      }
    };

    const renderChatOfferCards = (messageItem, offerCards) => {
      if (!messageItem || !Array.isArray(offerCards) || !offerCards.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'dealett-chat-offers';
      offerCards.slice(0, 3).forEach((card, index) => {
        const providerClass = getProviderClass(card.operator);
        const logo = getOperatorLogo(card.operator);
        const safeCtaUrl = getSafeChatUrl(card.ctaUrl);
        const article = document.createElement('article');
        article.className = [
          'offer-card',
          'dealett-chat-offer-card',
          index === 0 ? 'offer-card--top' : '',
          providerClass ? `provider-card--${providerClass}` : '',
        ].filter(Boolean).join(' ');
        article.innerHTML = [
          '<div class="offer-card__accent"></div>',
          '<div class="offer-card__inner">',
          `  <span class="offer-card__label">${escapeChatText(card.resultLabel || (index === 0 ? 'Bäst värde' : 'Lägst månadspris'))}</span>`,
          logo ? [
            '  <div class="offer-card__head">',
            `    <img src="${escapeChatText(logo)}" alt="${escapeChatText(card.operator)}" class="offer-card__logo ${providerClass ? `offer-card__logo--${providerClass}` : ''}" />`,
            '    <span class="offer-card__gift-badge" aria-label="Presentkort XXX kr"><strong>XXX kr</strong><span>Presentkort</span></span>',
            '  </div>',
          ].join('') : '',
          `  <h4 class="dealett-chat-offer-title">${escapeChatText(card.operator)} ${escapeChatText(card.planName)}</h4>`,
          '  <div class="offer-card__stats">',
          card.dataLabel ? `    <div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-wifi"></i></span><div><p class="offer-card__stat-label">Surf</p><p class="offer-card__stat-value">${escapeChatText(card.dataLabel)}</p></div></div>` : '',
          card.monthlyPriceLabel ? `    <div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-tag"></i></span><div><p class="offer-card__stat-label">Månadskostnad</p><p class="offer-card__stat-value">${escapeChatText(card.monthlyPriceLabel)}</p></div></div>` : '',
          card.bindingLabel ? `    <div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-file-signature"></i></span><div><p class="offer-card__stat-label">Bindning</p><p class="offer-card__stat-value">${escapeChatText(card.bindingLabel)}</p></div></div>` : '',
          '  </div>',
          card.reason ? `  <p class="dealett-chat-offer-note">${escapeChatText(card.reason)}</p>` : '',
          Array.isArray(card.benefits) && card.benefits.length ? `  <ul class="dealett-chat-offer-benefits">${card.benefits.map(benefit => `<li>${escapeChatText(benefit)}</li>`).join('')}</ul>` : '',
          safeCtaUrl || card.planId ? `  <button class="offer-card__cta dealett-chat-offer-cta" type="button" data-chat-offer-card="${escapeChatText(card.id)}" data-chat-offer-plan="${escapeChatText(card.planId || '')}" data-chat-offer-url="${escapeChatText(safeCtaUrl)}">${escapeChatText(card.ctaLabel || 'Välj erbjudande')} <i class="fa-solid fa-cart-shopping"></i></button>` : '',
          '</div>',
        ].join('');
        wrap.append(article);
      });

      wrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-chat-offer-card]');
        if (!button) return;
        button.disabled = true;
        offerClickedInSession = true;
        const clickTracking = sendChatFeedback(buildFeedbackPayload({
          response: lastAssistantResponse,
          eventType: 'offer_click',
          clickedOfferId: button.dataset.chatOfferCard || button.dataset.chatOfferPlan,
        }));
        const previousLabel = button.innerHTML;
        const planId = button.dataset.chatOfferPlan;
        const ctaUrl = getSafeChatUrl(button.dataset.chatOfferUrl);

        if (!planId && ctaUrl) {
          button.innerHTML = 'Öppnar... <i class="fa-solid fa-spinner fa-spin"></i>';
          clickTracking.finally(() => {
            window.location.href = ctaUrl;
          });
          return;
        }

        if (!planId) {
          button.disabled = false;
          button.innerHTML = previousLabel;
          return;
        }

        button.innerHTML = 'Lägger till... <i class="fa-solid fa-spinner fa-spin"></i>';
        addCalculatedOfferToCart(planId, {
          announce: !ctaUrl,
          openDrawer: !ctaUrl,
        }).then(() => {
          if (ctaUrl) {
            window.location.href = ctaUrl;
            return;
          }
          button.innerHTML = 'Tillagd i varukorg <i class="fa-solid fa-check"></i>';
        }).catch(() => {
          button.disabled = false;
          button.innerHTML = previousLabel;
          status.textContent = text.error;
        });
      });

      messageItem.append(wrap);
      scrollMessages();
    };

    const setSending = (nextValue) => {
      isSending = nextValue;
      input.disabled = nextValue;
      root.querySelector('.dealett-chat-send').disabled = nextValue;
      status.textContent = nextValue ? text.typing : text.status;
    };

    const sendMessage = async (rawMessage, options = {}) => {
      const message = String(rawMessage || '').trim();
      if (!message || isSending) return;
      const requestContext = {
        ...(getQuizContext() || {}),
        ...(options.context || {}),
      };

      hasUserStartedChat = true;
      suggestionArea.replaceChildren();
      addMessage('user', message);
      input.value = '';
      setSending(true);
      let requestFailed = false;

      try {
        const response = await window.DealettNetwork.fetchJson('https://db-qtmd.onrender.com/api/chat', {
          label: 'Dealett assistant',
          method: 'POST',
          timeoutMs: 60000,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: chatSessionId,
            message,
            language: chatLanguage,
            messages: messages.slice(0, -1),
            qualification: readQualification(),
            cart: readCartContext(),
            page: {
              title: document.title,
              path: window.location.pathname.split('/').pop() || 'index.html',
            },
            context: requestContext,
          }),
        });

        renderAssistantResponse(response);
      } catch {
        requestFailed = true;
      } finally {
        setSending(false);
        if (requestFailed) {
          status.textContent = text.error;
          addMessage('assistant', text.error, {
            contentLanguage: chatLanguage,
          });
        }
        input.focus();
      }
    };

    const openPanel = (options = {}) => {
      syncLanguage();
      panel.hidden = false;
      root.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      if (!messages.length && !options.skipGreeting) {
        loadInitialGreeting();
      }
      window.setTimeout(() => input.focus(), 50);
    };

    const closePanel = () => {
      panel.hidden = true;
      root.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    };

    toggle.addEventListener('click', () => {
      if (panel.hidden) openPanel();
      else closePanel();
    });

    window.DealettChat = {
      ...(window.DealettChat || {}),
      open: openPanel,
      close: closePanel,
      readQualification,
      writeQualification,
      continueFromQuiz(payload = {}) {
        const qualification = payload.qualification || payload.quizQualification || null;
        if (qualification) writeQualification(qualification);
        activeQuizContext = {
          ...(payload.context || {}),
          quizHandoff: true,
          source: 'homepage_mobile_quiz',
          currentStage: payload.currentStage || null,
          currentStep: payload.currentStep ?? null,
          answers: payload.answers || {},
          qualification: qualification || readQualification(),
          missingFields: qualification?.missingFields || [],
        };
        openPanel({ skipGreeting: true });
        sendMessage(payload.message || 'Fortsätt härifrån med Dealett AI', {
          context: activeQuizContext,
        });
      },
    };

    closeButton.addEventListener('click', closePanel);

    resetButton.addEventListener('click', () => {
      sessionStorage.removeItem(qualificationKey);
      sessionStorage.removeItem(offerCalculationKey);
      chatSessionId = persistChatSessionId(createChatSessionId());
      lastAssistantResponse = null;
      offerClickedInSession = false;
      hasUserStartedChat = false;
      messages.splice(0, messages.length);
      messageList.replaceChildren();
      loadInitialGreeting();
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) {
        closePanel();
      }
    });

    document.addEventListener('dealett:language-changed', syncLanguage);
  };

  const initHomePremiumMotion = () => {
    const homeIntro = document.querySelector('.home-intro');
    const hero = document.querySelector('.hero');

    if (!homeIntro || !hero) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealSelectors = [
      '.hero .hero-eyebrow',
      '.hero h1',
      '.hero .hero-lead',
      '.hero .hero-actions',
      '.hero .hero-proof',
      '.home-marquee__group',
      '.home-intro__head',
      '.home-service-card',
      '.home-how__copy',
      '.home-how__steps li',
      '.gift-card-image',
      '.gift-card-copy',
      '.gift-logo',
      '.newsletter-panel',
      '.coverage-maplibre-copy',
      '.coverage-maplibre-search',
      '.coverage-maplibre-operators',
      '.coverage-maplibre-note'
    ];
    const revealTargets = Array.from(document.querySelectorAll(revealSelectors.join(',')));

    document.documentElement.classList.add('home-motion-ready');
    revealTargets.forEach((target, index) => {
      target.classList.add('home-reveal');
      target.style.setProperty('--reveal-delay', `${(index % 4) * 38}ms`);
    });

    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(target => target.classList.add('is-visible'));
      return;
    }

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -9% 0px',
      threshold: 0.12
    });

    revealTargets.forEach(target => revealObserver.observe(target));

    const parallaxSections = [
      document.querySelector('.home-intro'),
      document.querySelector('.home-how'),
      document.querySelector('.gift-card-section'),
      document.querySelector('.newsletter-section')
    ].filter(Boolean);
    let motionFrame = 0;

    const updateScrollEffects = () => {
      const viewportCenter = window.innerHeight / 2;
      const heroShift = Math.min(Math.max(window.scrollY * 0.075, 0), 72);
      hero.style.setProperty('--home-hero-shift', `${heroShift.toFixed(1)}px`);

      parallaxSections.forEach(section => {
        const rect = section.getBoundingClientRect();
        const sectionCenter = rect.top + (rect.height / 2);
        const shift = Math.min(Math.max((viewportCenter - sectionCenter) * 0.065, -64), 64);
        section.style.setProperty('--home-parallax-y', `${shift.toFixed(1)}px`);
      });

      motionFrame = 0;
    };

    const requestMotionUpdate = () => {
      if (motionFrame) return;
      motionFrame = window.requestAnimationFrame(updateScrollEffects);
    };

    window.addEventListener('scroll', requestMotionUpdate, { passive: true });
    window.addEventListener('resize', requestMotionUpdate);
    updateScrollEffects();

    hero.addEventListener('pointermove', event => {
      const bounds = hero.getBoundingClientRect();
      const pointerX = ((event.clientX - bounds.left) / bounds.width) * 100;
      const pointerY = ((event.clientY - bounds.top) / bounds.height) * 100;
      hero.style.setProperty('--home-pointer-x', `${pointerX.toFixed(1)}%`);
      hero.style.setProperty('--home-pointer-y', `${pointerY.toFixed(1)}%`);
    });

    hero.addEventListener('pointerleave', () => {
      hero.style.removeProperty('--home-pointer-x');
      hero.style.removeProperty('--home-pointer-y');
    });
  };

  const initMobilePlansPremiumMotion = () => {
    const page = document.querySelector('.mobile-plans-page');
    const hero = page?.querySelector('.shop-hero');

    if (!page || !hero) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealTargets = Array.from(page.querySelectorAll([
      '.shop-list-head',
      '.offers-strip-top',
      '.offer-card'
    ].join(',')));

    document.documentElement.classList.add('mobile-plans-motion-ready');
    revealTargets.forEach((target, index) => {
      target.classList.add('mobile-plans-reveal');
      target.style.setProperty('--mobile-reveal-delay', `${(index % 4) * 38}ms`);
    });

    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach(target => target.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.1
    });

    revealTargets.forEach(target => observer.observe(target));

    const parallaxSections = [
      page.querySelector('#offersSection'),
      page.querySelector('#rewardSection')
    ].filter(Boolean);
    let motionFrame = 0;

    const updateMotion = () => {
      const viewportCenter = window.innerHeight / 2;
      const heroShift = Math.min(Math.max(window.scrollY * 0.07, 0), 68);
      hero.style.setProperty('--mobile-hero-shift', `${heroShift.toFixed(1)}px`);

      parallaxSections.forEach(section => {
        const bounds = section.getBoundingClientRect();
        const sectionCenter = bounds.top + (bounds.height / 2);
        const shift = Math.min(Math.max((viewportCenter - sectionCenter) * 0.06, -62), 62);
        section.style.setProperty('--mobile-parallax-y', `${shift.toFixed(1)}px`);
      });

      motionFrame = 0;
    };

    const requestMotionUpdate = () => {
      if (motionFrame) return;
      motionFrame = window.requestAnimationFrame(updateMotion);
    };

    window.addEventListener('scroll', requestMotionUpdate, { passive: true });
    window.addEventListener('resize', requestMotionUpdate);
    updateMotion();

    hero.addEventListener('pointermove', event => {
      const bounds = hero.getBoundingClientRect();
      const pointerX = ((event.clientX - bounds.left) / bounds.width) * 100;
      const pointerY = ((event.clientY - bounds.top) / bounds.height) * 100;
      hero.style.setProperty('--mobile-pointer-x', `${pointerX.toFixed(1)}%`);
      hero.style.setProperty('--mobile-pointer-y', `${pointerY.toFixed(1)}%`);
    });

    hero.addEventListener('pointerleave', () => {
      hero.style.removeProperty('--mobile-pointer-x');
      hero.style.removeProperty('--mobile-pointer-y');
    });
  };

  const initGlobalBehaviors = () => {
    setHeaderActiveState();
    updateCartCount();
    initDropdowns();
    initHeaderMotion();
    initCoveragePreview();
    initDealettChat();
    initTranslations();
  };

  window.addEventListener('storage', (event) => {
    if (event.key === 'dealettCart') {
      updateCartCount();
    }
  });

  window.addEventListener('dealett:cart-updated', updateCartCount);

  initHomePremiumMotion();
  initMobilePlansPremiumMotion();
  window.DEALETT_includesReady = includePartials().finally(initGlobalBehaviors);
})();
