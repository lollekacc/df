(() => {
  const partials = {
    header: 'partials/header.html',
    footer: 'partials/footer.html',
  };

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
    'Amazon',
    'Apotea',
    'Apollo',
    'Apple',
    'BankID',
    'Dealett',
    'Disney+',
    'Facebook',
    'Foodora',
    'Google',
    'H&M',
    'HBO',
    'Hotels.com',
    'ICA Maxi',
    'Instagram',
    'IKEA',
    'Kivra',
    'Mio',
    'Netflix',
    'Boozt',
    'Spotify',
    'Stadium',
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
    'Åhléns',
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
  const resolveApiResource = (resource) => (
    window.DealettNetwork?.resolveResource?.(resource) || resource
  );
  const translationEndpoint = resolveApiResource('/api/translate');
  const attributionStorageKey = 'dealettAttributionV1';
  const queuedRemoteTranslations = new Set();
  let activeLanguage = 'sv';
  let translationObserver = null;
  let translationFrame = 0;
  let translationRequestTimer = 0;
  let queuedTranslationLanguage = 'sv';
  let isApplyingTranslations = false;
  let originalDocumentTitle = '';

  const readStoredAttribution = () => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(attributionStorageKey) || 'null');
      return stored && typeof stored === 'object' ? stored : null;
    } catch {
      return null;
    }
  };

  const captureAttribution = () => {
    const stored = readStoredAttribution();
    if (stored) return stored;

    const query = new URLSearchParams(window.location.search);
    const utm = {};
    ['source', 'medium', 'campaign', 'term', 'content'].forEach((field) => {
      const value = query.get(`utm_${field}`);
      if (value) utm[field] = value.slice(0, 300);
    });
    const clickIds = {};
    ['gclid', 'fbclid', 'msclkid'].forEach((field) => {
      const value = query.get(field);
      if (value) clickIds[field] = value.slice(0, 300);
    });

    let referrer = null;
    try {
      const referrerUrl = document.referrer ? new URL(document.referrer) : null;
      referrer = referrerUrl ? `${referrerUrl.origin}${referrerUrl.pathname}` : null;
    } catch {
      referrer = null;
    }

    const attribution = {
      version: 1,
      capturedAt: new Date().toISOString(),
      landingPage: `${window.location.pathname}${window.location.hash || ''}`,
      referrer,
      utm,
      clickIds,
    };

    try {
      sessionStorage.setItem(attributionStorageKey, JSON.stringify(attribution));
    } catch {
      return attribution;
    }
    return attribution;
  };

  window.DealettAttribution = {
    read: readStoredAttribution,
  };
  captureAttribution();

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
        option.textContent = code.toUpperCase();
        option.setAttribute('aria-label', `${code.toUpperCase()} - ${name}`);
        option.title = `${code.toUpperCase()} - ${name}`;
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

  const initAudienceSwitch = () => {
    const links = [...document.querySelectorAll('.audience-switch__link')];
    if (!links.length) return;

    const isBusinessPage = document.body.classList.contains('business-page')
      || /(?:^|\/)foretag\.html$/i.test(window.location.pathname);

    links.forEach((link) => {
      const destination = new URL(link.href, window.location.href).pathname;
      const isBusinessLink = /(?:^|\/)foretag\.html$/i.test(destination);
      const isActive = isBusinessPage === isBusinessLink;

      link.classList.toggle('audience-switch__link--active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const currentPath = window.location.pathname.replace(/\/+$/, '');
    document.querySelectorAll('.site-nav .nav-link, .header-cart-link, .header-account-link').forEach((link) => {
      const linkPath = new URL(link.href, window.location.href).pathname.replace(/\/+$/, '');
      const isCurrent = linkPath === currentPath;

      link.closest('.nav-item')?.classList.toggle('nav-item--active', isCurrent);
      if (isCurrent) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
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

    if (!document.querySelector('link[data-dealett-chat-launcher]')) {
      const launcherStyles = document.createElement('link');
      launcherStyles.rel = 'stylesheet';
      launcherStyles.href = 'assets/chat-launcher.css';
      launcherStyles.dataset.dealettChatLauncher = '';
      document.head.append(launcherStyles);
    }

    const copy = {
      sv: {
        open: 'Öppna Dealett assistant',
        close: 'Stäng chatten',
        title: 'Dealett AI',
        reset: 'Starta ny chatt',
        status: 'Online',
        placeholder: 'Skriv din fråga...',
        send: 'Skicka',
        typing: 'Dealett assistant skriver...',
        queued: 'Ditt tillägg är köat...',
        error: 'Jag kunde inte svara just nu. Kontrollera att AI-tjänsten är konfigurerad och försök igen.',
        demoLabel: 'Simulerat demosvar',
        demoStatus: 'Demoläge – simulerade svar',
        streamingNone: 'Inga av dessa streamingtjänster',
        welcomeMessages: [
          'Hej och varmt välkommen till Dealett.',
          'Vi hjälper dig hitta rätt lösning och skräddarsyr den efter dina behov – och du får självklart ett presentkort hos våra partners.',
          'Mig kan du fråga om allt som rör abonnemang – jag har koll på detaljerna…',
        ],
      },
      en: {
        open: 'Open Dealett assistant',
        close: 'Close chat',
        title: 'Dealett AI',
        reset: 'Start new chat',
        status: 'Online',
        placeholder: 'Write your question...',
        send: 'Send',
        typing: 'Dealett assistant is typing...',
        queued: 'Your follow-up is queued...',
        error: 'I could not answer right now. Check that the AI service is configured and try again.',
        demoLabel: 'Simulated demo response',
        demoStatus: 'Demo mode – simulated responses',
        streamingNone: 'None of these streaming services',
        welcomeMessages: [
          'Hi and a warm welcome to Dealett.',
          'We help you find the right solution and tailor it to your needs – and of course you receive a gift card from one of our partners.',
          'You can ask me anything about subscriptions – I know the details…',
        ],
      },
    };

    const getChatLanguage = () => window.DEALETT_I18N?.getLanguage?.() || 'sv';
    let chatLanguage = getChatLanguage();
    let text = copy[chatLanguage] || copy.sv;
    let messages = [];
    const conversationKey = 'dealettChatConversationV3';
    const legacyConversationV2Key = 'dealettChatConversationV2';
    const legacyConversationV1Key = 'dealettChatConversationV1';
    const legacyQualificationKey = 'dealettChatQualification';
    const legacyOfferCalculationKey = 'dealettChatOfferCalculation';
    const chatSessionKey = 'dealettChatSessionId';
    const autoOpenKey = 'dealettChatAutoOpenedV2';
    const conversationTtlMs = 60 * 60 * 1000;
    const maxRecoveryMessages = 250;
    let isSending = false;
    const conversationsKey = 'dealettChatConversationsV1';
    const conversations = new Map();
    const runtimes = new Map();
    let backgroundUpdate = false;
    let renderConversationList = () => {};
    try {
      const saved = JSON.parse(sessionStorage.getItem(conversationsKey) || '[]');
      if (Array.isArray(saved)) saved.forEach(entry => {
        if (entry?.conversationId && Array.isArray(entry.messages) && Date.now() - entry.updatedAt < conversationTtlMs) {
          conversations.set(entry.conversationId, entry);
        }
      });
    } catch {}
    const persistConversationList = () => {
      try { sessionStorage.setItem(conversationsKey, JSON.stringify([...conversations.values()])); } catch {}
      renderConversationList();
    };
    let activeChatRequest = null;
    let failedTurn = null;
    let typingIndicator = null;
    let lastCompletedAssistantItem = null;
    let completedTurnPositionToken = 0;
    let lastAssistantResponse = null;
    let lastResponseWasSimulated = false;
    let renderedOfferIds = new Set();
    let offerClickedInSession = false;
    let hasUserStartedChat = false;
    let activeQuizContext = null;
    let ignoreQuizContext = false;
    let pendingMessages = [];

    const root = document.createElement('section');
    root.id = 'dealettChat';
    root.className = 'dealett-chat';
    root.innerHTML = [
      `<button class="dealett-chat-toggle dealett-chat-toggle--image" type="button" aria-label="${text.open}" aria-expanded="false">`,
      '  <img class="dealett-chat-toggle__image" src="images/chaticon.png" alt="" aria-hidden="true" draggable="false">',
      '</button>',
      `<div class="dealett-chat-panel" role="dialog" aria-modal="false" aria-label="${text.title}" hidden>`,
      '  <header class="dealett-chat-header">',
      `    <span class="dealett-chat-status-accessible" data-chat-status aria-live="polite">${text.status}</span>`,
      `    <button class="dealett-chat-close" type="button" aria-label="${text.close}"><i class="fa-solid fa-xmark"></i></button>`,
      '  </header>',
      '  <div class="dealett-chat-messages" role="log" aria-live="polite"></div>',
      '  <div class="dealett-chat-suggestions"></div>',
      '  <form class="dealett-chat-form">',
      `    <input class="dealett-chat-input" type="text" autocomplete="off" placeholder="${text.placeholder}" />`,
      `    <button class="dealett-chat-send" type="submit" aria-label="${text.send}"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i></button>`,
      '  </form>',
      '</div>',
    ].join('');

    document.body.append(root);

    const toggle = root.querySelector('.dealett-chat-toggle');
    const panel = root.querySelector('.dealett-chat-panel');
    const closeButton = root.querySelector('.dealett-chat-close');
    let messageList = root.querySelector('.dealett-chat-messages');
    const suggestionArea = root.querySelector('.dealett-chat-suggestions');
    const form = root.querySelector('.dealett-chat-form');
    const input = root.querySelector('.dealett-chat-input');
    const status = root.querySelector('[data-chat-status]');
    const heroGuide = document.querySelector('.hero-ai-guide');
    const heroForm = heroGuide?.querySelector('[data-home-ai-form]');
    const heroInput = heroForm?.querySelector('textarea');
    const heroSend = heroForm?.querySelector('[type="submit"]');
    const heroInitialPlaceholder = heroInput?.placeholder;
    const inlineControls = document.createElement('div');
    inlineControls.className = 'dealett-chat-inline-controls';
    const inlineStatus = document.createElement('span');
    inlineStatus.setAttribute('role', 'status');
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.hidden = true;
    inlineControls.append(inlineStatus, retryButton);
    messageList.append(inlineControls);
    const syncInlineState = () => {
      if (backgroundUpdate) return;
      const inline = root.classList.contains('dealett-chat--inline');
      const english = chatLanguage === 'en';
      root.querySelector('.dealett-chat-send').disabled = isSending || Boolean(failedTurn);
      if (heroSend) heroSend.disabled = inline && (isSending || Boolean(failedTurn));
      const hasConversation = messages.some(message => message.role === 'user');
      const quickActions = heroGuide?.querySelector('.dealett-chat-reference-actions');
      if (quickActions) quickActions.hidden = hasConversation || conversations.get(chatSessionId)?.quickActionsDismissed === true;
      const startingView = inline && !hasConversation && conversations.get(chatSessionId)?.startingView === true;
      if (heroInput) heroInput.placeholder = inline && hasConversation
        ? (english ? 'Write your reply...' : 'Skriv ditt svar...')
        : startingView
          ? (english ? 'Write here...' : 'Skriv här...')
          : document.querySelector('.home-intro')
            ? `${english ? 'Write here.' : 'Skriv här.'} ${heroInitialPlaceholder}`
            : heroInitialPlaceholder;
      if (heroInput && document.querySelector('.home-intro') && window.innerWidth > 900) heroInput.placeholder = english ? 'Write your question here...' : 'Skriv din fråga här...';
      let example = messageList.querySelector('.dealett-chat-starting-example');
      if (startingView && !example) {
        example = document.createElement('p');
        example.className = 'dealett-chat-starting-example';
        example.textContent = heroInitialPlaceholder;
        messageList.prepend(example);
      } else if (!startingView) example?.remove();
      messageList.setAttribute('aria-busy', String(isSending));
      retryButton.hidden = !failedTurn || isSending;
      retryButton.textContent = english ? 'Try again' : 'Försök igen';
      inlineStatus.textContent = isSending
        ? (english ? 'Dealett AI is replying…' : 'Dealett AI svarar…')
        : failedTurn
          ? (english ? 'No reply received. Try again.' : 'Svaret kunde inte hämtas. Försök igen.')
          : !hasConversation && heroForm
            ? (english ? 'Ask Dealett AI' : 'Fråga Dealett AI')
            : (english ? 'Your conversation with Dealett AI' : 'Din konversation med Dealett AI');
    };
    const sizeInlineChat = () => {
      if (!heroForm) return;
      const active = heroGuide.classList.contains('has-inline-chat');
      heroGuide.classList.remove('has-inline-chat');
      root.style.setProperty('display', 'none', 'important');
      const guideBox = heroGuide.getBoundingClientRect();
      const composerBox = heroForm.parentElement.getBoundingClientRect();
      const prompts = heroGuide.querySelector('.hero-ai-guide__prompts');
      const promptsBox = prompts.getBoundingClientRect();
      const gap = promptsBox.top - composerBox.bottom;
      const obstacles = [...document.querySelectorAll('.hero-finder, .hero-value, .hero-showcase, main > section')]
        .filter(element => !element.contains(heroGuide))
        .map(element => element.getBoundingClientRect())
        .filter(box => box.height > 0 && box.top >= promptsBox.bottom - 1 && box.left < composerBox.right && box.right > composerBox.left);
      const boundary = obstacles.length ? Math.min(...obstacles.map(box => box.top)) : promptsBox.bottom;
      const promptHeight = Math.max(...[...prompts.children]
        .map(element => element.getBoundingClientRect().height), 0);
      const referenceLayout = Boolean(document.querySelector('.home-intro')) && window.innerWidth > 900;
      const height = Math.max(composerBox.height, boundary - composerBox.top - (referenceLayout ? 0 : promptHeight + gap) - 12);
      const width = composerBox.width;
      const values = {
        'guide-height': guideBox.height,
        'composer-top': composerBox.top - guideBox.top,
        'composer-left': composerBox.left - guideBox.left,
        'composer-width': width,
        'composer-height': height,
        'prompts-top': composerBox.top - guideBox.top + height + gap,
        'prompts-left': promptsBox.left - guideBox.left,
        'prompts-width': width,
      };
      Object.entries(values).forEach(([key, value]) => heroGuide.style.setProperty(`--inline-${key}`, `${value}px`));
      if (active) heroGuide.classList.add('has-inline-chat');
      root.style.removeProperty('display');
    };
    const refreshInlineSize = () => {
      if (heroGuide?.classList.contains('has-inline-chat')) sizeInlineChat();
      revealActiveTab();
      if (lastCompletedAssistantItem && !isSending) positionCompletedTurn(lastCompletedAssistantItem, { smooth: false });
    };
    window.addEventListener('resize', refreshInlineSize);
    document.querySelector('link[data-dealett-chat-launcher]')?.addEventListener('load', refreshInlineSize);
    document.fonts?.ready.then(refreshInlineSize);
    const mountInlineChat = () => {
      if (!heroForm) return;
      if (!heroGuide.classList.contains('has-inline-chat')) sizeInlineChat();
      heroForm.parentElement.insertBefore(root, heroForm);
      messageList.append(inlineControls);
      heroGuide.classList.add('has-inline-chat');
      root.classList.add('dealett-chat--inline');
      panel.setAttribute('role', 'region');
      panel.hidden = false;
      root.classList.add('is-open');
      setHistoryOpen(historyOpen);
      syncInlineState();
      if (lastCompletedAssistantItem && !isSending) positionCompletedTurn(lastCompletedAssistantItem, { smooth: false });
    };
    const focusChatInput = () => {
      if (backgroundUpdate) return;
      const composer = root.classList.contains('dealett-chat--inline')
        ? document.getElementById('home-ai-question')
        : input;
      composer?.focus({ preventScroll: true });
    };

    let autoOpenHandled = false;
    try {
      autoOpenHandled = sessionStorage.getItem(autoOpenKey) === 'true';
    } catch {
      // Auto-open once for this page view when storage is unavailable.
    }

    const markAutoOpenHandled = () => {
      autoOpenHandled = true;
      try {
        sessionStorage.setItem(autoOpenKey, 'true');
      } catch {
        // The in-memory flag still prevents another automatic opening.
      }
    };

    const escapeChatText = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const getChatTimeLabel = (timestamp = Date.now()) => new Intl.DateTimeFormat(chatLanguage, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));

    const clearStoredConversation = () => {
      try {
        sessionStorage.removeItem(conversationKey);
        sessionStorage.removeItem(legacyConversationV2Key);
        sessionStorage.removeItem(legacyConversationV1Key);
        sessionStorage.removeItem(legacyQualificationKey);
        sessionStorage.removeItem(legacyOfferCalculationKey);
        sessionStorage.removeItem(chatSessionKey);
      } catch {
        // Keep chat usable if session storage is unavailable.
      }
    };

    const createStableChatId = () => {
      if (window.crypto?.randomUUID) return window.crypto.randomUUID();
      const bytes = new Uint8Array(16);
      if (window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        bytes.forEach((_, index) => {
          bytes[index] = Math.floor(Math.random() * 256);
        });
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
    };

    const readStoredConversation = () => {
      try {
        const raw = sessionStorage.getItem(conversationKey) || sessionStorage.getItem(legacyConversationV2Key);
        if (!raw) {
          sessionStorage.removeItem(legacyConversationV1Key);
          sessionStorage.removeItem(legacyQualificationKey);
          sessionStorage.removeItem(legacyOfferCalculationKey);
          sessionStorage.removeItem(chatSessionKey);
          return null;
        }

        const stored = JSON.parse(raw);
        const updatedAt = Number(stored?.updatedAt);
        if (!updatedAt || Date.now() - updatedAt >= conversationTtlMs) {
          clearStoredConversation();
          return null;
        }
        return stored;
      } catch {
        clearStoredConversation();
        return null;
      }
    };

    let storedConversation = readStoredConversation();
    let conversationPresentation = storedConversation?.presentation || null;

    const persistChatSessionId = (sessionId) => {
      try {
        sessionStorage.setItem(chatSessionKey, sessionId);
      } catch {
        // Feedback still works for this page view if session storage is unavailable.
      }
      return sessionId;
    };

    const readChatSessionId = () => {
      if (storedConversation?.conversationId) return storedConversation.conversationId;
      if (storedConversation?.version >= 3 && storedConversation?.sessionId) {
        return storedConversation.sessionId;
      }
      try {
        const stored = sessionStorage.getItem(chatSessionKey);
        if (storedConversation?.version >= 3 && stored) return stored;
      } catch {
        // Fall back to an in-memory id.
      }
      return persistChatSessionId(createStableChatId());
    };

    let chatSessionId = readChatSessionId();
    let conversationToken = storedConversation?.conversationToken || null;
    let droppedMessageCount = Math.max(Number(storedConversation?.droppedMessageCount) || 0, 0);
    let nextMessageSequence = 1;

    const normalizeStoredMessage = (message, fallbackSequence) => {
      if (!message || !['assistant', 'user'].includes(message.role) || typeof message.content !== 'string') {
        return null;
      }
      const sequence = Number.isInteger(Number(message.sequence)) && Number(message.sequence) > 0
        ? Number(message.sequence)
        : fallbackSequence;
      const createdAt = message.createdAt || message.timestamp || new Date().toISOString();
      return {
        messageId: String(message.messageId || message.id || createStableChatId()),
        sequence,
        role: message.role,
        content: message.content,
        createdAt,
        timestamp: createdAt,
        language: message.language || message.contentLanguage || null,
        contentLanguage: message.contentLanguage || message.language || null,
        greeting: message.greeting === true,
        hidden: message.hidden === true,
        delivery: message.delivery || null,
        structuredContent: message.structuredContent || null,
        metadata: message.metadata || null,
      };
    };

    const recoveredMessages = Array.isArray(storedConversation?.messages)
      ? storedConversation.messages
        .slice(-maxRecoveryMessages)
        .map((message, index) => normalizeStoredMessage(message, index + 1))
        .filter(Boolean)
        .sort((left, right) => left.sequence - right.sequence)
      : [];
    recoveredMessages.reduce((previousSequence, message) => {
      message.sequence = Math.max(message.sequence, previousSequence + 1);
      return message.sequence;
    }, 0);
    messages.push(...recoveredMessages);
    nextMessageSequence = messages.reduce(
      (highest, message) => Math.max(highest, message.sequence + 1),
      1
    );

    const appendRecoveryMessage = (message) => {
      messages.push(message);
      if (messages.length > maxRecoveryMessages) {
        const overflow = messages.length - maxRecoveryMessages;
        messages.splice(0, overflow);
        droppedMessageCount += overflow;
      }
    };

    const createMessageRecord = (role, content, options = {}) => {
      const requestedSequence = Number(options.sequence) || 0;
      const sequence = requestedSequence >= nextMessageSequence
        ? requestedSequence
        : nextMessageSequence;
      nextMessageSequence = Math.max(nextMessageSequence, Number(sequence) + 1);
      return normalizeStoredMessage({
        messageId: options.messageId || createStableChatId(),
        sequence,
        role,
        content,
        createdAt: options.createdAt || options.timestamp || new Date().toISOString(),
        language: options.language || options.contentLanguage || null,
        greeting: options.greeting === true,
        hidden: options.hidden === true,
        structuredContent: options.structuredContent || null,
        metadata: options.metadata || null,
      }, sequence);
    };

    const createPendingMessageRecord = (role, content, options = {}) => {
      const createdAt = options.createdAt || options.timestamp || new Date().toISOString();
      return {
        messageId: options.messageId || createStableChatId(),
        sequence: null,
        role,
        content,
        createdAt,
        timestamp: createdAt,
        language: options.language || options.contentLanguage || null,
        contentLanguage: options.contentLanguage || options.language || null,
        greeting: options.greeting === true,
        hidden: options.hidden === true,
        structuredContent: options.structuredContent || null,
        metadata: options.metadata || null,
      };
    };

    const persistConversation = (updates = {}) => {
      const now = Date.now();
      storedConversation = {
        ...conversations.get(chatSessionId),
        version: 3,
        conversationId: chatSessionId,
        sessionId: chatSessionId,
        conversationToken,
        presentation: conversationPresentation,
        createdAt: storedConversation?.createdAt || new Date(now).toISOString(),
        updatedAt: now,
        updatedAtIso: new Date(now).toISOString(),
        messages: messages.map((message) => ({ ...message })),
        messageCount: messages.length + droppedMessageCount,
        droppedMessageCount,
        transcriptTruncated: droppedMessageCount > 0,
        qualification: updates.qualification !== undefined
          ? updates.qualification
          : (storedConversation?.qualification || null),
        offerCalculation: updates.offerCalculation !== undefined
          ? updates.offerCalculation
          : (storedConversation?.offerCalculation || null),
        flowState: updates.flowState !== undefined
          ? updates.flowState
          : (storedConversation?.flowState || null),
      };

      conversations.set(chatSessionId, storedConversation);
      persistConversationList();
      if (backgroundUpdate) return;
      try {
        sessionStorage.setItem(conversationKey, JSON.stringify(storedConversation));
        sessionStorage.removeItem(legacyConversationV2Key);
        sessionStorage.setItem(chatSessionKey, chatSessionId);
      } catch {
        // The in-memory conversation remains available for this page view.
      }
    };

    const isConversationExpired = () => Boolean(
      storedConversation?.updatedAt && Date.now() - storedConversation.updatedAt >= conversationTtlMs
    );

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
      familyPriceRange: null,
      exactMonthlyPrice: null,
      exactMonthlyPrices: [],
      streamingCalculation: null,
      streamingServices: [],
      streamingMonthlyCosts: {},
      internationalTravel: null,
      internationalUsage: null,
      readyForOffer: false,
      missingFields: [
        'peopleCount', 'operators', 'bindingEnds', 'mobileUsage', 'priceRange',
        'streamingCalculation', 'internationalTravel',
      ],
    });

    const readQualification = () => {
      const qualification = storedConversation?.qualification;
      return qualification
        ? { ...createEmptyQualification(), ...qualification }
        : createEmptyQualification();
    };

    const writeQualification = (qualification) => {
      if (!qualification || typeof qualification !== 'object') return;

      const nextQualification = {
        ...createEmptyQualification(),
        ...qualification,
      };
      persistConversation({ qualification: nextQualification });

      if (backgroundUpdate) return;
      document.dispatchEvent(new CustomEvent('dealett:chat-qualification-updated', {
        detail: {
          qualification: {
            ...nextQualification,
          },
        },
      }));
    };

    const writeOfferCalculation = (offerCalculation) => {
      if (!offerCalculation || typeof offerCalculation !== 'object') return;

      persistConversation({ offerCalculation });
    };

    const createEmptyQuestionFlowState = () => ({
      version: 1,
      inProgress: false,
      activeQuestionField: null,
      blockedQuestionField: null,
      attempts: {},
      deferredFields: [],
      pendingBindingEnd: null,
    });

    const readQuestionFlowState = () => storedConversation?.flowState || createEmptyQuestionFlowState();

    const writeQuestionFlowState = (flowState) => {
      if (!flowState || typeof flowState !== 'object') return;
      persistConversation({ flowState });
    };

    const getQuizContext = () => {
      if (ignoreQuizContext) return null;
      return activeQuizContext?.quizHandoff === true ? activeQuizContext : null;
    };

    const syncLanguage = (event) => {
      const previousLanguage = chatLanguage;
      chatLanguage = getChatLanguage();
      text = copy[chatLanguage] || copy.sv;
      status.textContent = lastResponseWasSimulated ? text.demoStatus : text.status;
      input.placeholder = text.placeholder;
      toggle.setAttribute('aria-label', text.open);
      panel.setAttribute('aria-label', text.title);
      closeButton.setAttribute('aria-label', text.close);
      root.querySelector('.dealett-chat-send')?.setAttribute('aria-label', text.send);

      if (
        event?.type === 'dealett:language-changed' &&
        previousLanguage !== chatLanguage &&
        messages.length && !root.classList.contains('dealett-chat--inline')
      ) {
        resetChatConversation({ greet: !panel.hidden });
      }
      syncInlineState();
      renderConversationList();
    };

    const getElementTopInMessageList = (element, listRect) => (
      messageList.scrollTop + element.getBoundingClientRect().top - listRect.top
    );

    const getPreviousTurnUserItem = (assistantItem) => {
      let item = assistantItem.previousElementSibling;
      while (item) {
        if (item.classList.contains('dealett-chat-message--user')) return item;
        if (item.classList.contains('dealett-chat-message')) break;
        item = item.previousElementSibling;
      }
      return null;
    };

    const scrollMessages = () => {
      completedTurnPositionToken += 1;
      messageList.scrollTop = messageList.scrollHeight;
    };

    const showTypingIndicator = () => {
      if (typingIndicator?.parentNode === messageList) return;

      const item = document.createElement('article');
      item.className = 'dealett-chat-message dealett-chat-message--assistant dealett-chat-message--typing';
      item.innerHTML = [
        `<div class="dealett-chat-bubble" role="status" aria-label="${escapeChatText(text.typing)}">`,
        '  <span class="dealett-chat-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>',
        '</div>',
      ].join('');
      typingIndicator = item;
      messageList.append(item);
      scrollMessages();
    };

    const hideTypingIndicator = () => {
      typingIndicator?.remove();
      typingIndicator = null;
    };

    const positionCompletedTurn = (assistantItem, { smooth = true } = {}) => {
      if (!assistantItem) return;
      lastCompletedAssistantItem = assistantItem;
      if (assistantItem.classList.contains('dealett-chat-message--greeting')) {
        scrollMessages();
        return;
      }
      if (backgroundUpdate) return;
      const positionToken = ++completedTurnPositionToken;
      window.requestAnimationFrame(() => {
        if (positionToken !== completedTurnPositionToken || !assistantItem.isConnected) return;
        if (panel.hidden || messageList.clientHeight <= 0) return;
        if (pendingMessages.length) {
          scrollMessages();
          return;
        }

        const listRect = messageList.getBoundingClientRect();
        const assistantRect = assistantItem.getBoundingClientRect();
        const listStyles = getComputedStyle(messageList);
        const topPadding = Number.parseFloat(listStyles.paddingTop) || 0;
        const bottomPadding = Number.parseFloat(listStyles.paddingBottom) || 0;
        const assistantTop = getElementTopInMessageList(assistantItem, listRect);
        const assistantBottom = assistantTop + assistantRect.height;
        const userItem = getPreviousTurnUserItem(assistantItem);
        const userTop = userItem ? getElementTopInMessageList(userItem, listRect) : assistantTop;
        const availableHeight = Math.max(0, messageList.clientHeight - topPadding - bottomPadding);
        const turnHeight = assistantBottom - userTop;
        const targetScrollTop = Math.max(
          0,
          (turnHeight <= availableHeight ? userTop : assistantTop) - topPadding
        );

        window.requestAnimationFrame(() => {
          if (positionToken !== completedTurnPositionToken || !assistantItem.isConnected) return;
          const maximumScrollTop = Math.max(0, messageList.scrollHeight - messageList.clientHeight);
          const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          messageList.scrollTo({
            top: Math.min(targetScrollTop, maximumScrollTop),
            behavior: smooth && !reducedMotion ? 'smooth' : 'auto',
          });
        });
      });

      assistantItem.querySelectorAll('img').forEach((image) => {
        if (image.complete) return;
        image.addEventListener('load', () => {
          if (assistantItem === lastCompletedAssistantItem && !isSending) {
            positionCompletedTurn(assistantItem, { smooth: false });
          }
        }, { once: true });
      });
    };

    const getPresentedOfferOptions = (offerCalculation) => (
      Array.isArray(offerCalculation?.featuredOffers) && offerCalculation.featuredOffers.length
        ? offerCalculation.featuredOffers
        : (Array.isArray(offerCalculation?.options) ? offerCalculation.options : [])
    );

    const hasOfferOptions = (offerCalculation) => Boolean(
      offerCalculation?.readyForOffer && getPresentedOfferOptions(offerCalculation).length
    );

    const getFinalBotRecommendation = (response) => {
      const option = getPresentedOfferOptions(response?.offerCalculation)[0];
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
      conversationId: chatSessionId,
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

      return window.DealettNetwork.fetchJson('/api/chat-feedback', {
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

    const bindingLookupProfiles = {
      Telia: {
        portalName: 'Mitt Telia',
        loginUrl: 'https://www.telia.se/mitt-telia/start',
        hint: 'Öppna ditt mobilabonnemang och leta efter bindningstid eller avtalstid.',
      },
      Tele2: {
        portalName: 'Mitt Tele2',
        loginUrl: 'https://www.tele2.se/mitt-tele2',
        hint: 'Öppna Abonnemang eller dina tjänster och kontrollera bindningstid.',
      },
      Telenor: {
        portalName: 'Mitt Telenor',
        loginUrl: 'https://www.telenor.se/mitt-telenor/',
        hint: 'Öppna abonnemanget och se detaljer för bindningstid och tjänster.',
      },
      Tre: {
        portalName: 'Mitt3',
        loginUrl: 'https://www.tre.se/mitt3',
        hint: 'Välj abonnemang, gå till Abonnemangsdetaljer och se rutan Uppgifter.',
      },
    };

    const getBindingLookupProfile = (operator) => {
      const normalized = String(operator || '').trim().toLocaleLowerCase('sv');
      return Object.entries(bindingLookupProfiles).find(([name]) => (
        name.toLocaleLowerCase('sv') === normalized
      ))?.[1] || null;
    };

    const getBindingLookupOperatorsFromQualification = () => {
      const operators = readQualification().operators || [];
      const selected = operators
        .map((operator) => String(operator || '').trim())
        .filter((operator) => getBindingLookupProfile(operator));
      return [...new Set(selected.length ? selected : Object.keys(bindingLookupProfiles))]
        .map((name) => ({ name, ...bindingLookupProfiles[name] }))
        .filter((operator) => operator.loginUrl);
    };

    const openBindingLookupModal = ({
      operator = '',
      operators = [],
      onResolved = null,
    } = {}) => {
      const suppliedOperators = Array.isArray(operators) && operators.length
        ? operators
        : getBindingLookupOperatorsFromQualification();
      const normalizedOperators = suppliedOperators
        .map((item) => {
          const name = String(item?.name || item || '').trim();
          const fallback = getBindingLookupProfile(name) || {};
          return {
            name,
            portalName: String(item?.portalName || fallback.portalName || name).trim(),
            loginUrl: String(item?.loginUrl || fallback.loginUrl || '').trim(),
            hint: String(item?.hint || fallback.hint || '').trim(),
          };
        })
        .filter((item) => item.name && item.loginUrl);
      if (!normalizedOperators.length) return;

      const selectedIndex = Math.max(0, normalizedOperators.findIndex((item) => (
        item.name.toLocaleLowerCase('sv') === String(operator || '').trim().toLocaleLowerCase('sv')
      )));
      let selectedOperator = normalizedOperators[selectedIndex] || normalizedOperators[0];
      const modal = document.createElement('div');
      modal.className = 'dealett-binding-lookup-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = [
        '<div class="dealett-binding-lookup-modal__backdrop" data-binding-lookup-close></div>',
        '<section class="dealett-binding-lookup-modal__panel" aria-labelledby="bindingLookupTitle">',
        '  <header class="dealett-binding-lookup-modal__head">',
        '    <div>',
        '      <p class="dealett-binding-lookup-modal__kicker">Bindningstid</p>',
        '      <h2 id="bindingLookupTitle">Hitta bindningstid</h2>',
        '    </div>',
        '    <button class="dealett-binding-lookup-modal__close" type="button" data-binding-lookup-close aria-label="Stäng"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>',
        '  </header>',
        '  <div class="dealett-binding-lookup-modal__operators"></div>',
        '  <p class="dealett-binding-lookup-modal__hint"></p>',
        '  <div class="dealett-binding-lookup-modal__viewer">',
        '    <iframe title="Operatörens inloggning" referrerpolicy="no-referrer-when-downgrade"></iframe>',
        '  </div>',
        '  <p class="dealett-binding-lookup-modal__fallback">Om inloggningen inte visas här kan operatören blockera inbäddning. Öppna länken, kontrollera datumet och kom tillbaka till chatten.</p>',
        '  <a class="dealett-binding-lookup-modal__external" target="_blank" rel="noopener">Öppna i ny flik</a>',
        '  <form class="dealett-binding-lookup-modal__answer">',
        '    <label>Slutdatum <input type="date" required></label>',
        '    <div>',
        '      <button type="submit">Skicka datum</button>',
        '      <button type="button" data-binding-lookup-no-binding>Ingen bindningstid</button>',
        '    </div>',
        '  </form>',
        '</section>',
      ].join('');

      const closeModal = () => {
        modal.remove();
        document.body.classList.remove('dealett-binding-lookup-open');
      };
      const operatorButtons = modal.querySelector('.dealett-binding-lookup-modal__operators');
      const hint = modal.querySelector('.dealett-binding-lookup-modal__hint');
      const iframe = modal.querySelector('iframe');
      const externalLink = modal.querySelector('.dealett-binding-lookup-modal__external');
      const renderOperator = (nextOperator) => {
        selectedOperator = nextOperator;
        hint.textContent = `${selectedOperator.portalName}: ${selectedOperator.hint}`;
        iframe.src = selectedOperator.loginUrl;
        externalLink.href = selectedOperator.loginUrl;
        externalLink.textContent = `Öppna ${selectedOperator.portalName} i ny flik`;
        operatorButtons.querySelectorAll('button').forEach((button) => {
          const active = button.dataset.operator === selectedOperator.name;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
        });
      };

      normalizedOperators.forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.operator = item.name;
        button.textContent = item.name;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => renderOperator(item));
        operatorButtons.append(button);
      });

      modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-binding-lookup-close]')) closeModal();
        if (event.target.closest('[data-binding-lookup-no-binding]')) {
          closeModal();
          if (typeof onResolved === 'function') onResolved('Ingen bindningstid');
          else sendMessage('Ingen bindningstid', { context: { bindingLookup: true } });
        }
      });
      modal.querySelector('form').addEventListener('submit', (event) => {
        event.preventDefault();
        const date = modal.querySelector('input[type="date"]')?.value;
        if (!date) return;
        closeModal();
        if (typeof onResolved === 'function') onResolved(date);
        else sendMessage(date, { context: { bindingLookup: true } });
      });

      document.body.append(modal);
      document.body.classList.add('dealett-binding-lookup-open');
      renderOperator(selectedOperator);
      modal.querySelector('.dealett-binding-lookup-modal__close')?.focus();
    };

    const runQuickReplyAction = (action) => {
      if (action === 'open_coverage_map') {
        if (window.location.pathname.endsWith('/5g-bredband.html')) {
          document.querySelector('#openCoverageModal')?.click();
        } else {
          window.location.href = '5g-bredband.html';
        }
        return true;
      }
      if (action === 'open_broadband_page') {
        window.location.href = '5g-bredband.html#offersSection';
        return true;
      }
      if (action === 'open_broadband_address') {
        if (window.location.pathname.endsWith('/5g-bredband.html')) {
          window.DealettBroadband?.focusAddressSearch?.();
          document.querySelector('#addressSearchForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document.querySelector('#addressInput')?.focus();
        } else {
          sessionStorage.setItem('dealettFocusBroadbandAddress', 'true');
          window.location.href = '5g-bredband.html#addressSearchForm';
        }
        return true;
      }
      if (action === 'open_binding_lookup') {
        openBindingLookupModal();
        return true;
      }
      if (action === 'open_cart') {
        const cart = window.DealettCart?.readCart?.() || [];
        if (window.DealettCart?.openDrawer) window.DealettCart.openDrawer(cart);
        else window.location.href = 'varukorg.html';
        return true;
      }
      if (action === 'open_account') {
        window.location.href = 'account.html';
        return true;
      }
      if (action === 'open_contact') {
        window.location.href = 'kontakt.html';
        return true;
      }
      return false;
    };

    const renderQuickReplies = (messageItem, quickReplies) => {
      if (!messageItem || !Array.isArray(quickReplies) || !quickReplies.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'dealett-chat-quick-replies';
      const visibleQuickReplies = quickReplies.slice(0, 10);
      if (
        visibleQuickReplies.length === 10 &&
        visibleQuickReplies.every((reply, index) => String(reply?.label || reply).trim() === String(index + 1))
      ) {
        wrap.classList.add('dealett-chat-quick-replies--people');
      }

      visibleQuickReplies.forEach((reply) => {
        const label = String(reply?.label || reply || '').trim();
        if (!label) return;
        const action = String(reply?.action || 'send_message');

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dealett-chat-quick-reply';
        button.textContent = label;
        button.setAttribute('data-translation-complete', '');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          button.classList.add('is-selected');
          button.setAttribute('aria-pressed', 'true');
          wrap.querySelectorAll('button').forEach((item) => {
            item.disabled = true;
          });
          if (runQuickReplyAction(action)) return;
          sendMessage(label, {
            hiddenUserMessage: true,
            context: { quickReply: true },
          });
        });
        wrap.append(button);
      });

      if (wrap.children.length) {
        messageItem.append(wrap);
        scrollMessages();
      }
    };

    const renderStreamingPriceWidget = (messageItem, widget) => {
      if (!messageItem || widget?.type !== 'streaming_prices' || !Array.isArray(widget.services)) return;

      const serviceLogos = {
        netflix: 'images/streaming/netflix.svg',
        hbo: 'images/streaming/hbo-max.svg',
        disney: 'images/streaming/disney-plus.svg',
      };

      const formElement = document.createElement('form');
      formElement.className = 'dealett-chat-streaming-widget';
      formElement.setAttribute('data-chat-streaming-widget', '');
      formElement.noValidate = true;

      const serviceList = document.createElement('div');
      serviceList.className = 'dealett-chat-streaming-services';
      const widgetInstanceId = `dealett-streaming-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

      widget.services.forEach((service, serviceIndex) => {
        const serviceId = String(service?.id || '').trim();
        const serviceLabel = String(service?.label || '').trim();
        if (!serviceId || !serviceLabel) return;

        const row = document.createElement('div');
        row.className = 'dealett-chat-streaming-service';
        row.dataset.streamingService = serviceId;
        row.dataset.streamingLabel = serviceLabel;

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'dealett-chat-streaming-toggle';
        toggleButton.setAttribute('aria-pressed', 'false');
        toggleButton.setAttribute('aria-label', serviceLabel);
        const serviceLogo = document.createElement('img');
        serviceLogo.className = 'dealett-chat-streaming-logo';
        serviceLogo.src = serviceLogos[serviceId] || '';
        serviceLogo.alt = '';
        serviceLogo.setAttribute('aria-hidden', 'true');
        const selectedIcon = document.createElement('i');
        selectedIcon.className = 'fa-solid fa-check';
        selectedIcon.setAttribute('aria-hidden', 'true');
        toggleButton.append(serviceLogo, selectedIcon);

        const pricePanel = document.createElement('div');
        pricePanel.className = 'dealett-chat-streaming-price-panel';
        const priceLabel = document.createElement('label');
        priceLabel.className = 'dealett-chat-streaming-price-label';
        const priceInput = document.createElement('input');
        priceInput.className = 'dealett-chat-streaming-price-input';
        priceInput.type = 'number';
        priceInput.inputMode = 'numeric';
        priceInput.min = '1';
        priceInput.max = '2000';
        priceInput.step = '1';
        priceInput.disabled = true;
        priceInput.placeholder = String(service.pricePlaceholder || 'kr/mån');
        priceInput.setAttribute('aria-label', `${serviceLabel}, ${service.priceLabel}`);
        const priceOptions = Array.isArray(service.priceOptions)
          ? service.priceOptions
            .map((option) => ({
              label: String(option?.label || '').trim(),
              amount: Number(option?.amount),
            }))
            .filter((option) => option.label && Number.isInteger(option.amount) && option.amount > 0)
          : [];
        if (priceOptions.length) {
          const listId = `${widgetInstanceId}-${serviceIndex}`;
          const dataList = document.createElement('datalist');
          dataList.id = listId;
          priceOptions.forEach((option) => {
            const priceOption = document.createElement('option');
            priceOption.value = String(option.amount);
            priceOption.label = `${option.label} ${option.amount} kr`;
            priceOption.textContent = `${option.label} ${option.amount} kr`;
            dataList.append(priceOption);
          });
          priceInput.setAttribute('list', listId);
          priceLabel.append(dataList);
        }
        priceLabel.append(priceInput);
        pricePanel.append(priceLabel);

        row.append(toggleButton, pricePanel);
        serviceList.append(row);
      });

      const noneButton = document.createElement('button');
      noneButton.type = 'button';
      noneButton.className = 'dealett-chat-streaming-none';
      noneButton.textContent = String(widget.noneLabel || 'None');
      noneButton.setAttribute('aria-pressed', 'false');

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.className = 'dealett-chat-widget-button dealett-chat-widget-button--primary dealett-chat-streaming-submit';
      submitButton.textContent = String(widget.submitLabel || text.send);
      submitButton.disabled = true;

      const selectedRows = () => [...serviceList.querySelectorAll('.dealett-chat-streaming-service.is-selected')];
      const readPrice = (row) => {
        const input = row.querySelector('.dealett-chat-streaming-price-input');
        const amount = Number(input?.value);
        return input?.value.trim() && Number.isInteger(amount) && amount >= 1 && amount <= 2000
          ? Math.round(amount)
          : null;
      };
      const clearPriceError = (row) => {
        const input = row.querySelector('.dealett-chat-streaming-price-input');
        row.classList.remove('has-error', 'is-shaking');
        input?.setAttribute('aria-invalid', 'false');
      };
      const showPriceError = (row) => {
        const input = row.querySelector('.dealett-chat-streaming-price-input');
        row.classList.remove('is-shaking');
        void row.offsetWidth;
        row.classList.add('has-error', 'is-shaking');
        input?.setAttribute('aria-invalid', 'true');
      };
      const updateSubmitState = () => {
        submitButton.disabled = !noneButton.classList.contains('is-selected') && !selectedRows().length;
      };
      const setServiceSelected = (row, selected) => {
        const button = row.querySelector('.dealett-chat-streaming-toggle');
        const priceInput = row.querySelector('.dealett-chat-streaming-price-input');
        row.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
        priceInput.disabled = !selected;
        if (!selected) clearPriceError(row);
      };

      serviceList.querySelectorAll('.dealett-chat-streaming-price-input').forEach((priceInput) => {
        priceInput.addEventListener('input', () => {
          const row = priceInput.closest('.dealett-chat-streaming-service');
          if (readPrice(row)) clearPriceError(row);
        });
      });

      serviceList.addEventListener('click', (event) => {
        const button = event.target.closest('.dealett-chat-streaming-toggle');
        if (!button || button.disabled) return;
        const row = button.closest('.dealett-chat-streaming-service');
        const willSelect = !row.classList.contains('is-selected');
        noneButton.classList.remove('is-selected');
        noneButton.setAttribute('aria-pressed', 'false');
        setServiceSelected(row, willSelect);
        updateSubmitState();
        if (willSelect) row.querySelector('.dealett-chat-streaming-price-input')?.focus();
        scrollMessages();
      });

      noneButton.addEventListener('click', () => {
        const willSelect = !noneButton.classList.contains('is-selected');
        noneButton.classList.toggle('is-selected', willSelect);
        noneButton.setAttribute('aria-pressed', String(willSelect));
        selectedRows().forEach((row) => setServiceSelected(row, false));
        updateSubmitState();
        scrollMessages();
        window.setTimeout(scrollMessages, 240);
      });

      formElement.append(serviceList, noneButton, submitButton);
      formElement.addEventListener('submit', (event) => {
        event.preventDefault();
        if (submitButton.disabled) return;

        const noStreaming = noneButton.classList.contains('is-selected');
        const selected = noStreaming ? [] : selectedRows();
        const invalidRows = selected.filter((row) => !readPrice(row));
        if (invalidRows.length) {
          invalidRows.forEach(showPriceError);
          invalidRows[0].querySelector('.dealett-chat-streaming-price-input')?.focus();
          scrollMessages();
          return;
        }

        const streamingServices = selected.map((row) => row.dataset.streamingService);
        const streamingMonthlyCosts = Object.fromEntries(selected.map((row) => [
          row.dataset.streamingService,
          readPrice(row),
        ]));
        const monthlyPriceSuffix = chatLanguage.startsWith('sv') ? 'kr/mån' : 'SEK/month';
        const summary = noStreaming
          ? text.streamingNone
          : selected.map((row) => {
            const label = row.dataset.streamingLabel || row.dataset.streamingService;
            const amount = streamingMonthlyCosts[row.dataset.streamingService];
            return `${label}: ${amount} ${monthlyPriceSuffix}`;
          }).join(', ');

        formElement.classList.add('is-submitted');
        formElement.querySelectorAll('button, input').forEach((control) => {
          control.disabled = true;
        });
        sendMessage(summary, {
          context: {
            source: 'streaming_price_widget',
            qualificationPatch: {
              streamingCalculation: noStreaming ? 'none' : 'include',
              streamingServices,
              streamingMonthlyCosts,
            },
          },
        });
      });

      messageItem.append(formElement);
      scrollMessages();
    };

    const renderOperatorBindingWidget = (messageItem, widget) => {
      if (!messageItem || widget?.type !== 'operator_binding') return;
      const peopleCount = Math.max(1, Math.min(Number(widget.peopleCount) || 1, 10));
      const answers = Array.from({ length: peopleCount }, () => ({
        operator: '',
        bindingChoice: '',
        bindingDate: '',
      }));
      let activeIndex = 0;

      const formElement = document.createElement('form');
      formElement.className = 'dealett-chat-operator-binding-widget';
      formElement.noValidate = true;

      const progress = document.createElement('div');
      progress.className = 'dealett-chat-person-progress';
      progress.style.setProperty('--dealett-person-count', String(Math.min(peopleCount, 5)));
      progress.setAttribute('aria-label', `${widget.personLabel || 'Person'} 1-${peopleCount}`);
      const progressButtons = answers.map((_, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dealett-chat-person-step';
        button.textContent = String(index + 1);
        button.setAttribute('aria-label', `${widget.personLabel || 'Person'} ${index + 1}`);
        button.addEventListener('click', () => {
          if (button.disabled || formElement.classList.contains('is-submitted')) return;
          activeIndex = index;
          renderPerson();
        });
        progress.append(button);
        return button;
      });

      const personTitle = document.createElement('strong');
      personTitle.className = 'dealett-chat-person-title';

      const operatorField = document.createElement('label');
      operatorField.className = 'dealett-chat-person-field';
      const operatorLabel = document.createElement('span');
      operatorLabel.textContent = String(widget.operatorLabel || 'Current operator');
      const operatorSelect = document.createElement('select');
      operatorSelect.className = 'dealett-chat-person-select';
      operatorSelect.append(new Option(String(widget.operatorPlaceholder || 'Choose operator'), ''));
      (widget.operators || []).forEach((operator) => {
        operatorSelect.append(new Option(String(operator), String(operator)));
      });
      operatorField.append(operatorLabel, operatorSelect);

      const bindingField = document.createElement('label');
      bindingField.className = 'dealett-chat-person-field';
      const bindingLabel = document.createElement('span');
      bindingLabel.textContent = String(widget.bindingLabel || 'Binding period');
      const bindingSelect = document.createElement('select');
      bindingSelect.className = 'dealett-chat-person-select';
      bindingSelect.append(new Option(String(widget.bindingPlaceholder || 'Choose binding status'), ''));
      (widget.bindingOptions || []).forEach((option) => {
        bindingSelect.append(new Option(String(option.label), String(option.value)));
      });
      bindingField.append(bindingLabel, bindingSelect);

      const dateField = document.createElement('label');
      dateField.className = 'dealett-chat-person-field dealett-chat-person-date';
      const dateLabel = document.createElement('span');
      dateLabel.textContent = String(widget.dateLabel || 'End date');
      const dateInput = document.createElement('input');
      dateInput.className = 'dealett-chat-person-input';
      dateInput.type = 'date';
      const today = new Date();
      dateInput.min = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');
      dateField.append(dateLabel, dateInput);

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.className = 'dealett-chat-widget-button dealett-chat-widget-button--primary dealett-chat-person-submit';

      const clearFieldError = (field) => {
        field.classList.remove('has-error', 'is-shaking');
        field.querySelector('select, input')?.setAttribute('aria-invalid', 'false');
      };
      const showFieldError = (field) => {
        field.classList.remove('is-shaking');
        void field.offsetWidth;
        field.classList.add('has-error', 'is-shaking');
        const control = field.querySelector('select, input');
        control?.setAttribute('aria-invalid', 'true');
        control?.focus();
      };
      const isComplete = (answer) => Boolean(
        answer.operator && answer.bindingChoice && answer.bindingChoice !== 'lookup' &&
        (answer.bindingChoice !== 'date' || answer.bindingDate)
      );
      const validatePerson = (index) => {
        const answer = answers[index];
        if (!answer.operator) {
          showFieldError(operatorField);
          return false;
        }
        if (!answer.bindingChoice) {
          showFieldError(bindingField);
          return false;
        }
        if (answer.bindingChoice === 'date' && !answer.bindingDate) {
          showFieldError(dateField);
          return false;
        }
        return true;
      };
      const renderPerson = () => {
        const answer = answers[activeIndex];
        personTitle.textContent = `${widget.personLabel || 'Person'} ${activeIndex + 1} ${widget.ofLabel || 'of'} ${peopleCount}`;
        operatorSelect.value = answer.operator;
        bindingSelect.value = answer.bindingChoice;
        dateInput.value = answer.bindingDate;
        dateField.hidden = answer.bindingChoice !== 'date';
        submitButton.textContent = activeIndex === peopleCount - 1
          ? String(widget.submitLabel || text.send)
          : String(widget.nextLabel || widget.submitLabel || text.send);
        progressButtons.forEach((button, index) => {
          const complete = isComplete(answers[index]);
          button.classList.toggle('is-current', index === activeIndex);
          button.classList.toggle('is-complete', complete);
          button.setAttribute('aria-current', index === activeIndex ? 'step' : 'false');
          button.disabled = index > activeIndex && !answers.slice(0, index).every(isComplete);
        });
        [operatorField, bindingField, dateField].forEach(clearFieldError);
        scrollMessages();
      };

      operatorSelect.addEventListener('change', () => {
        answers[activeIndex].operator = operatorSelect.value;
        clearFieldError(operatorField);
        renderPerson();
      });
      bindingSelect.addEventListener('change', () => {
        if (bindingSelect.value === 'lookup') {
          if (!operatorSelect.value) {
            showFieldError(operatorField);
            bindingSelect.value = '';
            return;
          }
          const lookupOperator = operatorSelect.value;
          bindingSelect.value = answers[activeIndex].bindingChoice || '';
          openBindingLookupModal({
            operator: lookupOperator,
            onResolved: (value) => {
              if (value === 'Ingen bindningstid') {
                answers[activeIndex].bindingChoice = 'Ingen bindningstid';
                answers[activeIndex].bindingDate = '';
              } else {
                answers[activeIndex].bindingChoice = 'date';
                answers[activeIndex].bindingDate = value;
              }
              renderPerson();
            },
          });
          return;
        }
        answers[activeIndex].bindingChoice = bindingSelect.value;
        if (bindingSelect.value !== 'date') answers[activeIndex].bindingDate = '';
        clearFieldError(bindingField);
        renderPerson();
        if (bindingSelect.value === 'date') dateInput.focus();
      });
      dateInput.addEventListener('input', () => {
        answers[activeIndex].bindingDate = dateInput.value;
        clearFieldError(dateField);
        renderPerson();
      });

      formElement.append(progress, personTitle, operatorField, bindingField, dateField, submitButton);
      formElement.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!validatePerson(activeIndex)) return;
        if (activeIndex < peopleCount - 1) {
          activeIndex += 1;
          renderPerson();
          operatorSelect.focus();
          return;
        }

        const firstIncomplete = answers.findIndex((answer) => !isComplete(answer));
        if (firstIncomplete >= 0) {
          activeIndex = firstIncomplete;
          renderPerson();
          validatePerson(firstIncomplete);
          return;
        }

        const operators = answers.map((answer) => answer.operator);
        const bindingEnds = answers.map((answer) => (
          answer.bindingChoice === 'date' ? answer.bindingDate : answer.bindingChoice
        ));
        const bindingLabels = Object.fromEntries((widget.bindingOptions || [])
          .map((option) => [String(option.value), String(option.label)]));
        const summary = answers.map((answer, index) => {
          const binding = answer.bindingChoice === 'date'
            ? answer.bindingDate
            : (bindingLabels[answer.bindingChoice] || answer.bindingChoice);
          return `${widget.personLabel || 'Person'} ${index + 1}: ${answer.operator}, ${binding}`;
        }).join('; ');

        formElement.classList.add('is-submitted');
        formElement.querySelectorAll('button, select, input').forEach((control) => {
          control.disabled = true;
        });
        sendMessage(summary, {
          context: {
            source: 'operator_binding_widget',
            qualificationPatch: { operators, bindingEnds },
          },
        });
      });

      messageItem.append(formElement);
      renderPerson();
    };

    const renderBindingLookupWidget = (messageItem, widget) => {
      if (!messageItem || widget?.type !== 'binding_lookup' || !Array.isArray(widget.operators)) return;
      const wrap = document.createElement('div');
      wrap.className = 'dealett-chat-binding-lookup';
      const title = document.createElement('strong');
      title.className = 'dealett-chat-widget-title';
      title.textContent = String(widget.title || 'Hitta bindningstid');
      const description = document.createElement('p');
      description.className = 'dealett-chat-widget-description';
      description.textContent = String(widget.description || '');
      const actions = document.createElement('div');
      actions.className = 'dealett-chat-widget-actions';

      widget.operators.slice(0, 5).forEach((operator) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'dealett-chat-widget-button dealett-chat-widget-button--primary';
        button.textContent = `${widget.openLabel || 'Öppna här'}: ${operator.name}`;
        button.addEventListener('click', () => {
          openBindingLookupModal({
            operator: operator.name,
            operators: widget.operators,
          });
        });
        actions.append(button);
      });

      wrap.append(title, description, actions);
      messageItem.append(wrap);
      scrollMessages();
    };

    const renderEmbeddedWidget = (messageItem, widget) => {
      if (widget?.type === 'streaming_prices') {
        renderStreamingPriceWidget(messageItem, widget);
      } else if (widget?.type === 'operator_binding') {
        renderOperatorBindingWidget(messageItem, widget);
      } else if (widget?.type === 'binding_lookup') {
        renderBindingLookupWidget(messageItem, widget);
      }
    };

    const addMessage = (role, content, options = {}) => {
      const messageRecord = options.messageRecord || createMessageRecord(role, content, options);
      const timestamp = messageRecord.createdAt;
      const item = document.createElement('article');
      item.className = `dealett-chat-message dealett-chat-message--${role}`;
      item.dataset.messageId = messageRecord.messageId;
      item.dataset.messageSequence = String(messageRecord.sequence);
      item._dealettMessageRecord = messageRecord;
      if (messageRecord.greeting) item.classList.add('dealett-chat-message--greeting');
      const isUser = role === 'user';
      const contentAttributes = [
        isUser ? 'data-no-translate' : '',
        messageRecord.contentLanguage ? `lang="${escapeChatText(messageRecord.contentLanguage)}" data-translation-complete` : '',
      ].filter(Boolean).join(' ');
      const contentMarkup = Array.isArray(options.paragraphs)
        ? options.paragraphs.map((paragraph, index) => (
          `  <p class="${index === 0 ? 'dealett-chat-greeting__lead' : 'dealett-chat-greeting__body'}"${contentAttributes ? ` ${contentAttributes}` : ''}>${escapeChatText(paragraph)}</p>`
        )).join('')
        : `  <p${contentAttributes ? ` ${contentAttributes}` : ''}>${escapeChatText(content)}</p>`;
      item.innerHTML = [
        '<div class="dealett-chat-bubble">',
        contentMarkup,
        `  <time class="dealett-chat-time">${escapeChatText(getChatTimeLabel(timestamp))}</time>`,
        isUser ? '  <span class="dealett-chat-check" aria-hidden="true"></span>' : '',
        '</div>',
        isUser ? '<span class="dealett-chat-avatar dealett-chat-avatar--user" aria-hidden="true"></span>' : '',
      ].join('');
      if (options.before instanceof Node && options.before.parentNode === messageList) {
        messageList.insertBefore(item, options.before);
      } else {
        messageList.append(item);
      }
      if (options.persist !== false) {
        appendRecoveryMessage(messageRecord);
        persistConversation();
      }
      scrollMessages();
      return item;
    };

    const renderConversationGreeting = () => {
      const greetingParagraphs = text.welcomeMessages || copy.sv.welcomeMessages;
      const greetingText = greetingParagraphs.join('\n\n');
      lastAssistantResponse = {
        reply: greetingText,
        source: 'conversation-greeting',
        interactionStage: 'greeting',
      };
      const assistantItem = addMessage('assistant', greetingText, {
        contentLanguage: chatLanguage,
        greeting: true,
        paragraphs: greetingParagraphs,
      });
      positionCompletedTurn(assistantItem);
      return assistantItem;
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
      return provider ? `images/${provider}.${provider === 'telenor' ? 'svg' : ['telia', 'tele2'].includes(provider) ? 'webp' : 'jpg'}` : '';
    };

    const addCalculatedOfferToCart = async (planId, options = {}) => {
      const { announce = true, openDrawer = true } = options;
      const response = await window.DealettNetwork.fetchJson('/api/offers/cart-item', {
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
      }
      return response;
    };

    const buildAssistantStructuredContent = (response) => ({
      embeddedWidget: response?.embeddedWidget || null,
      quickReplies: Array.isArray(response?.quickReplies) ? response.quickReplies : [],
      offerCards: Array.isArray(response?.offerCards) ? response.offerCards : [],
      offerCalculation: response?.offerCalculation || null,
      qualification: response?.qualification || null,
      flowState: response?.flowState || null,
      relatedAction: response?.relatedAction || null,
      quizAnswersStatus: response?.quizAnswersStatus || null,
    });

    const buildAssistantMetadata = (response) => ({
      source: response?.source || null,
      intent: response?.intent || null,
      interactionStage: response?.interactionStage || null,
      conversationStyle: response?.conversationStyle || null,
      model: response?.messageMetadata?.model || response?.model || response?.modelVersion || null,
      simulated: response?.simulated === true,
      simulationMode: response?.simulationMode || null,
      responseId: response?.responseId || response?.id || null,
      serverMessageId: response?.messageMetadata?.id || response?.message?.messageId || response?.message?.id || response?.messageId || null,
      serverSequence: response?.messageMetadata?.sequence || response?.message?.sequence || response?.sequence || null,
    });

    const markAssistantItemAsSimulated = (assistantItem) => {
      if (!assistantItem) return;
      assistantItem.classList.add('dealett-chat-message--simulated');
      assistantItem.dataset.simulated = 'true';
      const bubble = assistantItem.querySelector('.dealett-chat-bubble');
      if (!bubble || bubble.querySelector('.dealett-chat-simulation-label')) return;
      const label = document.createElement('span');
      label.className = 'dealett-chat-simulation-label';
      label.textContent = text.demoLabel;
      bubble.prepend(label);
    };

    const renderAssistantResponse = (response) => {
      const assistantText = typeof response?.reply === 'string' ? response.reply.trim() : '';
      const isOpenAiResponse = response?.source === 'openai' && response?.simulated !== true;
      const isExplicitDemoResponse = response?.source === 'demo-simulated' && response?.simulated === true;
      if ((!isOpenAiResponse && !isExplicitDemoResponse) || !assistantText) {
        throw new Error('Chat response source was not accepted');
      }
      lastResponseWasSimulated = isExplicitDemoResponse;
      hideTypingIndicator();
      lastAssistantResponse = {
        ...response,
        reply: assistantText,
      };
      const assistantItem = addMessage('assistant', assistantText, {
        messageId: response?.messageMetadata?.id || response?.message?.messageId || response?.message?.id || response?.messageId || undefined,
        sequence: response?.messageMetadata?.sequence || undefined,
        createdAt: response?.messageMetadata?.createdAt || response?.message?.createdAt || response?.createdAt || undefined,
        contentLanguage: chatLanguage,
        before: pendingMessages[0]?.item,
        structuredContent: buildAssistantStructuredContent(response),
        metadata: buildAssistantMetadata(response),
      });
      if (isExplicitDemoResponse) markAssistantItemAsSimulated(assistantItem);
      renderEmbeddedWidget(assistantItem, response.embeddedWidget);
      renderQuickReplies(assistantItem, response.quickReplies);
      const offerIds = Array.isArray(response.offerCards)
        ? response.offerCards.map((card) => String(card.planId || card.id || '')).filter(Boolean)
        : [];
      if (offerIds.some((offerId) => !renderedOfferIds.has(offerId))) {
        renderChatOfferCards(assistantItem, response.offerCards);
        offerIds.forEach((offerId) => renderedOfferIds.add(offerId));
      }
      writeQualification(response.qualification);
      writeOfferCalculation(response.offerCalculation);
      writeQuestionFlowState(response.flowState);
      if (response.quizAnswersStatus === 'confirmed' && !activeQuizContext?.quizHandoff) {
        const historicalContext = getQuizContext() || {};
        activeQuizContext = {
          ...historicalContext,
          quizHandoff: true,
          quizAnswersStatus: 'confirmed',
          qualification: response.qualification,
        };
      } else if (response.quizAnswersStatus === 'ignored') {
        activeQuizContext = null;
        ignoreQuizContext = true;
      }
      positionCompletedTurn(assistantItem);
      return assistantItem;
    };

    const continuePendingMessage = () => {
      const nextMessage = pendingMessages.shift();
      if (!nextMessage) {
        focusChatInput();
        return;
      }
      const messageRecord = createMessageRecord('user', nextMessage.message, nextMessage.messageRecord);
      if (nextMessage.item) {
        nextMessage.item.dataset.messageSequence = String(messageRecord.sequence);
        nextMessage.item._dealettMessageRecord = messageRecord;
      }
      appendRecoveryMessage(messageRecord);
      persistConversation();
      void processMessage(nextMessage.message, {
        ...nextMessage.options,
        messageRecord,
      });
    };

    const loadInitialGreeting = () => {
      if (messages.length || isSending) return;

      suggestionArea.replaceChildren();
      renderConversationGreeting();
      continuePendingMessage();
    };

    const renderChatOfferCards = (messageItem, offerCards) => {
      if (!messageItem || !Array.isArray(offerCards) || !offerCards.length) return;

      const wrap = document.createElement('div');
      wrap.className = 'dealett-chat-offers';
      offerCards.slice(0, 3).forEach((card, index) => {
        const normalizeDataBenefit = value => String(value || '')
          .trim()
          .toLocaleLowerCase('sv')
          .replace(/\s+(surf|data)$/, '');
        const dataLabel = normalizeDataBenefit(card.dataLabel);
        const benefits = (Array.isArray(card.benefits) ? card.benefits : [])
          .map(benefit => String(benefit || '').trim())
          .filter(benefit => benefit && normalizeDataBenefit(benefit) !== dataLabel);
        const roamingBenefitIndex = benefits.findIndex(benefit => /^Data och lokala samtal utanför EU$/i.test(benefit));
        const countryBenefitIndex = benefits.findIndex(benefit => /^Gäller i upp till\s+(\d+)\s+länder$/i.test(benefit));
        if (roamingBenefitIndex !== -1 && countryBenefitIndex !== -1) {
          const countryCount = benefits[countryBenefitIndex].match(/\d+/)?.[0];
          benefits[roamingBenefitIndex] = `Data och lokala samtal utanför EU i ${countryCount} länder`;
          benefits.splice(countryBenefitIndex, 1);
        }
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
          logo ? [
            '  <div class="offer-card__head">',
            `    <img src="${escapeChatText(logo)}" alt="${escapeChatText(card.operator)}" class="offer-card__logo ${providerClass ? `offer-card__logo--${providerClass}` : ''}" />`,
            `    <span class="offer-card__gift-badge"><span>${escapeChatText(card.rewardLabel)}</span></span>`,
            '  </div>',
          ].join('') : '',
          '  <div class="offer-card__stats">',
          card.bindingLabel ? `    <div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-file-signature"></i></span><div><p class="offer-card__stat-label">${escapeChatText(card.bindingTitle)}</p><p class="offer-card__stat-value">${escapeChatText(card.bindingLabel)}</p></div></div>` : '',
          card.dataLabel ? `    <div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-wifi"></i></span><div><p class="offer-card__stat-label">${escapeChatText(card.dataTitle)}</p><p class="offer-card__stat-value">${escapeChatText(card.dataLabel)}</p></div></div>` : '',
          card.monthlyPriceLabel ? `    <div class="offer-card__stat"><span class="offer-card__stat-icon"><i class="fa-solid fa-tag"></i></span><div><p class="offer-card__stat-label">${escapeChatText(card.monthlyPriceTitle)}</p><p class="offer-card__stat-value">${escapeChatText(card.monthlyPriceLabel)}</p>${card.monthlyPriceSubLabel ? `<p class="offer-card__stat-sub">${escapeChatText(card.monthlyPriceSubLabel)}</p>` : ''}</div></div>` : '',
          '  </div>',
          card.recommendationType === 'example_offer' ? `  <p class="offer-card__reason">${escapeChatText(card.resultLabel)}</p>` : '',
          card.strictMatch === false && card.reason ? `  <p class="offer-card__reason">${escapeChatText(card.reason)}</p>` : '',
          benefits.length ? `  <ul class="dealett-chat-offer-benefits">${benefits.map(benefit => `<li>${escapeChatText(benefit)}</li>`).join('')}</ul>` : '',
          safeCtaUrl || card.planId ? `  <button class="offer-card__cta dealett-chat-offer-cta" type="button" data-chat-offer-card="${escapeChatText(card.id)}" data-chat-offer-plan="${escapeChatText(card.planId || '')}" data-chat-offer-url="${escapeChatText(safeCtaUrl)}">${escapeChatText(card.ctaLabel)} <i class="fa-solid fa-cart-shopping"></i></button>` : '',
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
          button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
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

        button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        addCalculatedOfferToCart(planId, {
          announce: !ctaUrl,
          openDrawer: !ctaUrl,
        }).then(() => {
          if (ctaUrl) {
            window.location.href = ctaUrl;
            return;
          }
          button.innerHTML = '<i class="fa-solid fa-check"></i>';
        }).catch(() => {
          button.disabled = false;
          button.innerHTML = previousLabel;
          status.textContent = text.error;
        });
      });

      messageItem.append(wrap);
      scrollMessages();
    };

    const hydrateStoredConversation = () => {
      let latestAssistantItem = null;
      messages.forEach((messageRecord) => {
        const structured = messageRecord.structuredContent || {};
        if (messageRecord.hidden) return;
        const item = addMessage(messageRecord.role, messageRecord.content, {
          messageRecord,
          persist: false,
          contentLanguage: messageRecord.contentLanguage,
          greeting: messageRecord.greeting,
          paragraphs: messageRecord.greeting ? messageRecord.content.split(/\n\n+/) : undefined,
        });
        if (messageRecord.role !== 'assistant') return;

        latestAssistantItem = item;
        lastAssistantResponse = {
          reply: messageRecord.content,
          ...(messageRecord.metadata || {}),
          ...structured,
        };
        const isSimulated = messageRecord.metadata?.source === 'demo-simulated' &&
          messageRecord.metadata?.simulated === true;
        if (isSimulated) markAssistantItemAsSimulated(item);
        lastResponseWasSimulated = isSimulated;
        renderEmbeddedWidget(item, structured.embeddedWidget);
        renderQuickReplies(item, structured.quickReplies);
        const offerIds = Array.isArray(structured.offerCards)
          ? structured.offerCards.map((card) => String(card.planId || card.id || '')).filter(Boolean)
          : [];
        if (offerIds.some((offerId) => !renderedOfferIds.has(offerId))) {
          renderChatOfferCards(item, structured.offerCards);
          offerIds.forEach((offerId) => renderedOfferIds.add(offerId));
        }
      });
      if (latestAssistantItem) lastCompletedAssistantItem = latestAssistantItem;
      status.textContent = lastResponseWasSimulated ? text.demoStatus : text.status;
      persistConversation();
    };

    const setSending = (nextValue) => {
      isSending = nextValue;
      if (nextValue) showTypingIndicator();
      else hideTypingIndicator();
      status.textContent = nextValue
        ? (pendingMessages.length ? text.queued : text.typing)
        : (lastResponseWasSimulated ? text.demoStatus : text.status);
      syncInlineState();
    };

    const saveRuntime = () => {
      const state = {
        messages, messageList, isSending, activeChatRequest, failedTurn, typingIndicator,
        lastCompletedAssistantItem, lastAssistantResponse, lastResponseWasSimulated,
        renderedOfferIds, offerClickedInSession, hasUserStartedChat, activeQuizContext,
        ignoreQuizContext, pendingMessages, storedConversation, conversationPresentation,
        chatSessionId, conversationToken, droppedMessageCount, nextMessageSequence,
      };
      const previous = runtimes.get(chatSessionId);
      state.scrollTop = backgroundUpdate ? (previous?.scrollTop || 0) : messageList.scrollTop;
      state.draft = backgroundUpdate ? (previous?.draft || '') : (heroForm && root.classList.contains('dealett-chat--inline') ? heroInput.value : input.value);
      runtimes.set(chatSessionId, state);
      return state;
    };
    const loadRuntime = state => {
      ({
        messages, messageList, isSending, activeChatRequest, failedTurn, typingIndicator,
        lastCompletedAssistantItem, lastAssistantResponse, lastResponseWasSimulated,
        renderedOfferIds, offerClickedInSession, hasUserStartedChat, activeQuizContext,
        ignoreQuizContext, pendingMessages, storedConversation, conversationPresentation,
        chatSessionId, conversationToken, droppedMessageCount, nextMessageSequence,
      } = state);
      completedTurnPositionToken += 1;
    };
    const inConversation = (id, callback) => {
      if (!conversations.has(id)) return;
      if (id === chatSessionId) { callback(); renderConversationList(); return; }
      const target = runtimes.get(id);
      if (!target || !conversations.has(id)) return;
      const visible = saveRuntime();
      backgroundUpdate = true;
      loadRuntime(target);
      try { callback(); }
      finally {
        saveRuntime();
        const entry = conversations.get(id);
        if (entry) entry.unread = true;
        loadRuntime(visible);
        backgroundUpdate = false;
        status.textContent = isSending ? text.typing : failedTurn ? text.error : lastResponseWasSimulated ? text.demoStatus : text.status;
        syncInlineState();
        persistConversationList();
      }
    };

    const processMessage = async (message, options = {}) => {
      const requestConversationId = chatSessionId;
      const requestController = new AbortController();
      activeChatRequest = requestController;
      const requestContext = {
        ...(getQuizContext() || {}),
        ...(options.context || {}),
      };

      setSending(true);
      let requestFailed = false;
      let streamingItem = null;
      let streamedText = '';
      const showDelta = delta => inConversation(requestConversationId, () => {
        if (requestController.signal.aborted) return;
        hideTypingIndicator();
        if (!streamingItem) {
          streamingItem = document.createElement('article');
          streamingItem.className = 'dealett-chat-message dealett-chat-message--assistant';
          streamingItem.dataset.streaming = 'true';
          streamingItem.setAttribute('aria-busy', 'true');
          streamingItem.innerHTML = '<div class="dealett-chat-bubble"><p data-no-translate></p></div>';
          messageList.append(streamingItem);
        }
        streamedText += delta;
        streamingItem.querySelector('p').textContent = streamedText;
        scrollMessages();
      });
      const clientRecord = options.messageRecord || null;
      if (clientRecord) {
        clientRecord.delivery = 'pending';
        persistConversation();
      }
      const priorMessages = (clientRecord
        ? messages.filter((item) => item.messageId !== clientRecord.messageId)
        : messages
      ).slice(-10).map((item) => ({
        id: item.messageId,
        messageId: item.messageId,
        sequence: item.sequence,
        role: item.role,
        content: item.content,
        createdAt: item.createdAt,
        timestamp: item.createdAt,
        language: item.language,
      }));

      try {
        const response = await window.DealettNetwork.fetchChat('/api/chat', {
          onDelta: showDelta,
          label: 'Dealett assistant',
          method: 'POST',
          timeoutMs: 60000,
          signal: requestController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: chatSessionId,
            conversationToken,
            sessionId: chatSessionId,
            message,
            language: chatLanguage,
            clientMessage: clientRecord ? {
              id: clientRecord.messageId,
              sequence: clientRecord.sequence,
              createdAt: clientRecord.createdAt,
              language: clientRecord.language || chatLanguage,
            } : null,
            messages: priorMessages,
            qualification: readQualification(),
            flowState: readQuestionFlowState(),
            cart: readCartContext(),
            page: {
              title: document.title,
              path: window.location.pathname.split('/').pop() || 'index.html',
            },
            context: requestContext,
          }),
        });

        inConversation(requestConversationId, () => {
          if (typeof response?.conversationToken === 'string' && response.conversationToken) {
            conversationToken = response.conversationToken;
            persistConversation();
          }
          streamingItem?.remove();
          streamingItem = null;
          renderAssistantResponse(response);
          if (clientRecord) clientRecord.delivery = 'sent';
          failedTurn = null;
          persistConversation();
        });
      } catch {
        requestFailed = true;
      } finally {
        inConversation(requestConversationId, () => {
          streamingItem?.remove();
          streamingItem = null;
          activeChatRequest = null;
          if (requestFailed && clientRecord) {
            clientRecord.delivery = 'failed';
            failedTurn = { message, options };
            persistConversation();
          }
          setSending(false);
          if (requestFailed) {
            status.textContent = text.error;
          }
          continuePendingMessage();
        });
      }
    };

    const resetChatConversation = ({ greet = true } = {}) => {
      saveRuntime();
      if (!messages.some(message => message.role === 'user') && !isSending) {
        conversations.delete(chatSessionId);
        runtimes.delete(chatSessionId);
      }
      messageList = document.createElement('div');
      messageList.className = 'dealett-chat-messages';
      messageList.setAttribute('role', 'log');
      messageList.setAttribute('aria-live', 'polite');
      panel.querySelector('.dealett-chat-messages').replaceWith(messageList);
      activeChatRequest = null;
      failedTurn = null;
      typingIndicator = null;
      hideTypingIndicator();
      isSending = false;
      clearStoredConversation();
      storedConversation = null;
      chatSessionId = persistChatSessionId(createStableChatId());
      conversationToken = null;
      droppedMessageCount = 0;
      nextMessageSequence = 1;
      lastAssistantResponse = null;
      lastCompletedAssistantItem = null;
      completedTurnPositionToken += 1;
      conversationPresentation = null;
      lastResponseWasSimulated = false;
      renderedOfferIds = new Set();
      offerClickedInSession = false;
      hasUserStartedChat = false;
      activeQuizContext = null;
      ignoreQuizContext = true;
      pendingMessages = [];
      messages = [];
      messageList.replaceChildren();
      messageList.append(inlineControls);
      suggestionArea.replaceChildren();
      input.value = '';
      if (heroInput) heroInput.value = '';
      if (greet) loadInitialGreeting();
      persistConversation();
      syncInlineState();
    };

    const sendMessage = (rawMessage, options = {}) => {
      const message = String(rawMessage || '').trim();
      if (!message && !options.silent) return false;
      if (root.classList.contains('dealett-chat--inline') && (isSending || failedTurn)) return false;

      if (isConversationExpired()) {
        resetChatConversation({ greet: false });
      }

      const entry = conversations.get(chatSessionId);
      if (entry) entry.startingView = false;
      hasUserStartedChat = true;
      suggestionArea.replaceChildren();
      input.value = '';

      if (isSending) {
        const messageRecord = createPendingMessageRecord('user', message, {
          language: chatLanguage,
          hidden: options.silent || options.hiddenUserMessage,
          structuredContent: options.context ? { context: options.context } : null,
        });
        const item = options.silent || options.hiddenUserMessage
          ? null
          : addMessage('user', message, { persist: false, messageRecord });
        pendingMessages.push({ message, options, item, messageRecord });
        status.textContent = text.queued;
        focusChatInput();
        return;
      }

      let messageRecord = null;
      if (options.hiddenUserMessage || options.silent) {
        messageRecord = createMessageRecord('user', message, {
          language: chatLanguage,
          hidden: true,
          structuredContent: options.context ? { context: options.context } : null,
        });
        appendRecoveryMessage(messageRecord);
        persistConversation();
      } else if (!options.silent) {
        const item = addMessage('user', message, {
          language: chatLanguage,
          structuredContent: options.context ? { context: options.context } : null,
        });
        messageRecord = item._dealettMessageRecord;
      }
      void processMessage(message, { ...options, messageRecord });
      return true;
    };

    const openPanel = (options = {}) => {
      if (isConversationExpired()) {
        resetChatConversation({ greet: false });
      }
      syncLanguage();
      markAutoOpenHandled();
      panel.hidden = false;
      root.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      setHistoryOpen(historyOpen);
      if (!messages.length && !options.skipGreeting) {
        loadInitialGreeting();
      }
      window.requestAnimationFrame(() => {
        if (isSending) scrollMessages();
        else if (lastCompletedAssistantItem?.isConnected) {
          positionCompletedTurn(lastCompletedAssistantItem, { smooth: false });
        }
      });
      window.setTimeout(focusChatInput, 50);
    };

    const closePanel = () => {
      setHistoryOpen(false);
      panel.hidden = true;
      root.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (root.classList.contains('dealett-chat--inline')) {
        const guide = root.closest('.hero-ai-guide');
        root.classList.remove('dealett-chat--inline');
        panel.setAttribute('role', 'dialog');
        guide?.classList.remove('has-inline-chat');
        document.body.append(root);
        guide?.querySelector('[data-home-ai-form] textarea')?.focus();
        return;
      }
      toggle.focus();
    };

    const navigation = document.createElement('div');
    navigation.className = 'dealett-chat-navigation';
    const chatsButton = document.createElement('button');
    chatsButton.type = 'button';
    chatsButton.setAttribute('aria-controls', 'dealett-chat-history');
    const createButton = document.createElement('button');
    createButton.type = 'button';
    const tabs = document.createElement('div');
    tabs.className = 'dealett-chat-tabs';
    tabs.setAttribute('role', 'tablist');
    const revealActiveTab = () => {
      const active = tabs.querySelector('.is-active');
      if (!active) return;
      const bounds = tabs.getBoundingClientRect();
      const tabBounds = active.getBoundingClientRect();
      if (tabBounds.right > bounds.right) tabs.scrollLeft += tabBounds.right - bounds.right;
      else if (tabBounds.left < bounds.left) tabs.scrollLeft += tabBounds.left - bounds.left;
    };
    const restartButton = document.createElement('button');
    restartButton.type = 'button';
    restartButton.className = 'dealett-chat-restart';
    restartButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 8a8 8 0 1 0 1 6"/><path d="M19 3v5h-5"/></svg>';
    navigation.append(tabs, createButton, restartButton, chatsButton);
    panel.insertBefore(navigation, messageList);
    const history = document.createElement('nav');
    history.id = 'dealett-chat-history';
    history.className = 'dealett-chat-history';
    panel.append(history);
    let historyOpen = false;
    let showArchived = false;
    const setHistoryOpen = value => {
      historyOpen = value;
      panel.append(history);
      history.hidden = !value || panel.hidden;
      chatsButton.setAttribute('aria-expanded', String(value));
    };
    const recoverFailedTurn = () => {
      const lastUser = [...messages].reverse().find(message => message.role === 'user');
      if (['pending', 'failed'].includes(lastUser?.delivery)) {
        lastUser.delivery = 'failed';
        failedTurn = { message: lastUser.content, options: { messageRecord: lastUser, context: lastUser.structuredContent?.context || {} } };
      }
    };
    const selectConversation = id => {
      const showLatest = !runtimes.has(id) || conversations.get(id)?.unread;
      if (id !== chatSessionId) {
        saveRuntime();
        const previousList = messageList;
        if (runtimes.has(id)) {
          loadRuntime(runtimes.get(id));
        } else {
          const entry = conversations.get(id);
          if (!entry) return;
          resetChatConversation({ greet: false });
          conversations.delete(chatSessionId);
          storedConversation = entry;
          chatSessionId = id;
          conversationToken = entry.conversationToken || null;
          conversationPresentation = entry.presentation;
          droppedMessageCount = entry.droppedMessageCount || 0;
          messages = entry.messages.map((message, index) => normalizeStoredMessage(message, index + 1)).filter(Boolean);
          nextMessageSequence = messages.reduce((highest, message) => Math.max(highest, message.sequence + 1), 1);
          hydrateStoredConversation();
          recoverFailedTurn();
        }
        if (previousList.isConnected) previousList.replaceWith(messageList);
        messageList.scrollTop = runtimes.get(id)?.scrollTop || 0;
        messageList.append(inlineControls);
        input.value = runtimes.get(id)?.draft || '';
        if (heroInput) heroInput.value = runtimes.get(id)?.draft || '';
      }
      const entry = conversations.get(id);
      if (entry) entry.archived = false;
      if (root.classList.contains('dealett-chat--inline')) conversationPresentation = 'homepage';
      if (entry) entry.unread = false;
      persistConversation();
      syncInlineState();
      setHistoryOpen(false);
      if (showLatest && lastCompletedAssistantItem) positionCompletedTurn(lastCompletedAssistantItem, { smooth: false });
      revealActiveTab();
      focusChatInput();
    };
    const startConversation = () => {
      showArchived = false;
      resetChatConversation({ greet: false });
      conversationPresentation = heroForm ? 'homepage' : null;
      if (heroForm) mountInlineChat();
      openPanel({ skipGreeting: true });
      setHistoryOpen(false);
      persistConversation();
    };
    const closeConversationTab = id => {
      const entry = conversations.get(id);
      if (!entry) return;
      if (document.querySelector('.home-intro') && root.classList.contains('dealett-chat--inline') && !entry.messages.some(message => message.role === 'user')) {
        if (id === chatSessionId) {
          entry.startingView = true;
          persistConversation();
          syncInlineState();
          focusChatInput();
        } else {
          conversations.delete(id);
          runtimes.delete(id);
          persistConversationList();
        }
        return;
      }
      entry.archived = true;
      if (id === chatSessionId) {
        const open = [...conversations.values()].filter(item => !item.archived && !item.startingView);
        if (open.length) selectConversation(open.at(-1).conversationId);
        else startConversation();
      }
      persistConversationList();
    };
    renderConversationList = () => {
      if (backgroundUpdate) return;
      const english = chatLanguage === 'en';
      const unread = [...conversations.values()].filter(entry => entry.unread).length;
      chatsButton.textContent = unread ? `⌄ ${unread}` : '⌄';
      chatsButton.classList.toggle('has-unread', unread > 0);
      chatsButton.setAttribute('aria-label', `${english ? 'All chats' : 'Alla chattar'}${unread ? ` (${unread})` : ''}`);
      chatsButton.title = english ? 'All chats and archived chats' : 'Alla chattar och arkiverade chattar';
      tabs.setAttribute('aria-label', english ? 'Conversations' : 'Konversationer');
      const focusedTab = tabs.contains(document.activeElement) ? document.activeElement.dataset.tabId : null;
      const tabScroll = tabs.scrollLeft;
      tabs.replaceChildren();
      messageList.id = 'dealett-chat-transcript';
      [...conversations.values()].filter(entry => !entry.archived && !entry.startingView).forEach(entry => {
        const tab = document.createElement('div');
        tab.className = 'dealett-chat-tab';
        const selected = entry.conversationId === chatSessionId;
        tab.classList.toggle('is-active', selected);
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(selected));
        button.setAttribute('aria-controls', 'dealett-chat-transcript');
        button.tabIndex = selected ? 0 : -1;
        button.dataset.tabId = entry.conversationId;
        const title = entry.title || entry.messages.find(message => message.role === 'user' && !message.hidden)?.content.slice(0, 55) || (english ? 'New chat' : 'Ny chatt');
        const pending = selected ? isSending : runtimes.get(entry.conversationId)?.isSending;
        tab.classList.toggle('is-pending', Boolean(pending));
        tab.classList.toggle('is-unread', Boolean(entry.unread));
        button.textContent = title;
        button.title = title;
        button.setAttribute('aria-label', `${title}${pending ? (english ? ' — Replying' : ' — Svarar') : entry.unread ? (english ? ' — New reply' : ' — Nytt svar') : ''}`);
        button.addEventListener('click', () => selectConversation(entry.conversationId));
        button.addEventListener('keydown', event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const open = [...conversations.values()].filter(item => !item.archived && !item.startingView);
          const index = open.findIndex(item => item.conversationId === entry.conversationId);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? open.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + open.length) % open.length;
          selectConversation(open[next].conversationId);
          tabs.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
        });
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'dealett-chat-tab-close';
        close.textContent = '×';
        close.setAttribute('aria-label', `${english ? 'Close tab' : 'Stäng flik'}: ${title}`);
        close.title = english ? 'Close tab (saved in archive)' : 'Stäng flik (sparas i arkivet)';
        close.addEventListener('click', () => closeConversationTab(entry.conversationId));
        tab.append(button, close);
        tabs.append(tab);
      });
      tabs.scrollLeft = tabScroll;
      revealActiveTab();
      if (focusedTab) [...tabs.querySelectorAll('[role="tab"]')].find(button => button.dataset.tabId === focusedTab)?.focus({ preventScroll: true });
      createButton.textContent = english ? '+ New chat' : '+ Ny chatt';
      restartButton.setAttribute('aria-label', english ? 'Restart chat' : 'Starta om chatten');
      restartButton.title = english ? 'Restart chat' : 'Starta om chatten';
      history.setAttribute('aria-label', english ? 'Saved chats' : 'Sparade chattar');
      history.replaceChildren();
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'dealett-chat-history-dismiss';
      dismiss.textContent = english ? 'Close chats' : 'Stäng chattar';
      dismiss.addEventListener('click', () => { setHistoryOpen(false); chatsButton.focus(); });
      history.append(dismiss);
      const hint = document.createElement('p');
      hint.textContent = english ? 'Different topic? Start a new chat. Your chats are saved here during this visit.' : 'Nytt ämne? Starta en ny chatt. Dina chattar sparas här under besöket.';
      if ([...conversations.values()].filter(entry => entry.messages.some(message => message.role === 'user')).length < 2) history.append(hint);
      const archiveToggle = document.createElement('button');
      archiveToggle.type = 'button';
      archiveToggle.textContent = showArchived ? (english ? 'Back to chats' : 'Tillbaka till chattar') : (english ? 'Archived chats' : 'Arkiverade chattar');
      archiveToggle.addEventListener('click', () => { showArchived = !showArchived; renderConversationList(); });
      [...conversations.values()].filter(entry => !entry.startingView && Boolean(entry.archived) === showArchived)
        .sort((a, b) => b.updatedAt - a.updatedAt).forEach(entry => {
          const row = document.createElement('div');
          row.className = 'dealett-chat-history-row';
          const button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('aria-current', String(entry.conversationId === chatSessionId));
          const title = document.createElement('strong');
          title.textContent = entry.title || entry.messages.find(message => message.role === 'user' && !message.hidden)?.content.slice(0, 55) || (english ? 'New chat' : 'Ny chatt');
          const preview = document.createElement('span');
          const runtime = entry.conversationId === chatSessionId ? { isSending, failedTurn } : runtimes.get(entry.conversationId);
          const pending = runtime?.isSending;
          preview.textContent = pending ? (english ? 'Replying…' : 'Svarar…') : runtime?.failedTurn || entry.messages.at(-1)?.delivery === 'failed' || entry.messages.at(-1)?.delivery === 'pending' ? (english ? 'Try again' : 'Försök igen') : entry.messages.filter(message => !message.hidden).at(-1)?.content.slice(0, 70) || (english ? 'Ask your first question' : 'Ställ din första fråga');
          if (pending) row.classList.add('is-pending');
          if (entry.unread) title.textContent = '● ' + title.textContent;
          button.append(title, preview);
          button.addEventListener('click', () => selectConversation(entry.conversationId));
          const menu = document.createElement('details');
          const summary = document.createElement('summary');
          summary.textContent = '⋯';
          summary.setAttribute('aria-label', english ? 'Manage chat' : 'Hantera chatt');
          menu.append(summary);
          const action = (label, callback) => {
            const control = document.createElement('button');
            control.type = 'button';
            control.textContent = label;
            control.addEventListener('click', callback);
            menu.append(control);
          };
          action(english ? 'Rename' : 'Byt namn', () => {
            const value = window.prompt(english ? 'Chat name' : 'Chattnamn', title.textContent);
            if (value?.trim()) { entry.title = value.trim().slice(0, 80); persistConversationList(); }
          });
          action(entry.archived ? (english ? 'Restore' : 'Återställ') : (english ? 'Archive' : 'Arkivera'), () => {
            if (entry.archived) { entry.archived = false; persistConversationList(); }
            else closeConversationTab(entry.conversationId);
          });
          action(english ? 'Delete' : 'Ta bort', () => {
            if (!window.confirm(english ? 'Delete this chat?' : 'Ta bort den här chatten?')) return;
            const id = entry.conversationId;
            if (id === chatSessionId) { activeChatRequest?.abort(); startConversation(); }
            else runtimes.get(id)?.activeChatRequest?.abort();
            conversations.delete(id);
            runtimes.delete(id);
            persistConversationList();
          });
          row.append(button, menu);
          history.append(row);
        });
      history.append(archiveToggle);
      if (heroForm && root.classList.contains('dealett-chat--inline') && document.querySelector('.home-intro') && window.innerWidth > 900) history.prepend(createButton);
      else navigation.insertBefore(createButton, restartButton);
    };
    chatsButton.addEventListener('click', () => setHistoryOpen(!historyOpen));
    createButton.addEventListener('click', () => {
      startConversation();
      tabs.scrollLeft = tabs.scrollWidth;
    });
    restartButton.addEventListener('click', () => {
      const previousId = chatSessionId;
      activeChatRequest?.abort();
      startConversation();
      conversations.delete(previousId);
      runtimes.delete(previousId);
      persistConversationList();
      tabs.scrollLeft = tabs.scrollWidth;
    });
    if (heroForm && document.querySelector('.home-intro')) {
      const identity = document.createElement('div');
      identity.className = 'dealett-chat-identity';
      identity.innerHTML = '<span class="dealett-ai-mark" aria-hidden="true">D<span>.</span></span><div><strong>Dealett AI</strong><span>Din personliga abonnemangsassistent</span></div>';
      navigation.prepend(identity);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'dealett-chat-delete';
      remove.setAttribute('aria-label', 'Ta bort aktuell chatt');
      remove.title = 'Ta bort aktuell chatt';
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v7M14 10v7"/></svg>';
      navigation.insertBefore(remove, restartButton);
      remove.addEventListener('click', () => {
        if (messages.some(message => message.role === 'user') && !window.confirm('Ta bort den här chatten?')) return;
        const previousId = chatSessionId;
        activeChatRequest?.abort();
        startConversation();
        conversations.delete(previousId);
        runtimes.delete(previousId);
        conversations.get(chatSessionId).startingView = true;
        persistConversation();
        syncInlineState();
      });
      const actions = document.createElement('div');
      actions.className = 'dealett-chat-reference-actions';
      actions.innerHTML = '<button type="button" data-chat-prompt="Hjälp mig att hitta rätt mobilabonnemang"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i>Hitta mobilabonnemang<span aria-hidden="true">›</span></button><a href="jamfor-tackning.html"><i class="fa-solid fa-tower-broadcast" aria-hidden="true"></i>Jämför täckning<span aria-hidden="true">›</span></a><button type="button" data-chat-prompt="Hur fungerar presentkort?"><i class="fa-solid fa-gift" aria-hidden="true"></i>Hur fungerar presentkort?<span aria-hidden="true">›</span></button>';
      actions.addEventListener('click', event => {
        if (!event.target.closest('button, a')) return;
        const entry = conversations.get(chatSessionId);
        if (entry) entry.quickActionsDismissed = true;
        persistConversation();
        syncInlineState();
        const prompt = event.target.closest('[data-chat-prompt]');
        if (prompt) window.DealettChat.ask(prompt.dataset.chatPrompt, { source: 'homepage_ai_guide' });
      });
      heroForm.before(actions);
      const disclaimer = document.createElement('p');
      disclaimer.className = 'dealett-chat-disclaimer';
      disclaimer.textContent = 'Dealett AI kan göra fel. Kontrollera alltid viktig information.';
      heroForm.after(disclaimer);
      history.append(createButton);
    }
    setHistoryOpen(historyOpen);
    window.addEventListener('resize', () => { setHistoryOpen(historyOpen); renderConversationList(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && historyOpen) { setHistoryOpen(false); chatsButton.focus(); }
    });

    hydrateStoredConversation();
    recoverFailedTurn();
    if (heroForm && (document.querySelector('.home-intro') || (conversationPresentation === 'homepage' && messages.some(message => message.role === 'user')))) {
      conversationPresentation = 'homepage';
      mountInlineChat();
      persistConversation();
    }
    retryButton.addEventListener('click', () => {
      if (!failedTurn || isSending) return;
      const turn = failedTurn;
      failedTurn = null;
      void processMessage(turn.message, turn.options);
    });

    toggle.addEventListener('click', () => {
      if (panel.hidden) openPanel();
      else closePanel();
    });

    if (!autoOpenHandled && !document.querySelector('[data-home-ai-form]')) {
      window.setTimeout(() => {
        if (!autoOpenHandled && panel.hidden) openPanel();
      }, 2500);
    }

    window.DealettChat = {
      ...(window.DealettChat || {}),
      open: openPanel,
      close: closePanel,
      ask(message, context = {}) {
        const question = String(message || '').trim();
        if (!question) return false;
        if (context.source === 'homepage_ai_guide' || context.source === 'business_ai_guide') {
          if (isSending || failedTurn) return false;
          if (conversationPresentation !== 'homepage' || isConversationExpired()) {
            resetChatConversation({ greet: false });
          }
          conversationPresentation = 'homepage';
          mountInlineChat();
        }
        openPanel({ skipGreeting: true });
        return sendMessage(question, { context });
      },
      getConversationId: () => chatSessionId,
      getConversationReference: () => ({
        conversationId: chatSessionId,
        sessionId: chatSessionId,
        transcriptVersion: 3,
      }),
      getOrderAssociation: () => (
        messages.length || conversationToken
          ? { conversationId: chatSessionId, conversationToken }
          : { conversationId: null, conversationToken: null }
      ),
      getRecoverySnapshot: () => {
        const { conversationToken: _conversationToken, ...recoverySnapshot } = storedConversation || {
          version: 3,
          conversationId: chatSessionId,
          sessionId: chatSessionId,
          messages: [],
          messageCount: 0,
          droppedMessageCount: 0,
          transcriptTruncated: false,
        };
        return JSON.parse(JSON.stringify(recoverySnapshot));
      },
      readQualification,
      writeQualification,
      continueFromQuiz(payload = {}) {
        ignoreQuizContext = false;
        const qualification = payload.qualification || payload.quizQualification || null;
        if (qualification) writeQualification(qualification);
        writeQuestionFlowState({
          ...createEmptyQuestionFlowState(),
          inProgress: true,
        });
        activeQuizContext = {
          ...(payload.context || {}),
          quizHandoff: true,
          quizAnswersStatus: 'confirmed',
          source: 'homepage_mobile_quiz',
          currentStage: payload.currentStage || null,
          currentStep: payload.currentStep ?? null,
          answers: payload.answers || {},
          qualification: qualification || readQualification(),
          missingFields: qualification?.missingFields || [],
        };
        openPanel({ skipGreeting: true });
        sendMessage(payload.message || '', {
          silent: !payload.message,
          context: activeQuizContext,
        });
      },
    };

    closeButton.addEventListener('click', closePanel);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage(input.value);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden && !root.classList.contains('dealett-chat--inline')) {
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
    updateCartCount();
    initAudienceSwitch();
    initDropdowns();
    initCoveragePreview();
    initDealettChat();
    initTranslations();
  };

  const initLuxuryScroll = () => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(any-hover: hover) and (any-pointer: fine)');
    const main = document.querySelector('body > main');
    if (!main) return;

    const initialPageHeight = document.documentElement.scrollHeight;
    document.documentElement.style.setProperty('--dealett-smooth-height', `${initialPageHeight}px`);
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.scrollBehavior = 'auto';
    document.body.classList.add('dealett-smooth-scroll');

    const wrapper = document.createElement('div');
    const content = document.createElement('div');
    wrapper.className = 'dealett-smooth-wrapper';
    content.className = 'dealett-smooth-content';
    wrapper.setAttribute('aria-hidden', 'true');
    main.before(wrapper);
    wrapper.append(content);
    content.append(main);

    const footer = document.querySelector('body > .footer');
    if (footer) content.append(footer);

    const header = document.querySelector('body > .site-header');
    const syncHeaderPlacement = () => {
      if (!header) return;
      const shouldStayFixed = window.getComputedStyle(header).position === 'fixed';
      if (shouldStayFixed && content.contains(header)) wrapper.before(header);
      if (!shouldStayFixed && !content.contains(header)) content.prepend(header);
    };

    syncHeaderPlacement();

    wrapper.removeAttribute('aria-hidden');

    let renderedY = window.scrollY;
    let targetY = renderedY;
    let lastFrameTime = 0;
    let lastInputTime = 0;
    let animationFrame = 0;
    let resizeFrame = 0;

    const getDuration = () => {
      if (reducedMotion.matches) return 0;
      return finePointer.matches ? 1500 : 100;
    };

    const render = (position) => {
      renderedY = position;
      content.style.transform = `translate3d(0, ${(-position).toFixed(3)}px, 0)`;
      document.documentElement.style.setProperty('--dealett-smooth-y', `${position.toFixed(3)}px`);
    };

    const animateScroll = (time) => {
      const duration = getDuration();
      if (!duration || time - lastInputTime >= duration) {
        render(targetY);
        animationFrame = 0;
        return;
      }

      const elapsed = Math.max(0, time - lastFrameTime);
      const decay = Math.exp((-10 * Math.LN2 * elapsed) / duration);
      lastFrameTime = time;
      render(targetY + ((renderedY - targetY) * decay));

      if (Math.abs(targetY - renderedY) > 0.01) {
        animationFrame = window.requestAnimationFrame(animateScroll);
      } else {
        render(targetY);
        animationFrame = 0;
      }
    };

    const moveToNativeScroll = () => {
      targetY = window.scrollY;
      lastInputTime = window.performance.now();

      if (!getDuration()) {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        render(targetY);
        return;
      }

      if (!animationFrame) {
        lastFrameTime = lastInputTime;
        animationFrame = window.requestAnimationFrame(animateScroll);
      }
    };

    const updatePageHeight = () => {
      resizeFrame = 0;
      syncHeaderPlacement();
      document.documentElement.style.setProperty(
        '--dealett-smooth-height',
        `${Math.ceil(content.scrollHeight)}px`
      );
      targetY = Math.min(targetY, Math.max(0, content.scrollHeight - window.innerHeight));
      renderedY = Math.min(renderedY, targetY);
      render(renderedY);
    };

    const requestHeightUpdate = () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(updatePageHeight);
    };

    render(renderedY);
    updatePageHeight();
    window.addEventListener('scroll', moveToNativeScroll, { passive: true });
    window.addEventListener('resize', requestHeightUpdate);
    window.addEventListener('load', requestHeightUpdate, { once: true });
    reducedMotion.addEventListener('change', moveToNativeScroll);
    finePointer.addEventListener('change', moveToNativeScroll);

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(requestHeightUpdate);
      resizeObserver.observe(content);
    }

    document.fonts?.ready.then(requestHeightUpdate);
  };

  window.addEventListener('storage', (event) => {
    if (event.key === 'dealettCart') {
      updateCartCount();
    }
  });

  window.addEventListener('dealett:cart-updated', updateCartCount);

  initHomePremiumMotion();
  initMobilePlansPremiumMotion();
  window.DEALETT_includesReady = includePartials().finally(() => {
    initGlobalBehaviors();
    initLuxuryScroll();
  });
})();
