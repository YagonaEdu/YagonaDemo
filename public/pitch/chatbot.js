/* Yagona yordamchisi — savol-javob namunalari asosidagi chatbot.
   Savol kalit so'zlar bo'yicha eng yaqin javobga moslanadi. */
(function () {
  var QA = [
    { q: "Yagona nima?", k: ["nima", "yagona", "haqida", "platforma", "что"],
      a: "Yagona — o‘quv markazlari uchun yagona platforma: CRM, o‘quvchilar, guruhlar, dars jadvali, davomat va to‘lovlar bitta tizimda. Xodimlar veb-kabinetda, o‘quvchi, o‘qituvchi va direktor esa mobil ilovada ishlaydi." },
    { q: "Qaysi muammoni hal qiladi?", k: ["muammo", "hal", "nega", "kerak", "проблем"],
      a: "Markazlar arizalarni chatlarda, jadvalni Excelda, to‘lovlarni daftarda yuritadi. Arizalar yo‘qoladi, qarzlar kuzatilmaydi, direktor aniq raqamlarni ko‘rmaydi. Yagona bularni bitta tizimga jamlaydi." },
    { q: "Kimlar uchun?", k: ["kim", "kimlar", "rol", "egasi", "direktor", "admin", "o‘qituvchi", "oqituvchi", "o'qituvchi"],
      a: "To‘rtta rol uchun: direktor, administrator, o‘qituvchi va o‘quvchi. Ota-onalar hisobotni ilova, Telegram yoki SMS orqali oladi." },
    { q: "Raqobatchilardan farqi?", k: ["farq", "raqobat", "modme", "crm", "boshqa", "excel", "отлич"],
      a: "Ko‘p CRM faqat administratorni yopadi. Yagona barcha rollarni bitta bazada bog‘laydi: o‘quvchi va o‘qituvchi uchun o‘z ilovalari, QR-davomat, «Dars» rejimi, ota-onalarga hisobot va direktor uchun analitika." },
    { q: "Qanday texnologiyalar?", k: ["texnolog", "stack", "django", "react", "backend", "texnika"],
      a: "Backend: Python, Django REST Framework, PostgreSQL, Redis, Celery. Veb: React va Vite. Mobil: React Native va Expo. Dizayn: Figma." },
    { q: "AI qayerda ishlatiladi?", k: ["ai", "sun’iy", "suniy", "intellekt", "ии", "model"],
      a: "Ketish xavfi bor o‘quvchilarni oldindan aniqlash, kassa prognozi, ertalabki qisqa hisobot, bilimlar xaritasi va daftar suratini tekshirishda yordam. Boshida qoidalar asosida, ma’lumot to‘plangach — ML-modellar." },
    { q: "Ma’lumotlar xavfsizmi?", k: ["xavfsiz", "maxfiy", "ma’lumot", "malumot", "himoya", "безопас"],
      a: "Har bir markaz ma’lumotlari alohida: server har bir so‘rovda foydalanuvchining shu markazga a’zoligini tekshiradi. Kirish JWT orqali, parollar Argon2 bilan himoyalangan." },
    { q: "Narxi qancha?", k: ["narx", "tarif", "pul", "qancha", "цена", "stoim"],
      a: "14 kunlik bepul sinov bor, keyin Start (kichik markazlar uchun) va Business (CRM + ilovalar) tariflari. Aniq narx markaz hajmiga qarab kelishiladi." },
    { q: "Qayerda sinab ko‘rsam bo‘ladi?", k: ["demo", "sinab", "prototip", "ko‘rish", "korish", "kirish", "login"],
      a: "Onlayn prototip: yagona-demo.vercel.app — istalgan login va parol bilan kirish mumkin, masalan owner@registon.demo. Demo-video esa /demo sahifasida." },
    { q: "Hozir qaysi bosqichda?", k: ["bosqich", "mvp", "roadmap", "xarita", "reja", "qachon"],
      a: "Idea va Prototype bosqichlari bajarildi: backend, veb-kabinet va onlayn demo tayyor. Hozir MVP: mobil ilovalar, to‘lov integratsiyasi va birinchi pilot markazlar." },
    { q: "API bormi?", k: ["api", "integratsiya", "rest", "swagger"],
      a: "Ha, REST API (/api/v1) OpenAPI sxemasi va Swagger hujjati bilan. Markaz o‘z sayti yoki botidan ariza yuborishi, o‘quvchilar va jadvalni olishi mumkin." },
  ];
  var SUGG = ["Yagona nima?", "Raqobatchilardan farqi?", "AI qayerda ishlatiladi?", "Narxi qancha?", "Qayerda sinab ko‘rsam bo‘ladi?"];

  function norm(s) { return String(s).toLowerCase().replace(/[‘’ʻ`']/g, "’"); }
  function answer(text) {
    var t = norm(text), best = null, score = 0;
    QA.forEach(function (item) {
      var s = 0;
      item.k.forEach(function (w) { if (t.indexOf(norm(w)) !== -1) s += 1; });
      if (norm(item.q) === t) s += 5;
      if (s > score) { score = s; best = item; }
    });
    return best ? best.a : "Bu savolga hozircha javobim yo‘q. Quyidagi savollardan birini tanlang yoki Yagona, narx, AI, xavfsizlik yoki demo haqida so‘rang.";
  }

  var fab = document.createElement("button");
  fab.className = "chat-fab"; fab.type = "button";
  fab.setAttribute("aria-expanded", "false");
  fab.innerHTML = '<img src="/pitch/img/favicon.png" alt="">Savol bering';
  var box = document.createElement("div");
  box.className = "chat"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Yagona yordamchisi");
  box.innerHTML = '<header><div><b>Yagona yordamchisi</b><small>Loyiha haqidagi savollarga javob beradi</small></div><button type="button" aria-label="Yopish">×</button></header>' +
    '<div class="chat-log" aria-live="polite"></div><div class="chat-sugg"></div>' +
    '<form><input id="chat-input" type="text" placeholder="Savolingizni yozing…" autocomplete="off" aria-label="Savol"><button type="submit">Yuborish</button></form>';
  document.body.appendChild(box); document.body.appendChild(fab);
  var log = box.querySelector(".chat-log"), sugg = box.querySelector(".chat-sugg"), form = box.querySelector("form"), input = box.querySelector("input");

  function add(text, who) { var d = document.createElement("div"); d.className = "msg " + who; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; }
  function ask(text) { if (!text.trim()) return; add(text, "me"); setTimeout(function () { add(answer(text), "bot"); }, 350); }
  SUGG.forEach(function (s) { var b = document.createElement("button"); b.type = "button"; b.textContent = s; b.onclick = function () { ask(s); }; sugg.appendChild(b); });
  add("Assalomu alaykum! Men Yagona loyihasi haqidagi savollarga javob beraman. Savol tanlang yoki o‘zingiz yozing.", "bot");

  function toggle(open) { box.hidden = !open; fab.setAttribute("aria-expanded", String(open)); if (open) input.focus(); }
  fab.onclick = function () { toggle(box.hidden); };
  box.querySelector("header button").onclick = function () { toggle(false); fab.focus(); };
  form.addEventListener("submit", function (e) { e.preventDefault(); ask(input.value); input.value = ""; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !box.hidden) toggle(false); });
})();
