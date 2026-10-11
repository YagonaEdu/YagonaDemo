/* Jamoa a'zolari — shu ro'yxatni tahrirlang. todo: true bo'lgan kartalar to'ldirilmagan deb belgilanadi.
   role va skills: oddiy satr yoki { uz, ru, en } tarjimalari. */
window.TEAM = [
  { name: "A’zamov Saidkamolxon", role: { uz: "Dasturchi", ru: "Разработчик", en: "Developer" },
    skills: ["Python", "Django REST", "React", "React Native"], links: {} },
  { name: "Kadirov Xotam", role: { uz: "Dizayner", ru: "Дизайнер", en: "Designer" },
    skills: ["Figma", "UI/UX", { uz: "Dizayn-tizim", ru: "Дизайн-система", en: "Design system" }], links: {} },
  { name: "Ganiev Murodxon", role: { uz: "Loyiha menejeri", ru: "Менеджер проекта", en: "Project manager" },
    skills: [{ uz: "Loyiha boshqaruvi", ru: "Управление проектом", en: "Project management" }, { uz: "Rejalashtirish", ru: "Планирование", en: "Planning" }], links: {} },
];
(function () {
  var root = document.getElementById("team");
  if (!root) return;
  function tr(v) { return typeof v === "string" ? v : (v[window.YLANG || "uz"] || v.uz); }
  function initials(n) { var p = n.replace(/[\[\]]/g, "").split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + ((p[1] || "")[0] || "")).toUpperCase(); }
  function render() {
    root.innerHTML = window.TEAM.map(function (m) {
      var links = Object.keys(m.links || {}).map(function (k) { return '<a href="' + m.links[k] + '" target="_blank" rel="noopener">' + k + ' ↗</a>'; }).join("");
      return '<article class="member' + (m.todo ? " todo" : "") + '">' +
        '<div class="avatar" aria-hidden="true">' + initials(m.name) + '</div>' +
        '<div><h3>' + m.name + '</h3><div class="role">' + tr(m.role) + '</div></div>' +
        '<div class="chips">' + m.skills.map(function (s) { return '<span class="chip">' + tr(s) + '</span>'; }).join("") + '</div>' +
        (links ? '<div class="links">' + links + '</div>' : "") + '</article>';
    }).join("");
  }
  render();
  document.addEventListener("yagona:lang", render);
})();
