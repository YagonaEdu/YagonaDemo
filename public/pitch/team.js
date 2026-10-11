/* Jamoa a'zolari — shu ro'yxatni tahrirlang. todo: true bo'lgan kartalar to'ldirilmagan deb belgilanadi. */
window.TEAM = [
  { name: "A’zamov Saidkamolxon", role: "Dasturchi", skills: ["Python", "Django REST", "React", "React Native"], links: { GitHub: "https://github.com/SaidkamolA" } },
  { name: "Kadirov Xotam", role: "Dizayner", skills: ["Figma", "UI/UX", "Dizayn-tizim"], links: {} },
  { name: "Ganiev Murodxon", role: "Loyiha menejeri", skills: ["Loyiha boshqaruvi", "Rejalashtirish"], links: {} },
];
(function () {
  var root = document.getElementById("team");
  if (!root) return;
  function initials(n) { var p = n.replace(/[\[\]]/g, "").split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + ((p[1] || "")[0] || "")).toUpperCase(); }
  root.innerHTML = window.TEAM.map(function (m) {
    var links = Object.keys(m.links || {}).map(function (k) { return '<a href="' + m.links[k] + '" target="_blank" rel="noopener">' + k + ' ↗</a>'; }).join("");
    return '<article class="member' + (m.todo ? " todo" : "") + '">' +
      '<div class="avatar" aria-hidden="true">' + initials(m.name) + '</div>' +
      '<div><h3>' + m.name + '</h3><div class="role">' + m.role + '</div></div>' +
      '<div class="chips">' + m.skills.map(function (s) { return '<span class="chip">' + s + '</span>'; }).join("") + '</div>' +
      (links ? '<div class="links">' + links + '</div>' : "") + '</article>';
  }).join("");
})();
