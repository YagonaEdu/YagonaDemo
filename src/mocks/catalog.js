/* Reference data for the demo: a Tashkent learning centre with typical courses,
   staff and students. Every name and phone number here is made up. */

export const CENTER = {
  name: "Registon Academy",
  slug: "registon",
  short_name: "Registon",
  description: "Учебный центр иностранных языков, подготовки к IELTS и DTM в Ташкенте.",
  city: "Ташкент",
  legal_name: "ООО «Registon Ta'lim»",
  legal_address: "г. Ташкент, Мирзо-Улугбекский р-н, ул. Буюк Ипак Йули, 45",
  contact_phone: "+998712001020",
  contact_phone_secondary: "+998901234567",
  contact_email: "info@registon.demo",
  telegram: "@registon_academy",
  website: "registon.demo",
  stir: "305123456",
  director_name: "Каримов Азиз Бахтиёрович",
  contract_number: "YG-2026/014",
};

/* role → demo user; login picks one by keyword in the identifier (see api/handlers/auth.js). */
export const STAFF = [
  { key: "owner", first: "Азиз", last: "Каримов", email: "owner@registon.demo", phone: "+998901110001", role: "owner", position: "Владелец", pay: ["fixed", 0] },
  { key: "admin", first: "Дилноза", last: "Юсупова", email: "admin@registon.demo", phone: "+998901110002", role: "admin", position: "Администратор", pay: ["fixed", 4500000] },
  { key: "accountant", first: "Шахло", last: "Рахимова", email: "accountant@registon.demo", phone: "+998901110003", role: "accountant", position: "Бухгалтер", pay: ["fixed", 5000000] },
  { key: "teacher", first: "Нодира", last: "Алиева", email: "teacher@registon.demo", phone: "+998901110004", role: "teacher", position: "Преподаватель английского", pay: ["per_lesson", 120000] },
  { key: "t2", first: "Джамшид", last: "Турсунов", email: "jamshid@registon.demo", phone: "+998901110005", role: "teacher", position: "Преподаватель IELTS", pay: ["per_lesson", 150000] },
  { key: "t3", first: "Бобур", last: "Хасанов", email: "bobur@registon.demo", phone: "+998901110006", role: "teacher", position: "Преподаватель математики", pay: ["fixed", 6000000] },
  { key: "t4", first: "Мадина", last: "Саидова", email: "madina@registon.demo", phone: "+998901110007", role: "teacher", position: "Преподаватель русского языка", pay: ["hourly", 80000] },
  { key: "t5", first: "Сардор", last: "Ким", email: "sardor@registon.demo", phone: "+998901110008", role: "teacher", position: "Преподаватель корейского", pay: ["per_lesson", 130000] },
  { key: "t6", first: "Жасур", last: "Абдуллаев", email: "jasur@registon.demo", phone: "+998901110009", role: "teacher", position: "Преподаватель Python", pay: ["per_lesson", 140000] },
];

export const SUPER_USER = { first: "Платформа", last: "Yagona", email: "super@yagona.demo", phone: "+998901119999" };

export const COURSES = [
  { key: "ge", name: "General English", description: "Разговорный английский от A1 до B2 по Cambridge English.", price: 650000 },
  { key: "ielts", name: "IELTS Preparation", description: "Подготовка к IELTS Academic: Listening, Reading, Writing, Speaking.", price: 900000 },
  { key: "math", name: "Математика (DTM)", description: "Подготовка к вступительным тестам DTM по математике.", price: 550000 },
  { key: "rus", name: "Русский язык", description: "Русский язык для школьников и взрослых, грамматика и речь.", price: 500000 },
  { key: "kor", name: "Корейский язык (TOPIK)", description: "Корейский с нуля и подготовка к TOPIK I.", price: 700000 },
  { key: "py", name: "Программирование на Python", description: "Основы Python, алгоритмы и первые проекты.", price: 850000 },
];

export const ROOMS = [
  { name: "Кабинет 101", capacity: 12 },
  { name: "Кабинет 102", capacity: 10 },
  { name: "Кабинет 201", capacity: 14 },
  { name: "Кабинет 202", capacity: 8 },
  { name: "IT-класс", capacity: 12 },
  { name: "Конференц-зал", capacity: 30 },
];

/* days: 1 = Monday … 6 = Saturday (JS getDay() numbering). */
export const GROUPS = [
  { key: "ge-a1", course: "ge", name: "GE Beginner A1-3", teacher: "teacher", room: 0, days: [1, 3, 5], time: "09:00", status: "active", size: 9 },
  { key: "ge-b1", course: "ge", name: "GE Pre-Intermediate B1-1", teacher: "teacher", room: 1, days: [2, 4, 6], time: "14:00", status: "active", size: 8, demoStudent: true },
  { key: "ielts-65", course: "ielts", name: "IELTS 6.5+ Evening", teacher: "t2", room: 2, days: [1, 3, 5], time: "16:00", status: "active", size: 8 },
  { key: "ielts-int", course: "ielts", name: "IELTS Intensive", teacher: "t2", room: 3, days: [2, 4, 6], time: "18:00", status: "active", size: 6 },
  { key: "math-1", course: "math", name: "DTM Математика-1", teacher: "t3", room: 0, days: [1, 3, 5], time: "11:00", status: "active", size: 9, demoStudent: true },
  { key: "math-2", course: "math", name: "DTM Математика-2", teacher: "t3", room: 2, days: [2, 4, 6], time: "10:00", status: "active", size: 7 },
  { key: "rus-1", course: "rus", name: "Русский язык B1", teacher: "t4", room: 1, days: [2, 4], time: "15:30", status: "active", size: 6 },
  { key: "kor-1", course: "kor", name: "Korean TOPIK I", teacher: "t5", room: 3, days: [1, 3, 5], time: "18:30", status: "active", size: 7 },
  { key: "py-1", course: "py", name: "Python Start", teacher: "t6", room: 4, days: [2, 4, 6], time: "16:30", status: "active", size: 8 },
  { key: "ge-kids", course: "ge", name: "English Kids (набор)", teacher: "teacher", room: 5, days: [6], time: "10:00", status: "planned", size: 0 },
];

export const FIRST_NAMES_F = ["Камола", "Малика", "Севара", "Нигора", "Зарина", "Дильноза", "Мохинур", "Шахзода", "Гулнора", "Лола", "Феруза", "Мадина", "Сабина", "Нилуфар", "Азиза", "Райхона", "Хадича", "Умида", "Барно", "Сайёра"];
export const FIRST_NAMES_M = ["Тимур", "Азамат", "Бехзод", "Шерзод", "Фаррух", "Улугбек", "Санжар", "Рустам", "Отабек", "Жахонгир", "Абдулла", "Достон", "Ислом", "Мирзо", "Акмал", "Сардорбек", "Нодир", "Элдор", "Хумоюн", "Аброр"];
export const LAST_NAMES = ["Каримов", "Рахимов", "Юсупов", "Абдуллаев", "Турсунов", "Хасанов", "Алимов", "Назаров", "Исмоилов", "Мирзаев", "Ахмедов", "Султанов", "Эргашев", "Шарипов", "Холматов", "Усмонов", "Бакиров", "Тошпулатов", "Файзуллаев", "Жураев"];

export const TOPICS = {
  ge: ["Present Simple vs Continuous", "Past Simple: regular verbs", "Food & Drinks vocabulary", "Speaking: My daily routine", "Comparatives & superlatives", "Future: will / going to", "Listening practice: At the airport", "Present Perfect intro", "Modal verbs: can / must", "Writing an informal email", "Countable & uncountable nouns", "Review & mini-test"],
  ielts: ["Listening Section 3 strategies", "Reading: True/False/Not Given", "Writing Task 1: line graphs", "Writing Task 2: opinion essay", "Speaking Part 2: cue cards", "Vocabulary: environment", "Reading: matching headings", "Mock test & feedback", "Writing Task 1: process diagrams", "Speaking Part 3: discussion"],
  math: ["Квадратные уравнения", "Логарифмы", "Тригонометрические тождества", "Прогрессии", "Неравенства с модулем", "Производная и её применение", "Планиметрия: треугольники", "Стереометрия: объёмы", "Разбор теста DTM", "Текстовые задачи на движение"],
  rus: ["Падежи существительных", "Глаголы движения", "Причастия и деепричастия", "Деловое письмо", "Пунктуация в сложном предложении", "Развитие речи: описание"],
  kor: ["Хангыль: гласные и согласные", "Приветствие и знакомство", "Числа и счёт", "Глагольные окончания -아요/-어요", "Частицы 은/는, 이/가", "TOPIK I: аудирование"],
  py: ["Переменные и типы данных", "Условия if/elif/else", "Циклы for и while", "Функции", "Списки и словари", "Работа с файлами", "Мини-проект: телеграм-бот"],
};

export const LEAD_STAGES = [
  { name: "Новая заявка", is_won: false, is_lost: false },
  { name: "Связались", is_won: false, is_lost: false },
  { name: "Пробный урок", is_won: false, is_lost: false },
  { name: "Думает", is_won: false, is_lost: false },
  { name: "Записался", is_won: true, is_lost: false },
  { name: "Отказ", is_won: false, is_lost: true },
];

export const TAGS = [
  { name: "Взрослый", color: "#2d6bea" },
  { name: "Школьник", color: "#00bfa5" },
  { name: "Срочно", color: "#e5484d" },
  { name: "VIP", color: "#f5a524" },
];

export const BILLING_PLANS = [
  { name: "Абонемент на месяц", billing_type: "monthly", price: 650000, lesson_limit: null, duration_days: 30 },
  { name: "IELTS — месяц", billing_type: "monthly", price: 900000, lesson_limit: null, duration_days: 30 },
  { name: "Пакет 12 занятий", billing_type: "lessons", price: 600000, lesson_limit: 12, duration_days: 45 },
  { name: "Пакет 8 занятий", billing_type: "lessons", price: 440000, lesson_limit: 8, duration_days: 30 },
];

export const VOCAB = {
  "Food & Drinks": [
    ["apple", "яблоко", "/ˈæp.əl/", "I eat an apple every morning.", "noun"],
    ["bread", "хлеб", "/bred/", "Fresh bread smells great.", "noun"],
    ["cheese", "сыр", "/tʃiːz/", "Would you like some cheese?", "noun"],
    ["juice", "сок", "/dʒuːs/", "Orange juice, please.", "noun"],
    ["delicious", "вкусный", "/dɪˈlɪʃ.əs/", "This soup is delicious!", "adjective"],
    ["to cook", "готовить", "/kʊk/", "My mother cooks plov on Sundays.", "verb"],
    ["vegetables", "овощи", "/ˈvedʒ.tə.bəlz/", "Eat more vegetables.", "noun"],
    ["breakfast", "завтрак", "/ˈbrek.fəst/", "Breakfast is at 8 a.m.", "noun"],
    ["to order", "заказывать", "/ˈɔː.dər/", "Let's order a pizza.", "verb"],
    ["spicy", "острый", "/ˈspaɪ.si/", "I don't like spicy food.", "adjective"],
    ["meal", "приём пищи", "/mɪəl/", "Dinner is my favourite meal.", "noun"],
    ["bill", "счёт", "/bɪl/", "Can we have the bill, please?", "noun"],
  ],
  "Travel": [
    ["luggage", "багаж", "/ˈlʌɡ.ɪdʒ/", "Where can I collect my luggage?", "noun"],
    ["boarding pass", "посадочный талон", "/ˈbɔː.dɪŋ pɑːs/", "Show your boarding pass.", "noun"],
    ["to depart", "отправляться", "/dɪˈpɑːt/", "The train departs at noon.", "verb"],
    ["delay", "задержка", "/dɪˈleɪ/", "There is a two-hour delay.", "noun"],
    ["destination", "пункт назначения", "/ˌdes.tɪˈneɪ.ʃən/", "Samarkand is a popular destination.", "noun"],
    ["sightseeing", "осмотр достопримечательностей", "/ˈsaɪtˌsiː.ɪŋ/", "We went sightseeing in Bukhara.", "noun"],
    ["to book", "бронировать", "/bʊk/", "I booked a hotel online.", "verb"],
    ["passport", "паспорт", "/ˈpɑːs.pɔːt/", "Don't forget your passport.", "noun"],
    ["abroad", "за границей", "/əˈbrɔːd/", "She studies abroad.", "adverb"],
    ["journey", "путешествие", "/ˈdʒɜː.ni/", "Have a nice journey!", "noun"],
  ],
  "IELTS: Environment": [
    ["pollution", "загрязнение", "/pəˈluː.ʃən/", "Air pollution is a serious issue.", "noun"],
    ["sustainable", "устойчивый", "/səˈsteɪ.nə.bəl/", "We need sustainable energy.", "adjective"],
    ["to deplete", "истощать", "/dɪˈpliːt/", "Fishing depletes ocean resources.", "verb"],
    ["emission", "выброс", "/iˈmɪʃ.ən/", "Carbon emissions keep rising.", "noun"],
    ["renewable", "возобновляемый", "/rɪˈnjuː.ə.bəl/", "Solar power is renewable.", "adjective"],
    ["habitat", "среда обитания", "/ˈhæb.ɪ.tæt/", "Forests are habitats for many species.", "noun"],
    ["drought", "засуха", "/draʊt/", "The Aral Sea region suffers from drought.", "noun"],
    ["to mitigate", "смягчать", "/ˈmɪt.ɪ.ɡeɪt/", "Trees mitigate climate change.", "verb"],
  ],
};
