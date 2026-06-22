// Haul i18n — 15 languages (must include en/es/ca).
// Non-English entries are merged over the English base, so any missing key
// gracefully falls back to English. Category names are merged separately.

export type Lang =
    | 'en' | 'es' | 'ca' | 'zh' | 'hi' | 'ar' | 'pt' | 'bn'
    | 'ru' | 'ja' | 'de' | 'fr' | 'ko' | 'it' | 'tr';

export const LANGS: { code: Lang; label: string; flag: string; rtl?: boolean }[] = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'ca', label: 'Català', flag: '🏴' },
    { code: 'zh', label: '中文', flag: '🇨🇳' },
    { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
    { code: 'pt', label: 'Português', flag: '🇵🇹' },
    { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
    { code: 'ru', label: 'Русский', flag: '🇷🇺' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'it', label: 'Italiano', flag: '🇮🇹' },
    { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

export const LANG_CODES = LANGS.map((l) => l.code);
export const isRTL = (l: Lang) => !!LANGS.find((x) => x.code === l)?.rtl;

export type CatKey = 'fruit' | 'veg' | 'meat' | 'dairy' | 'pantry' | 'cleaning' | 'home' | 'snacks' | 'frozen' | 'processed' | 'drinks' | 'spices' | 'other';

export interface UIDict {
    plan: string; shop: string; settings: string; myList: string;
    searchProduct: string; add: string; addProducts: string; chooseCategory: string; manage: string; newItem: string; category: string; newProduct: string;
    view: string; completed: string; clear: string; previouslyUsed: string;
    autoclean: string; autocleanItems: string; completedInline: string;
    alerts: string; notifyNew: string; notifyBought: string;
    allDoneTitle: string; allDoneSub: string; leftN: string; allClear: string;
    createList: string; join: string; disconnect: string; enterListName: string;
    account: string; catalog: string; other: string; about: string;
    email: string; password: string; createAccount: string; login: string; logout: string;
    username: string; save: string;
    theme: string; light: string; dark: string; language: string; viewOptions: string;
    server: string; localMode: string; sync: string; syncCode: string; connected: string;
    sourceCode: string; version: string; aboutTagline: string;
    updateAvailable: string; updateNow: string; whatsNew: string; upToDate: string;
    deactivate: string; reactivate: string; tapToToggle: string;
    accountRequired: string; authError: string;
    manageCatalog: string; manageCatalogSub: string; addNamed: string;
    publicLink: string; publicLinkSub: string; shareModeRead: string; shareModeShop: string; shareModePlan: string;
    shareModeReadSub: string; shareModeShopSub: string; shareModePlanSub: string;
    createLink: string; copyLink: string; linkCopied: string; regenerate: string; stopSharing: string; sharingActive: string; chooseAccess: string;
    members: string; roleOwner: string; roleAdmin: string; roleGuest: string; addAdmin: string; adminByEmail: string; adminLink: string; copyAdminLink: string;
    emailNoAccount: string; adminAdded: string; remove: string; lastActive: string; neverActive: string; guestBanner: string;
    avatar: string; choosePhoto: string; chooseColor: string; addToMyLists: string; recoverLists: string;
    inviteTitle: string; inviteBody: string; inviteAccept: string; inviteDecline: string;
    addedByLabel: string; boughtByLabel: string; yourNamePrompt: string; continueLabel: string;
    cats: Record<CatKey, string>;
}

const en: UIDict = {
    plan: 'Plan', shop: 'Shop', settings: 'Settings', myList: 'My list',
    searchProduct: 'Search a product…', add: 'Add', addProducts: 'Add products', chooseCategory: 'Choose a category', manage: 'Manage', newItem: 'New', category: 'Category', newProduct: 'New product…',
    view: 'View', completed: 'Completed', clear: 'Clear', previouslyUsed: 'Previously used',
    autoclean: 'Auto-clean', autocleanItems: 'Auto-clean bought items', completedInline: 'Completed inline',
    alerts: 'Alerts', notifyNew: 'Alerts for new products', notifyBought: 'Alerts for bought products',
    allDoneTitle: 'Shopping complete!', allDoneSub: 'Everything in the basket. Well done.', leftN: '{n} left', allClear: 'All set!',
    createList: 'Create a list', join: 'Join', disconnect: 'Disconnect', enterListName: 'List name:',
    account: 'Account', catalog: 'Catalog', other: 'Other', about: 'About',
    email: 'Email', password: 'Password', createAccount: 'Create account', login: 'Log in', logout: 'Log out',
    username: 'Username', save: 'Save',
    theme: 'Theme', light: 'Light', dark: 'Dark', language: 'Language', viewOptions: 'View options',
    server: 'Server', localMode: 'Local mode', sync: 'Sync', syncCode: 'List code', connected: 'Synced',
    sourceCode: 'Source code', version: 'version', aboutTagline: 'Shopping in motion. A real-time collaborative list, open-source and self-hostable.',
    updateAvailable: 'Update available', updateNow: 'Update', whatsNew: "What's new", upToDate: "You're up to date",
    deactivate: 'Deactivate', reactivate: 'Reactivate', tapToToggle: 'Tap a product to deactivate it for this list',
    accountRequired: 'Sign in to continue', authError: 'Check your email and password',
    manageCatalog: 'Manage catalog', manageCatalogSub: 'Add or remove products and categories', addNamed: 'Add «{x}»',
    publicLink: 'Public link', publicLinkSub: 'Let anyone open this list on the web',
    shareModeRead: 'View only', shareModeShop: 'Check off', shareModePlan: 'Full edit',
    shareModeReadSub: 'See the list and its progress', shareModeShopSub: 'See it and mark items as bought', shareModePlanSub: 'Add, remove and check items',
    createLink: 'Create link', copyLink: 'Copy link', linkCopied: 'Link copied', regenerate: 'New link', stopSharing: 'Stop sharing', sharingActive: 'Link active', chooseAccess: 'Choose access',
    members: 'Members', roleOwner: 'Owner', roleAdmin: 'Admin', roleGuest: 'Guest', addAdmin: 'Add admin', adminByEmail: 'Add by email', adminLink: 'Admin link', copyAdminLink: 'Copy admin link',
    emailNoAccount: 'No account with that email — share the admin link instead.', adminAdded: 'Admin added', remove: 'Remove', lastActive: 'Last active', neverActive: 'Never', guestBanner: "You're a guest — you don't administer this list.",
    avatar: 'Avatar', choosePhoto: 'Photo', chooseColor: 'Color', addToMyLists: 'Add to my lists', recoverLists: 'Recover my lists',
    inviteTitle: 'List invitation', inviteBody: '{who} invited you to administer “{list}”.', inviteAccept: 'Accept', inviteDecline: 'Decline',
    addedByLabel: 'Added by {x}', boughtByLabel: 'Bought by {x}', yourNamePrompt: 'What’s your name?', continueLabel: 'Continue',
    cats: { fruit: 'Fruit', veg: 'Vegetables', meat: 'Meat/Fish', dairy: 'Dairy', pantry: 'Pantry/Bread', cleaning: 'Cleaning/Hygiene', home: 'Home', snacks: 'Snacks/Sweets', frozen: 'Frozen', processed: 'Processed', drinks: 'Drinks', spices: 'Spices', other: 'General/Other' },
};

type Over = Partial<Omit<UIDict, 'cats'>> & { cats?: Partial<Record<CatKey, string>> };

const overrides: Record<Exclude<Lang, 'en'>, Over> = {
    es: {
        plan: 'Planificar', shop: 'Comprar', settings: 'Ajustes', myList: 'Mi lista',
        searchProduct: 'Busca un producto…', add: 'Añadir', addProducts: 'Añadir productos', chooseCategory: 'Elige una categoría', manage: 'Gestionar', newItem: 'Nuevo', category: 'Categoría', newProduct: 'Producto nuevo…',
        view: 'Vista', completed: 'Completados', clear: 'Limpiar', previouslyUsed: 'Usados anteriormente',
        autoclean: 'Autolimpieza', autocleanItems: 'Autolimpieza de comprados', completedInline: 'Completados en línea',
        alerts: 'Avisos', notifyNew: 'Avisos de productos nuevos', notifyBought: 'Avisos de productos comprados',
        allDoneTitle: '¡Compra completada!', allDoneSub: 'Todo en la cesta. Buen trabajo.', leftN: 'Quedan {n} productos', allClear: '¡Todo listo!',
        createList: 'Crea una lista', join: 'Únete', disconnect: 'Desconectar', enterListName: 'Nombre de la lista:',
        account: 'Cuenta', catalog: 'Catálogo', other: 'Otros', about: 'Acerca de',
        email: 'Correo electrónico', password: 'Contraseña', createAccount: 'Crear cuenta', login: 'Entrar', logout: 'Salir',
        username: 'Nombre de usuario', save: 'Guardar',
        theme: 'Tema', light: 'Claro', dark: 'Oscuro', language: 'Idioma', viewOptions: 'Opciones de vista',
        server: 'Servidor', localMode: 'Modo local', sync: 'Sincronización', syncCode: 'Código de la lista', connected: 'Sincronizado',
        sourceCode: 'Código fuente', version: 'versión', aboutTagline: 'La compra, en movimiento. Lista colaborativa en tiempo real, de código abierto y autoalojable.',
        updateAvailable: 'Actualización disponible', updateNow: 'Actualizar', whatsNew: 'Novedades', upToDate: 'Estás al día',
        deactivate: 'Desactivar', reactivate: 'Reactivar', tapToToggle: 'Toca un producto para desactivarlo en esta lista',
        accountRequired: 'Inicia sesión para continuar', authError: 'Revisa el correo y la contraseña',
        manageCatalog: 'Gestión del catálogo', manageCatalogSub: 'Añade o elimina productos y categorías', addNamed: 'Añade «{x}»',
        publicLink: 'Enlace público', publicLinkSub: 'Deja que cualquiera abra esta lista en la web',
        shareModeRead: 'Solo ver', shareModeShop: 'Marcar comprado', shareModePlan: 'Editar todo',
        shareModeReadSub: 'Ver la lista y su progreso', shareModeShopSub: 'Verla y marcar productos comprados', shareModePlanSub: 'Añadir, quitar y marcar productos',
        createLink: 'Crear enlace', copyLink: 'Copiar enlace', linkCopied: 'Enlace copiado', regenerate: 'Nuevo enlace', stopSharing: 'Dejar de compartir', sharingActive: 'Enlace activo', chooseAccess: 'Elige el acceso',
        members: 'Miembros', roleOwner: 'Propietario', roleAdmin: 'Administrador', roleGuest: 'Invitado', addAdmin: 'Añadir administrador', adminByEmail: 'Añadir por correo', adminLink: 'Enlace de admin', copyAdminLink: 'Copiar enlace de admin',
        emailNoAccount: 'No hay cuenta con ese correo — comparte el enlace de admin.', adminAdded: 'Administrador añadido', remove: 'Quitar', lastActive: 'Última vez activo', neverActive: 'Nunca', guestBanner: 'Eres invitado — no administras esta lista.',
        avatar: 'Avatar', choosePhoto: 'Foto', chooseColor: 'Color', addToMyLists: 'Añadir a mis listas', recoverLists: 'Recuperar mis listas',
        inviteTitle: 'Invitación a una lista', inviteBody: '{who} te ha invitado a administrar «{list}».', inviteAccept: 'Aceptar', inviteDecline: 'Rechazar',
        addedByLabel: 'Añadido por {x}', boughtByLabel: 'Comprado por {x}', yourNamePrompt: '¿Cómo te llamas?', continueLabel: 'Continuar',
        cats: { fruit: 'Fruta', veg: 'Verdura', meat: 'Carne/Pescado', dairy: 'Lácteos', pantry: 'Despensa/Pan', cleaning: 'Higiene/Limpieza', home: 'Hogar', snacks: 'Snacks/Dulces', frozen: 'Congelados', processed: 'Procesados', drinks: 'Bebidas', spices: 'Especias', other: 'General/Otros' },
    },
    ca: {
        plan: 'Planificar', shop: 'Comprar', settings: 'Ajustos', myList: 'La meva llista',
        searchProduct: 'Cerca un producte…', add: 'Afegeix', addProducts: 'Afegir productes', chooseCategory: 'Tria una categoria', manage: 'Gestiona', newItem: 'Nou', category: 'Categoria', newProduct: 'Producte nou…',
        view: 'Vista', completed: 'Completats', clear: 'Netejar', previouslyUsed: 'Utilitzats anteriorment',
        autoclean: 'Autoneteja', autocleanItems: 'Autoneteja de comprats', completedInline: 'Completats en línia',
        alerts: 'Avisos', notifyNew: 'Avisos de productes nous', notifyBought: 'Avisos de productes comprats',
        allDoneTitle: 'Compra completada!', allDoneSub: 'Tot a la cistella. Bona feina.', leftN: 'Queden {n} productes', allClear: 'Tot llest!',
        createList: 'Crea una llista', join: 'Uneix-te', disconnect: 'Desconnecta', enterListName: 'Nom de la llista:',
        account: 'Compte', catalog: 'Catàleg', other: 'Altres', about: 'Sobre',
        email: 'Correu electrònic', password: 'Contrasenya', createAccount: 'Crea compte', login: 'Entra', logout: 'Surt',
        username: "Nom d'usuari", save: 'Desa',
        theme: 'Tema', light: 'Clar', dark: 'Fosc', language: 'Idioma', viewOptions: 'Opcions de vista',
        server: 'Servidor', localMode: 'Mode local', sync: 'Sincronització', syncCode: 'Codi de la llista', connected: 'Sincronitzat',
        sourceCode: 'Codi font', version: 'versió', aboutTagline: 'La compra, en moviment. Llista col·laborativa en temps real, de codi obert i autoallotjable.',
        updateAvailable: 'Actualització disponible', updateNow: 'Actualitzar', whatsNew: 'Novetats', upToDate: 'Estàs al dia',
        deactivate: 'Desactivar', reactivate: 'Reactivar', tapToToggle: 'Toca un producte per desactivar-lo en aquesta llista',
        accountRequired: 'Inicia sessió per continuar', authError: 'Revisa el correu i la contrasenya',
        manageCatalog: 'Gestió del catàleg', manageCatalogSub: 'Afegeix o elimina productes i categories', addNamed: 'Afegeix «{x}»',
        publicLink: 'Enllaç públic', publicLinkSub: 'Deixa que qualsevol obri aquesta llista al web',
        shareModeRead: 'Només veure', shareModeShop: 'Marcar comprat', shareModePlan: 'Editar-ho tot',
        shareModeReadSub: 'Veure la llista i el progrés', shareModeShopSub: 'Veure-la i marcar productes comprats', shareModePlanSub: 'Afegir, treure i marcar productes',
        createLink: 'Crear enllaç', copyLink: 'Copiar enllaç', linkCopied: 'Enllaç copiat', regenerate: 'Nou enllaç', stopSharing: 'Deixar de compartir', sharingActive: 'Enllaç actiu', chooseAccess: "Tria l'accés",
        members: 'Membres', roleOwner: 'Propietari', roleAdmin: 'Administrador', roleGuest: 'Convidat', addAdmin: 'Afegir administrador', adminByEmail: 'Afegir per correu', adminLink: "Enllaç d'admin", copyAdminLink: "Copiar enllaç d'admin",
        emailNoAccount: "No hi ha cap compte amb aquest correu — comparteix l'enllaç d'admin.", adminAdded: 'Administrador afegit', remove: 'Treure', lastActive: 'Última vegada actiu', neverActive: 'Mai', guestBanner: 'Ets convidat — no administres aquesta llista.',
        avatar: 'Avatar', choosePhoto: 'Foto', chooseColor: 'Color', addToMyLists: 'Afegir a les meves llistes', recoverLists: 'Recuperar les meves llistes',
        inviteTitle: 'Invitació a una llista', inviteBody: "{who} t'ha convidat a administrar «{list}».", inviteAccept: 'Acceptar', inviteDecline: 'Rebutjar',
        addedByLabel: 'Afegit per {x}', boughtByLabel: 'Comprat per {x}', yourNamePrompt: 'Com et dius?', continueLabel: 'Continuar',
        cats: { fruit: 'Fruita', veg: 'Verdura', meat: 'Carn/Peix', dairy: 'Làctics', pantry: 'Rebost/Pa', cleaning: 'Higiene/Neteja', home: 'Llar', snacks: 'Snacks/Dolços', frozen: 'Congelats', processed: 'Processats', drinks: 'Begudes', spices: 'Espècies', other: 'General/Altres' },
    },
    zh: {
        plan: '计划', shop: '购物', settings: '设置', myList: '我的清单',
        searchProduct: '搜索商品…', add: '添加', addProducts: '添加商品', chooseCategory: '选择分类', manage: '管理', newItem: '新建', category: '分类', newProduct: '新商品…',
        view: '视图', completed: '已完成', clear: '清除', previouslyUsed: '最近使用',
        autoclean: '自动清理', autocleanItems: '自动清理已购', completedInline: '行内显示已完成',
        alerts: '提醒', notifyNew: '新商品提醒', notifyBought: '已购商品提醒',
        allDoneTitle: '购物完成！', allDoneSub: '全部放进购物篮，干得好。', leftN: '还剩 {n} 件', allClear: '全部完成！',
        createList: '创建清单', join: '加入', disconnect: '断开连接', enterListName: '清单名称：',
        account: '账户', catalog: '目录', other: '其他', about: '关于',
        email: '电子邮件', password: '密码', createAccount: '创建账户', login: '登录', logout: '退出',
        username: '用户名', save: '保存',
        theme: '主题', light: '浅色', dark: '深色', language: '语言', viewOptions: '视图选项',
        server: '服务器', localMode: '本地模式', sync: '同步', syncCode: '清单代码', connected: '已同步',
        sourceCode: '源代码', version: '版本', aboutTagline: '移动中的购物。实时协作清单，开源且可自托管。',
        manageCatalog: '管理目录', manageCatalogSub: '添加或删除商品和分类', addNamed: '添加「{x}」',
        cats: { fruit: '水果', veg: '蔬菜', meat: '肉/鱼', dairy: '乳制品', pantry: '杂货/面包', cleaning: '清洁/卫生', home: '家居', snacks: '零食/甜点', frozen: '冷冻', processed: '加工食品', drinks: '饮料', spices: '调味料', other: '其他' },
    },
    hi: {
        plan: 'योजना', shop: 'खरीदें', settings: 'सेटिंग्स', myList: 'मेरी सूची',
        searchProduct: 'उत्पाद खोजें…', add: 'जोड़ें', addProducts: 'उत्पाद जोड़ें', chooseCategory: 'श्रेणी चुनें', manage: 'प्रबंधित करें', newItem: 'नया', category: 'श्रेणी', newProduct: 'नया उत्पाद…',
        view: 'दृश्य', completed: 'पूर्ण', clear: 'साफ़ करें', previouslyUsed: 'पहले इस्तेमाल किए',
        autoclean: 'स्वतः सफाई', autocleanItems: 'खरीदे गए स्वतः साफ़ करें', completedInline: 'पूर्ण इनलाइन',
        alerts: 'सूचनाएँ', notifyNew: 'नए उत्पादों की सूचना', notifyBought: 'खरीदे उत्पादों की सूचना',
        allDoneTitle: 'खरीदारी पूरी!', allDoneSub: 'सब टोकरी में। बढ़िया।', leftN: '{n} बचे', allClear: 'सब तैयार!',
        createList: 'सूची बनाएं', join: 'शामिल हों', disconnect: 'डिस्कनेक्ट', enterListName: 'सूची का नाम:',
        account: 'खाता', catalog: 'कैटलॉग', other: 'अन्य', about: 'परिचय',
        email: 'ईमेल', password: 'पासवर्ड', createAccount: 'खाता बनाएं', login: 'लॉग इन', logout: 'लॉग आउट',
        username: 'उपयोगकर्ता नाम', save: 'सहेजें',
        theme: 'थीम', light: 'हल्का', dark: 'गहरा', language: 'भाषा', viewOptions: 'दृश्य विकल्प',
        server: 'सर्वर', localMode: 'स्थानीय मोड', sync: 'सिंक', syncCode: 'सूची कोड', connected: 'सिंक किया',
        sourceCode: 'सोर्स कोड', version: 'संस्करण', aboutTagline: 'चलते-फिरते खरीदारी। रियल-टाइम सहयोगी सूची, ओपन-सोर्स और स्वयं-होस्ट करने योग्य।',
        manageCatalog: 'कैटलॉग प्रबंधन', manageCatalogSub: 'उत्पाद और श्रेणियाँ जोड़ें या हटाएँ', addNamed: '«{x}» जोड़ें',
        cats: { fruit: 'फल', veg: 'सब्ज़ी', meat: 'मांस/मछली', dairy: 'डेयरी', pantry: 'पैंट्री/ब्रेड', cleaning: 'सफाई/स्वच्छता', home: 'घर', snacks: 'स्नैक्स/मिठाई', frozen: 'जमे हुए', processed: 'प्रसंस्कृत', drinks: 'पेय', spices: 'मसाले', other: 'अन्य' },
    },
    ar: {
        plan: 'تخطيط', shop: 'تسوّق', settings: 'الإعدادات', myList: 'قائمتي',
        searchProduct: 'ابحث عن منتج…', add: 'أضف', addProducts: 'إضافة منتجات', chooseCategory: 'اختر فئة', manage: 'إدارة', newItem: 'جديد', category: 'الفئة', newProduct: 'منتج جديد…',
        view: 'العرض', completed: 'المكتملة', clear: 'مسح', previouslyUsed: 'استُخدمت سابقاً',
        autoclean: 'تنظيف تلقائي', autocleanItems: 'تنظيف المشتريات تلقائياً', completedInline: 'المكتملة ضمن القائمة',
        alerts: 'التنبيهات', notifyNew: 'تنبيهات المنتجات الجديدة', notifyBought: 'تنبيهات المنتجات المشتراة',
        allDoneTitle: 'اكتمل التسوّق!', allDoneSub: 'كل شيء في السلة. أحسنت.', leftN: 'يتبقى {n}', allClear: 'كل شيء جاهز!',
        createList: 'أنشئ قائمة', join: 'انضم', disconnect: 'قطع الاتصال', enterListName: 'اسم القائمة:',
        account: 'الحساب', catalog: 'الكتالوج', other: 'أخرى', about: 'حول',
        email: 'البريد الإلكتروني', password: 'كلمة المرور', createAccount: 'إنشاء حساب', login: 'تسجيل الدخول', logout: 'تسجيل الخروج',
        username: 'اسم المستخدم', save: 'حفظ',
        theme: 'المظهر', light: 'فاتح', dark: 'داكن', language: 'اللغة', viewOptions: 'خيارات العرض',
        server: 'الخادم', localMode: 'الوضع المحلي', sync: 'المزامنة', syncCode: 'رمز القائمة', connected: 'متزامن',
        sourceCode: 'الكود المصدري', version: 'إصدار', aboutTagline: 'التسوّق في حركة. قائمة تعاونية فورية، مفتوحة المصدر وقابلة للاستضافة الذاتية.',
        manageCatalog: 'إدارة الكتالوج', manageCatalogSub: 'أضف أو احذف المنتجات والفئات', addNamed: 'أضف «{x}»',
        cats: { fruit: 'فواكه', veg: 'خضار', meat: 'لحوم/أسماك', dairy: 'ألبان', pantry: 'مؤن/خبز', cleaning: 'تنظيف/نظافة', home: 'المنزل', snacks: 'وجبات خفيفة/حلويات', frozen: 'مجمدات', processed: 'مصنّعة', drinks: 'مشروبات', spices: 'بهارات', other: 'أخرى' },
    },
    pt: {
        plan: 'Planear', shop: 'Comprar', settings: 'Definições', myList: 'A minha lista',
        searchProduct: 'Procurar um produto…', add: 'Adicionar', addProducts: 'Adicionar produtos', chooseCategory: 'Escolhe uma categoria', manage: 'Gerir', newItem: 'Novo', category: 'Categoria', newProduct: 'Novo produto…',
        view: 'Vista', completed: 'Concluídos', clear: 'Limpar', previouslyUsed: 'Usados anteriormente',
        autoclean: 'Limpeza automática', autocleanItems: 'Limpar comprados automaticamente', completedInline: 'Concluídos em linha',
        alerts: 'Alertas', notifyNew: 'Alertas de novos produtos', notifyBought: 'Alertas de produtos comprados',
        allDoneTitle: 'Compra concluída!', allDoneSub: 'Tudo no cesto. Bom trabalho.', leftN: 'Faltam {n}', allClear: 'Tudo pronto!',
        createList: 'Criar uma lista', join: 'Juntar-se', disconnect: 'Desligar', enterListName: 'Nome da lista:',
        account: 'Conta', catalog: 'Catálogo', other: 'Outros', about: 'Sobre',
        email: 'E-mail', password: 'Palavra-passe', createAccount: 'Criar conta', login: 'Entrar', logout: 'Sair',
        username: 'Nome de utilizador', save: 'Guardar',
        theme: 'Tema', light: 'Claro', dark: 'Escuro', language: 'Idioma', viewOptions: 'Opções de vista',
        server: 'Servidor', localMode: 'Modo local', sync: 'Sincronização', syncCode: 'Código da lista', connected: 'Sincronizado',
        sourceCode: 'Código-fonte', version: 'versão', aboutTagline: 'As compras, em movimento. Lista colaborativa em tempo real, open-source e auto-hospedável.',
        manageCatalog: 'Gestão do catálogo', manageCatalogSub: 'Adiciona ou remove produtos e categorias', addNamed: 'Adicionar «{x}»',
        cats: { fruit: 'Fruta', veg: 'Legumes', meat: 'Carne/Peixe', dairy: 'Laticínios', pantry: 'Despensa/Pão', cleaning: 'Limpeza/Higiene', home: 'Casa', snacks: 'Snacks/Doces', frozen: 'Congelados', processed: 'Processados', drinks: 'Bebidas', spices: 'Especiarias', other: 'Geral/Outros' },
    },
    bn: {
        plan: 'পরিকল্পনা', shop: 'কেনাকাটা', settings: 'সেটিংস', myList: 'আমার তালিকা',
        searchProduct: 'পণ্য খুঁজুন…', add: 'যোগ করুন', addProducts: 'পণ্য যোগ করুন', chooseCategory: 'বিভাগ বাছুন', manage: 'পরিচালনা', newItem: 'নতুন', category: 'বিভাগ', newProduct: 'নতুন পণ্য…',
        view: 'ভিউ', completed: 'সম্পন্ন', clear: 'মুছুন', previouslyUsed: 'আগে ব্যবহৃত',
        autoclean: 'স্বয়ংক্রিয় পরিষ্কার', autocleanItems: 'কেনা পণ্য স্বয়ংক্রিয় পরিষ্কার', completedInline: 'ইনলাইনে সম্পন্ন',
        alerts: 'সতর্কতা', notifyNew: 'নতুন পণ্যের সতর্কতা', notifyBought: 'কেনা পণ্যের সতর্কতা',
        allDoneTitle: 'কেনাকাটা সম্পন্ন!', allDoneSub: 'সব ঝুড়িতে। দারুণ।', leftN: '{n} বাকি', allClear: 'সব প্রস্তুত!',
        createList: 'তালিকা তৈরি করুন', join: 'যোগ দিন', disconnect: 'সংযোগ বিচ্ছিন্ন', enterListName: 'তালিকার নাম:',
        account: 'অ্যাকাউন্ট', catalog: 'ক্যাটালগ', other: 'অন্যান্য', about: 'সম্পর্কে',
        email: 'ইমেল', password: 'পাসওয়ার্ড', createAccount: 'অ্যাকাউন্ট তৈরি', login: 'লগ ইন', logout: 'লগ আউট',
        username: 'ইউজারনেম', save: 'সংরক্ষণ',
        theme: 'থিম', light: 'হালকা', dark: 'গাঢ়', language: 'ভাষা', viewOptions: 'ভিউ অপশন',
        server: 'সার্ভার', localMode: 'লোকাল মোড', sync: 'সিঙ্ক', syncCode: 'তালিকা কোড', connected: 'সিঙ্ক হয়েছে',
        sourceCode: 'সোর্স কোড', version: 'সংস্করণ', aboutTagline: 'চলমান কেনাকাটা। রিয়েল-টাইম সহযোগী তালিকা, ওপেন-সোর্স ও সেলফ-হোস্টেবল।',
        manageCatalog: 'ক্যাটালগ পরিচালনা', manageCatalogSub: 'পণ্য ও বিভাগ যোগ বা মুছুন', addNamed: '«{x}» যোগ করুন',
        cats: { fruit: 'ফল', veg: 'সবজি', meat: 'মাংস/মাছ', dairy: 'দুগ্ধজাত', pantry: 'প্যান্ট্রি/রুটি', cleaning: 'পরিষ্কার/স্বাস্থ্যবিধি', home: 'বাড়ি', snacks: 'স্ন্যাকস/মিষ্টি', frozen: 'হিমায়িত', processed: 'প্রক্রিয়াজাত', drinks: 'পানীয়', spices: 'মসলা', other: 'অন্যান্য' },
    },
    ru: {
        plan: 'План', shop: 'Покупки', settings: 'Настройки', myList: 'Мой список',
        searchProduct: 'Найти продукт…', add: 'Добавить', addProducts: 'Добавить продукты', chooseCategory: 'Выберите категорию', manage: 'Управление', newItem: 'Новый', category: 'Категория', newProduct: 'Новый продукт…',
        view: 'Вид', completed: 'Выполнено', clear: 'Очистить', previouslyUsed: 'Ранее использованные',
        autoclean: 'Автоочистка', autocleanItems: 'Автоочистка купленного', completedInline: 'Выполненные в списке',
        alerts: 'Оповещения', notifyNew: 'Оповещения о новых продуктах', notifyBought: 'Оповещения о купленных',
        allDoneTitle: 'Покупки завершены!', allDoneSub: 'Всё в корзине. Отлично.', leftN: 'Осталось {n}', allClear: 'Всё готово!',
        createList: 'Создать список', join: 'Присоединиться', disconnect: 'Отключить', enterListName: 'Название списка:',
        account: 'Аккаунт', catalog: 'Каталог', other: 'Другое', about: 'О приложении',
        email: 'Эл. почта', password: 'Пароль', createAccount: 'Создать аккаунт', login: 'Войти', logout: 'Выйти',
        username: 'Имя пользователя', save: 'Сохранить',
        theme: 'Тема', light: 'Светлая', dark: 'Тёмная', language: 'Язык', viewOptions: 'Параметры вида',
        server: 'Сервер', localMode: 'Локальный режим', sync: 'Синхронизация', syncCode: 'Код списка', connected: 'Синхронизировано',
        sourceCode: 'Исходный код', version: 'версия', aboutTagline: 'Покупки в движении. Совместный список в реальном времени, открытый и самостоятельно размещаемый.',
        manageCatalog: 'Управление каталогом', manageCatalogSub: 'Добавляйте или удаляйте продукты и категории', addNamed: 'Добавить «{x}»',
        cats: { fruit: 'Фрукты', veg: 'Овощи', meat: 'Мясо/Рыба', dairy: 'Молочное', pantry: 'Бакалея/Хлеб', cleaning: 'Уборка/Гигиена', home: 'Дом', snacks: 'Снеки/Сладости', frozen: 'Заморозка', processed: 'Полуфабрикаты', drinks: 'Напитки', spices: 'Специи', other: 'Прочее' },
    },
    ja: {
        plan: '計画', shop: '買い物', settings: '設定', myList: 'マイリスト',
        searchProduct: '商品を検索…', add: '追加', addProducts: '商品を追加', chooseCategory: 'カテゴリを選ぶ', manage: '管理', newItem: '新規', category: 'カテゴリ', newProduct: '新しい商品…',
        view: '表示', completed: '完了', clear: 'クリア', previouslyUsed: '以前使ったもの',
        autoclean: '自動整理', autocleanItems: '購入済みを自動整理', completedInline: '完了をインライン表示',
        alerts: '通知', notifyNew: '新商品の通知', notifyBought: '購入済みの通知',
        allDoneTitle: '買い物完了！', allDoneSub: '全部カゴに入りました。お疲れさま。', leftN: '残り {n}', allClear: '完了！',
        createList: 'リストを作成', join: '参加', disconnect: '切断', enterListName: 'リスト名：',
        account: 'アカウント', catalog: 'カタログ', other: 'その他', about: '概要',
        email: 'メール', password: 'パスワード', createAccount: 'アカウント作成', login: 'ログイン', logout: 'ログアウト',
        username: 'ユーザー名', save: '保存',
        theme: 'テーマ', light: 'ライト', dark: 'ダーク', language: '言語', viewOptions: '表示オプション',
        server: 'サーバー', localMode: 'ローカルモード', sync: '同期', syncCode: 'リストコード', connected: '同期済み',
        sourceCode: 'ソースコード', version: 'バージョン', aboutTagline: '動きながらの買い物。リアルタイム共同編集リスト、オープンソースで自己ホスト可能。',
        manageCatalog: 'カタログ管理', manageCatalogSub: '商品とカテゴリを追加・削除', addNamed: '「{x}」を追加',
        cats: { fruit: '果物', veg: '野菜', meat: '肉/魚', dairy: '乳製品', pantry: '食料品/パン', cleaning: '掃除/衛生', home: '家庭', snacks: 'スナック/お菓子', frozen: '冷凍', processed: '加工食品', drinks: '飲み物', spices: '調味料', other: 'その他' },
    },
    de: {
        plan: 'Planen', shop: 'Einkaufen', settings: 'Einstellungen', myList: 'Meine Liste',
        searchProduct: 'Produkt suchen…', add: 'Hinzufügen', addProducts: 'Produkte hinzufügen', chooseCategory: 'Kategorie wählen', manage: 'Verwalten', newItem: 'Neu', category: 'Kategorie', newProduct: 'Neues Produkt…',
        view: 'Ansicht', completed: 'Erledigt', clear: 'Leeren', previouslyUsed: 'Zuvor verwendet',
        autoclean: 'Auto-Aufräumen', autocleanItems: 'Gekaufte automatisch aufräumen', completedInline: 'Erledigte inline',
        alerts: 'Hinweise', notifyNew: 'Hinweise zu neuen Produkten', notifyBought: 'Hinweise zu gekauften Produkten',
        allDoneTitle: 'Einkauf abgeschlossen!', allDoneSub: 'Alles im Korb. Gut gemacht.', leftN: 'Noch {n}', allClear: 'Alles erledigt!',
        createList: 'Liste erstellen', join: 'Beitreten', disconnect: 'Trennen', enterListName: 'Listenname:',
        account: 'Konto', catalog: 'Katalog', other: 'Sonstiges', about: 'Über',
        email: 'E-Mail', password: 'Passwort', createAccount: 'Konto erstellen', login: 'Anmelden', logout: 'Abmelden',
        username: 'Benutzername', save: 'Speichern',
        theme: 'Design', light: 'Hell', dark: 'Dunkel', language: 'Sprache', viewOptions: 'Ansichtsoptionen',
        server: 'Server', localMode: 'Lokaler Modus', sync: 'Synchronisierung', syncCode: 'Listencode', connected: 'Synchronisiert',
        sourceCode: 'Quellcode', version: 'Version', aboutTagline: 'Einkaufen in Bewegung. Kollaborative Echtzeit-Liste, Open Source und selbst hostbar.',
        manageCatalog: 'Katalog verwalten', manageCatalogSub: 'Produkte und Kategorien hinzufügen oder entfernen', addNamed: '«{x}» hinzufügen',
        cats: { fruit: 'Obst', veg: 'Gemüse', meat: 'Fleisch/Fisch', dairy: 'Milchprodukte', pantry: 'Vorrat/Brot', cleaning: 'Reinigung/Hygiene', home: 'Haushalt', snacks: 'Snacks/Süßes', frozen: 'Tiefkühl', processed: 'Verarbeitet', drinks: 'Getränke', spices: 'Gewürze', other: 'Allgemein/Sonstiges' },
    },
    fr: {
        plan: 'Planifier', shop: 'Acheter', settings: 'Réglages', myList: 'Ma liste',
        searchProduct: 'Rechercher un produit…', add: 'Ajouter', addProducts: 'Ajouter des produits', chooseCategory: 'Choisir une catégorie', manage: 'Gérer', newItem: 'Nouveau', category: 'Catégorie', newProduct: 'Nouveau produit…',
        view: 'Vue', completed: 'Terminés', clear: 'Effacer', previouslyUsed: 'Déjà utilisés',
        autoclean: 'Nettoyage auto', autocleanItems: 'Nettoyer les achetés automatiquement', completedInline: 'Terminés en ligne',
        alerts: 'Alertes', notifyNew: 'Alertes nouveaux produits', notifyBought: 'Alertes produits achetés',
        allDoneTitle: 'Courses terminées !', allDoneSub: 'Tout est dans le panier. Bravo.', leftN: '{n} restants', allClear: 'Tout est prêt !',
        createList: 'Créer une liste', join: 'Rejoindre', disconnect: 'Déconnecter', enterListName: 'Nom de la liste :',
        account: 'Compte', catalog: 'Catalogue', other: 'Autres', about: 'À propos',
        email: 'E-mail', password: 'Mot de passe', createAccount: 'Créer un compte', login: 'Se connecter', logout: 'Se déconnecter',
        username: "Nom d'utilisateur", save: 'Enregistrer',
        theme: 'Thème', light: 'Clair', dark: 'Sombre', language: 'Langue', viewOptions: "Options d'affichage",
        server: 'Serveur', localMode: 'Mode local', sync: 'Synchronisation', syncCode: 'Code de la liste', connected: 'Synchronisé',
        sourceCode: 'Code source', version: 'version', aboutTagline: 'Les courses, en mouvement. Liste collaborative en temps réel, open-source et auto-hébergeable.',
        manageCatalog: 'Gestion du catalogue', manageCatalogSub: 'Ajouter ou supprimer des produits et catégories', addNamed: 'Ajouter « {x} »',
        cats: { fruit: 'Fruits', veg: 'Légumes', meat: 'Viande/Poisson', dairy: 'Produits laitiers', pantry: 'Épicerie/Pain', cleaning: 'Nettoyage/Hygiène', home: 'Maison', snacks: 'Snacks/Sucreries', frozen: 'Surgelés', processed: 'Transformés', drinks: 'Boissons', spices: 'Épices', other: 'Général/Autres' },
    },
    ko: {
        plan: '계획', shop: '쇼핑', settings: '설정', myList: '내 목록',
        searchProduct: '상품 검색…', add: '추가', addProducts: '상품 추가', chooseCategory: '카테고리 선택', manage: '관리', newItem: '새로 만들기', category: '카테고리', newProduct: '새 상품…',
        view: '보기', completed: '완료', clear: '지우기', previouslyUsed: '이전에 사용함',
        autoclean: '자동 정리', autocleanItems: '구매 항목 자동 정리', completedInline: '완료 항목 인라인',
        alerts: '알림', notifyNew: '새 상품 알림', notifyBought: '구매 상품 알림',
        allDoneTitle: '쇼핑 완료!', allDoneSub: '모두 장바구니에. 수고했어요.', leftN: '{n}개 남음', allClear: '모두 완료!',
        createList: '목록 만들기', join: '참여', disconnect: '연결 해제', enterListName: '목록 이름:',
        account: '계정', catalog: '카탈로그', other: '기타', about: '정보',
        email: '이메일', password: '비밀번호', createAccount: '계정 만들기', login: '로그인', logout: '로그아웃',
        username: '사용자 이름', save: '저장',
        theme: '테마', light: '라이트', dark: '다크', language: '언어', viewOptions: '보기 옵션',
        server: '서버', localMode: '로컬 모드', sync: '동기화', syncCode: '목록 코드', connected: '동기화됨',
        sourceCode: '소스 코드', version: '버전', aboutTagline: '움직이는 쇼핑. 실시간 협업 목록, 오픈 소스이며 셀프 호스팅 가능.',
        manageCatalog: '카탈로그 관리', manageCatalogSub: '상품과 카테고리 추가 또는 삭제', addNamed: '«{x}» 추가',
        cats: { fruit: '과일', veg: '채소', meat: '고기/생선', dairy: '유제품', pantry: '식료품/빵', cleaning: '청소/위생', home: '집', snacks: '간식/디저트', frozen: '냉동', processed: '가공식품', drinks: '음료', spices: '향신료', other: '기타' },
    },
    it: {
        plan: 'Pianifica', shop: 'Acquista', settings: 'Impostazioni', myList: 'La mia lista',
        searchProduct: 'Cerca un prodotto…', add: 'Aggiungi', addProducts: 'Aggiungi prodotti', chooseCategory: 'Scegli una categoria', manage: 'Gestisci', newItem: 'Nuovo', category: 'Categoria', newProduct: 'Nuovo prodotto…',
        view: 'Vista', completed: 'Completati', clear: 'Svuota', previouslyUsed: 'Usati in precedenza',
        autoclean: 'Pulizia automatica', autocleanItems: 'Pulisci gli acquistati automaticamente', completedInline: 'Completati in linea',
        alerts: 'Avvisi', notifyNew: 'Avvisi nuovi prodotti', notifyBought: 'Avvisi prodotti acquistati',
        allDoneTitle: 'Spesa completata!', allDoneSub: 'Tutto nel carrello. Ottimo lavoro.', leftN: 'Restano {n}', allClear: 'Tutto pronto!',
        createList: 'Crea una lista', join: 'Unisciti', disconnect: 'Disconnetti', enterListName: 'Nome della lista:',
        account: 'Account', catalog: 'Catalogo', other: 'Altro', about: 'Info',
        email: 'Email', password: 'Password', createAccount: 'Crea account', login: 'Accedi', logout: 'Esci',
        username: 'Nome utente', save: 'Salva',
        theme: 'Tema', light: 'Chiaro', dark: 'Scuro', language: 'Lingua', viewOptions: 'Opzioni di vista',
        server: 'Server', localMode: 'Modalità locale', sync: 'Sincronizzazione', syncCode: 'Codice lista', connected: 'Sincronizzato',
        sourceCode: 'Codice sorgente', version: 'versione', aboutTagline: 'La spesa, in movimento. Lista collaborativa in tempo reale, open-source e self-hostabile.',
        manageCatalog: 'Gestione catalogo', manageCatalogSub: 'Aggiungi o rimuovi prodotti e categorie', addNamed: 'Aggiungi «{x}»',
        cats: { fruit: 'Frutta', veg: 'Verdura', meat: 'Carne/Pesce', dairy: 'Latticini', pantry: 'Dispensa/Pane', cleaning: 'Pulizia/Igiene', home: 'Casa', snacks: 'Snack/Dolci', frozen: 'Surgelati', processed: 'Trasformati', drinks: 'Bevande', spices: 'Spezie', other: 'Generale/Altro' },
    },
    tr: {
        plan: 'Planla', shop: 'Alışveriş', settings: 'Ayarlar', myList: 'Listem',
        searchProduct: 'Ürün ara…', add: 'Ekle', addProducts: 'Ürün ekle', chooseCategory: 'Kategori seç', manage: 'Yönet', newItem: 'Yeni', category: 'Kategori', newProduct: 'Yeni ürün…',
        view: 'Görünüm', completed: 'Tamamlanan', clear: 'Temizle', previouslyUsed: 'Önceden kullanılan',
        autoclean: 'Otomatik temizleme', autocleanItems: 'Alınanları otomatik temizle', completedInline: 'Tamamlananlar satır içi',
        alerts: 'Uyarılar', notifyNew: 'Yeni ürün uyarıları', notifyBought: 'Alınan ürün uyarıları',
        allDoneTitle: 'Alışveriş tamam!', allDoneSub: 'Her şey sepette. Aferin.', leftN: '{n} kaldı', allClear: 'Her şey hazır!',
        createList: 'Liste oluştur', join: 'Katıl', disconnect: 'Bağlantıyı kes', enterListName: 'Liste adı:',
        account: 'Hesap', catalog: 'Katalog', other: 'Diğer', about: 'Hakkında',
        email: 'E-posta', password: 'Parola', createAccount: 'Hesap oluştur', login: 'Giriş yap', logout: 'Çıkış yap',
        username: 'Kullanıcı adı', save: 'Kaydet',
        theme: 'Tema', light: 'Açık', dark: 'Koyu', language: 'Dil', viewOptions: 'Görünüm seçenekleri',
        server: 'Sunucu', localMode: 'Yerel mod', sync: 'Eşitleme', syncCode: 'Liste kodu', connected: 'Eşitlendi',
        sourceCode: 'Kaynak kod', version: 'sürüm', aboutTagline: 'Hareket halinde alışveriş. Gerçek zamanlı ortak liste, açık kaynak ve kendi sunucunda barındırılabilir.',
        manageCatalog: 'Katalog yönetimi', manageCatalogSub: 'Ürün ve kategori ekle veya kaldır', addNamed: '«{x}» ekle',
        cats: { fruit: 'Meyve', veg: 'Sebze', meat: 'Et/Balık', dairy: 'Süt ürünleri', pantry: 'Kiler/Ekmek', cleaning: 'Temizlik/Hijyen', home: 'Ev', snacks: 'Atıştırmalık/Tatlı', frozen: 'Donmuş', processed: 'İşlenmiş', drinks: 'İçecekler', spices: 'Baharatlar', other: 'Genel/Diğer' },
    },
};

export const ui: Record<Lang, UIDict> = Object.fromEntries(
    LANG_CODES.map((code) => {
        if (code === 'en') return [code, en];
        const o = overrides[code as Exclude<Lang, 'en'>] || {};
        return [code, { ...en, ...o, cats: { ...en.cats, ...(o.cats || {}) } }];
    }),
) as Record<Lang, UIDict>;

export const tt = (lang: Lang): UIDict => ui[lang] || en;

// Map a browser/OS locale (e.g. "es-ES", "zh-CN", "pt-BR") to a supported Lang,
// else English. Used to auto-pick the language (no in-app selector).
export function detectLang(locale: string | undefined | null): Lang {
    const base = (locale || 'en').toLowerCase().split('-')[0];
    return (LANG_CODES as string[]).includes(base) ? (base as Lang) : 'en';
}
