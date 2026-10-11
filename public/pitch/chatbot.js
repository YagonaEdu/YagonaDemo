/* Yagona yordamchisi — savol-javob namunalari asosidagi chatbot.
   Savol kalit so'zlar bo'yicha eng yaqin javobga moslanadi (uch tilda ham).
   Javob tanlangan tilda beriladi: window.YLANG = uz | ru | en (i18n.js). */
(function () {
  var QA = [
    { q: { uz: "Yagona nima?", ru: "Что такое Yagona?", en: "What is Yagona?" },
      k: ["nima", "yagona", "haqida", "platforma", "что", "платформ", "what", "about", "platform"],
      a: { uz: "Yagona — o‘quv markazlari uchun yagona platforma: CRM, o‘quvchilar, guruhlar, dars jadvali, davomat va to‘lovlar bitta tizimda. Xodimlar veb-kabinetda, o‘quvchi, o‘qituvchi va markaz egasi esa mobil ilovada ishlaydi.",
           ru: "Yagona — единая платформа для учебных центров: CRM, ученики, группы, расписание занятий, посещаемость и оплаты в одной системе. Сотрудники работают в веб-кабинете, а ученик, преподаватель и владелец центра — в мобильном приложении.",
           en: "Yagona is a single platform for learning centers: CRM, students, groups, class schedules, attendance and payments in one system. Staff work in the web dashboard; students, teachers and the center owner use the mobile app." } },
    { q: { uz: "Qaysi muammoni hal qiladi?", ru: "Какую проблему решает?", en: "What problem does it solve?" },
      k: ["muammo", "hal", "nega", "kerak", "проблем", "решает", "зачем", "problem", "solve", "why"],
      a: { uz: "Markazlar arizalarni chatlarda, jadvalni Excelda, to‘lovlarni daftarda yuritadi. Arizalar yo‘qoladi, qarzlar kuzatilmaydi, egasi aniq raqamlarni ko‘rmaydi. Yagona bularni bitta tizimga jamlaydi.",
           ru: "Центры ведут заявки в чатах, расписание — в Excel, оплаты — в тетради. Заявки теряются, долги не отслеживаются, владелец не видит точных цифр. Yagona объединяет всё это в одну систему.",
           en: "Centers keep leads in chats, the schedule in Excel and payments in a notebook. Leads get lost, debts go untracked, and the owner can’t see accurate numbers. Yagona brings it all into one system." } },
    { q: { uz: "Kimlar uchun?", ru: "Для кого?", en: "Who is it for?" },
      k: ["kim", "kimlar", "rol", "egasi", "admin", "o‘qituvchi", "oqituvchi", "o'qituvchi", "для кого", "роли", "владел", "преподав", "who", "role", "owner", "teacher"],
      a: { uz: "Beshta rol uchun: markaz egasi, administrator, buxgalter, o‘qituvchi va o‘quvchi. Ota-onalar hisobotni ilova, Telegram yoki SMS orqali oladi.",
           ru: "Для пяти ролей: владелец центра, администратор, бухгалтер, преподаватель и ученик. Родители получают отчёты через приложение, Telegram или SMS.",
           en: "For five roles: center owner, administrator, accountant, teacher and student. Parents get reports via the app, Telegram or SMS." } },
    { q: { uz: "Raqobatchilardan farqi?", ru: "Чем отличается от конкурентов?", en: "How is it different from competitors?" },
      k: ["farq", "raqobat", "modme", "crm", "boshqa", "excel", "отлич", "конкурент", "differ", "competitor"],
      a: { uz: "Ko‘p CRM faqat administratorni yopadi. Yagona barcha rollarni bitta bazada bog‘laydi: o‘quvchi va o‘qituvchi uchun o‘z ilovalari, QR-davomat, «Dars» rejimi, ota-onalarga hisobot va egasi uchun analitika.",
           ru: "Большинство CRM закрывают только работу администратора. Yagona связывает все роли в одной базе: отдельные приложения для ученика и преподавателя, QR-посещаемость, режим «Урок», отчёты родителям и аналитика для владельца.",
           en: "Most CRMs only cover the administrator. Yagona connects every role in one database: dedicated apps for students and teachers, QR attendance, “Lesson” mode, reports to parents and analytics for the owner." } },
    { q: { uz: "Qanday texnologiyalar?", ru: "Какие технологии?", en: "What’s the tech stack?" },
      k: ["texnolog", "stack", "django", "react", "backend", "texnika", "технолог", "стек", "tech"],
      a: { uz: "Backend: Python, Django REST Framework, PostgreSQL, Redis, Celery. Veb: React va Vite. Mobil: React Native va Expo. Dizayn: Figma.",
           ru: "Бэкенд: Python, Django REST Framework, PostgreSQL, Redis, Celery. Веб: React и Vite. Мобильные приложения: React Native и Expo. Дизайн: Figma.",
           en: "Backend: Python, Django REST Framework, PostgreSQL, Redis, Celery. Web: React and Vite. Mobile: React Native and Expo. Design: Figma." } },
    { q: { uz: "AI qayerda ishlatiladi?", ru: "Где используется AI?", en: "Where is AI used?" },
      k: ["ai", "sun’iy", "suniy", "intellekt", "ии", "model", "искусствен", "нейро", "artificial"],
      a: { uz: "Ketish xavfi bor o‘quvchilarni oldindan aniqlash, kassa prognozi, ertalabki qisqa hisobot, bilimlar xaritasi va daftar suratini tekshirishda yordam. Boshida qoidalar asosida, ma’lumot to‘plangach — ML-modellar.",
           ru: "Раннее выявление учеников с риском ухода, прогноз кассы, короткий утренний отчёт, карта знаний и помощь в проверке фото тетради. Сначала на правилах, после накопления данных — ML-модели.",
           en: "Spotting at-risk students early, cash forecasting, a short morning report, a knowledge map and help grading notebook photos. Rule-based at first, then ML models once data is collected." } },
    { q: { uz: "Ma’lumotlar xavfsizmi?", ru: "Данные в безопасности?", en: "Is the data secure?" },
      k: ["xavfsiz", "maxfiy", "ma’lumot", "malumot", "himoya", "безопас", "данн", "защит", "secur", "safe", "data"],
      a: { uz: "Har bir markaz ma’lumotlari alohida: server har bir so‘rovda foydalanuvchining shu markazga a’zoligini tekshiradi. Kirish JWT orqali, parollar Argon2 bilan himoyalangan.",
           ru: "Данные каждого центра изолированы: при каждом запросе сервер проверяет, что пользователь состоит в этом центре. Вход через JWT, пароли защищены Argon2.",
           en: "Each center’s data is isolated: on every request the server checks that the user belongs to that center. Sign-in uses JWT, and passwords are protected with Argon2." } },
    { q: { uz: "Narxi qancha?", ru: "Сколько стоит?", en: "How much does it cost?" },
      k: ["narx", "tarif", "pul", "qancha", "цена", "stoim", "сколько", "стоит", "тариф", "price", "cost", "pricing", "much"],
      a: { uz: "14 kunlik bepul sinov bor, keyin Start (kichik markazlar uchun) va Business (CRM + ilovalar) tariflari. Aniq narx markaz hajmiga qarab kelishiladi.",
           ru: "Есть 14-дневный бесплатный пробный период, затем тарифы Start (для небольших центров) и Business (CRM + приложения). Точная цена согласуется в зависимости от размера центра.",
           en: "There’s a 14-day free trial, then the Start plan (for small centers) and Business (CRM + apps). The exact price depends on the size of the center." } },
    { q: { uz: "Qayerda sinab ko‘rsam bo‘ladi?", ru: "Где можно попробовать?", en: "Where can I try it?" },
      k: ["demo", "sinab", "prototip", "ko‘rish", "korish", "kirish", "login", "демо", "попроб", "прототип", "try", "prototype"],
      a: { uz: "Onlayn prototip: yagona-demo.vercel.app — istalgan login va parol bilan kirish mumkin, masalan owner@registon.demo. Demo-video esa /demo sahifasida.",
           ru: "Онлайн-прототип: yagona-demo.vercel.app — войти можно с любым логином и паролем, например owner@registon.demo. Демо-видео — на странице /demo.",
           en: "Online prototype: yagona-demo.vercel.app — sign in with any login and password, for example owner@registon.demo. The demo video is on the /demo page." } },
    { q: { uz: "Hozir qaysi bosqichda?", ru: "На каком этапе проект?", en: "What stage is the project at?" },
      k: ["bosqich", "mvp", "roadmap", "xarita", "reja", "qachon", "этап", "когда", "план", "stage", "when"],
      a: { uz: "Idea va Prototype bosqichlari bajarildi: backend, veb-kabinet va onlayn demo tayyor. Hozir MVP: mobil ilovalar, to‘lov integratsiyasi va birinchi pilot markazlar.",
           ru: "Этапы Idea и Prototype пройдены: бэкенд, веб-кабинет и онлайн-демо готовы. Сейчас — MVP: мобильные приложения, интеграция платежей и первые пилотные центры.",
           en: "The Idea and Prototype stages are done: the backend, web dashboard and online demo are ready. Now we’re on the MVP: mobile apps, payment integration and the first pilot centers." } },
    { q: { uz: "API bormi?", ru: "Есть ли API?", en: "Is there an API?" },
      k: ["api", "integratsiya", "rest", "swagger", "интеграц", "integration"],
      a: { uz: "Ha, REST API (/api/v1) OpenAPI sxemasi va Swagger hujjati bilan. Markaz o‘z sayti yoki botidan ariza yuborishi, o‘quvchilar va jadvalni olishi mumkin.",
           ru: "Да, REST API (/api/v1) со схемой OpenAPI и документацией Swagger. Центр может отправлять заявки со своего сайта или бота, получать учеников и расписание.",
           en: "Yes, a REST API (/api/v1) with an OpenAPI schema and Swagger docs. A center can send leads from its own website or bot and fetch students and the schedule." } },
  ];
  var SUGG = [0, 3, 5, 7, 8];
  var UI = {
    uz: { fab: "Savol bering", title: "Yagona yordamchisi", sub: "Loyiha haqidagi savollarga javob beradi", close: "Yopish", ph: "Savolingizni yozing…", input: "Savol", send: "Yuborish",
          hello: "Assalomu alaykum! Men Yagona loyihasi haqidagi savollarga javob beraman. Savol tanlang yoki o‘zingiz yozing.",
          none: "Bu savolga hozircha javobim yo‘q. Quyidagi savollardan birini tanlang yoki Yagona, narx, AI, xavfsizlik yoki demo haqida so‘rang." },
    ru: { fab: "Задать вопрос", title: "Помощник Yagona", sub: "Отвечает на вопросы о проекте", close: "Закрыть", ph: "Напишите вопрос…", input: "Вопрос", send: "Отправить",
          hello: "Здравствуйте! Я отвечаю на вопросы о проекте Yagona. Выберите вопрос или напишите свой.",
          none: "На этот вопрос у меня пока нет ответа. Выберите один из вопросов ниже или спросите о Yagona, цене, AI, безопасности или демо." },
    en: { fab: "Ask a question", title: "Yagona assistant", sub: "Answers questions about the project", close: "Close", ph: "Type your question…", input: "Question", send: "Send",
          hello: "Hello! I answer questions about the Yagona project. Pick a question or type your own.",
          none: "I don’t have an answer to that yet. Pick one of the questions below, or ask about Yagona, pricing, AI, security or the demo." },
  };
  function lang() { return UI[window.YLANG] ? window.YLANG : "uz"; }
  function ui() { return UI[lang()]; }

  function norm(s) { return String(s).toLowerCase().replace(/[‘’ʻ`']/g, "’"); }
  function answer(text) {
    var t = norm(text), best = null, score = 0;
    QA.forEach(function (item) {
      var s = 0;
      item.k.forEach(function (w) { if (t.indexOf(norm(w)) !== -1) s += 1; });
      ["uz", "ru", "en"].forEach(function (l) { if (norm(item.q[l]) === t) s += 5; });
      if (s > score) { score = s; best = item; }
    });
    return best ? best.a[lang()] : ui().none;
  }

  var fab = document.createElement("button");
  fab.className = "chat-fab"; fab.type = "button";
  fab.setAttribute("aria-expanded", "false");
  var box = document.createElement("div");
  box.className = "chat"; box.hidden = true; box.setAttribute("role", "dialog");
  box.innerHTML = '<header><div><b></b><small></small></div><button type="button">×</button></header>' +
    '<div class="chat-log" aria-live="polite"></div><div class="chat-sugg"></div>' +
    '<form><input id="chat-input" type="text" autocomplete="off"><button type="submit"></button></form>';
  document.body.appendChild(box); document.body.appendChild(fab);
  var log = box.querySelector(".chat-log"), sugg = box.querySelector(".chat-sugg"), form = box.querySelector("form"), input = box.querySelector("input");
  var asked = false;

  function add(text, who) { var d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; }
  function ask(text) { if (!text.trim()) return; asked = true; add(text, "me"); setTimeout(function () { add(answer(text), "bot"); }, 350); }

  function render() {
    var u = ui(), l = lang();
    fab.innerHTML = '<img src="/pitch/img/favicon.png" alt="">';
    fab.appendChild(document.createTextNode(u.fab));
    box.setAttribute("aria-label", u.title);
    box.querySelector("header b").textContent = u.title;
    box.querySelector("header small").textContent = u.sub;
    box.querySelector("header button").setAttribute("aria-label", u.close);
    input.placeholder = u.ph; input.setAttribute("aria-label", u.input);
    form.querySelector("button").textContent = u.send;
    sugg.innerHTML = "";
    SUGG.forEach(function (i) { var q = QA[i].q[l], b = document.createElement("button"); b.type = "button"; b.textContent = q; b.onclick = function () { ask(q); }; sugg.appendChild(b); });
    if (!asked) { log.innerHTML = ""; add(u.hello, "bot"); }
  }
  render();
  document.addEventListener("yagona:lang", render);

  function toggle(open) { box.hidden = !open; fab.setAttribute("aria-expanded", String(open)); if (open) input.focus(); }
  fab.onclick = function () { toggle(box.hidden); };
  box.querySelector("header button").onclick = function () { toggle(false); fab.focus(); };
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); input.value = ""; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) toggle(false); });
})();
