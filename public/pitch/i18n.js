/* Til almashtirgich: O‘zbekcha (asosiy matn HTMLda), Русский, English.
   Tarjimalar elementning o‘zida: data-ru="…" data-en="…".
   Atributlar uchun: data-i18n-attrs="alt" va data-ru-alt="…" data-en-alt="…".
   Tanlangan til localStorage'da saqlanadi; ?lang=ru|en|uz ham ishlaydi. */
(function () {
  var LANGS = ["uz", "ru", "en"], KEY = "yagona-lang";

  function initial() {
    try {
      var q = new URLSearchParams(location.search).get("lang");
      if (LANGS.indexOf(q) !== -1) return q;
      var s = localStorage.getItem(KEY);
      if (LANGS.indexOf(s) !== -1) return s;
    } catch (e) {}
    return "uz";
  }

  function apply(lang) {
    document.querySelectorAll("[data-ru],[data-en]").forEach(function (el) {
      if (!el.hasAttribute("data-uz")) el.setAttribute("data-uz", el.innerHTML);
      var v = el.getAttribute("data-" + lang);
      el.innerHTML = v !== null ? v : el.getAttribute("data-uz");
    });
    document.querySelectorAll("[data-i18n-attrs]").forEach(function (el) {
      el.getAttribute("data-i18n-attrs").split(",").forEach(function (a) {
        if (!el.hasAttribute("data-uz-" + a)) el.setAttribute("data-uz-" + a, el.getAttribute(a) || "");
        var v = el.getAttribute("data-" + lang + "-" + a);
        el.setAttribute(a, v !== null ? v : el.getAttribute("data-uz-" + a));
      });
    });
    document.documentElement.lang = lang;
    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    window.YLANG = lang;
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent("yagona:lang", { detail: lang }));
  }

  var bar = document.querySelector(".top .wrap");
  if (bar) {
    var g = document.createElement("div");
    g.className = "lang"; g.setAttribute("role", "group"); g.setAttribute("aria-label", "Til · Язык · Language");
    LANGS.forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button"; b.setAttribute("data-lang", l); b.textContent = l.toUpperCase();
      b.onclick = function () { apply(l); };
      g.appendChild(b);
    });
    bar.insertBefore(g, bar.querySelector(":scope > .btn"));
  }

  window.YLANG = "uz";
  apply(initial());
})();
