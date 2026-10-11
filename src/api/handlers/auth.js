/* Auth and profile. Any identifier + any password logs in: a keyword in the identifier
   picks which demo account (and so which cabinet) opens. */
import { findById, patch, table } from "../db";
import { invalid, MockHttpError } from "../http";
import { route } from "../router";
import { tokenFor } from "../context";
import { membershipOut, userOut } from "../serializers";

/* The platform super admin is not part of the demo: no login opens that cabinet. */
const KEYWORDS = [
  [/teacher|ustoz|o.?qituvchi|учител|препод/, "teacher@registon.demo"],
  [/admin|recep|resep|ресеп|админ|администр/, "admin@registon.demo"],
  [/account|buh|бух/, "accountant@registon.demo"],
  [/student|o.?quvchi|ученик|студент/, "student@registon.demo"],
];

function demoUserFor(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  const users = table("users").filter((u) => !u.is_superuser);
  const digits = value.replace(/\D/g, "");
  // An exact email/phone of any demo user logs in as that user.
  const exact = users.find(
    (u) => (u.email && u.email.toLowerCase() === value) || (digits.length >= 9 && u.phone && u.phone.replace(/\D/g, "").endsWith(digits.slice(-9))),
  );
  if (exact) return exact;
  for (const [pattern, email] of KEYWORDS) {
    if (pattern.test(value)) return users.find((u) => u.email === email);
  }
  // A bare phone number is how students usually sign in.
  if (/^\+?[\d\s()-]{9,}$/.test(value)) return users.find((u) => u.email === "student@registon.demo");
  return users.find((u) => u.email === "owner@registon.demo");
}

function currentUser(ctx) {
  if (!ctx.user) throw new MockHttpError(401, { detail: "Требуется авторизация." });
  return ctx.user;
}

route("POST", "/auth/token", (ctx) => {
  const { identifier, password } = ctx.body || {};
  if (!String(identifier || "").trim() || !password) {
    throw new MockHttpError(401, { detail: "Неверный телефон, email или пароль." });
  }
  const user = demoUserFor(identifier);
  return {
    access: tokenFor(user.id),
    refresh: `demo-refresh.${user.id}`,
    user: userOut(user),
  };
});

route("POST", "/auth/refresh", (ctx) => {
  const refresh = String(ctx.body?.refresh || "");
  const user = findById("users", refresh.replace("demo-refresh.", ""));
  if (!user) throw new MockHttpError(401, { detail: "Token is invalid or expired" });
  return { access: tokenFor(user.id), refresh };
});

route("POST", "/auth/logout", () => ({ status: 204, data: null }));

route("GET", "/me", (ctx) => userOut(currentUser(ctx)));

route("PATCH", "/me", (ctx) => {
  const user = currentUser(ctx);
  const allowed = ["first_name", "last_name", "email", "phone", "avatar"];
  const changes = Object.fromEntries(Object.entries(ctx.body || {}).filter(([key]) => allowed.includes(key)));
  if ("email" in changes) {
    const email = String(changes.email || "").trim().toLowerCase();
    if (email && table("users").some((u) => u.id !== user.id && u.email === email)) {
      throw invalid({ email: ["Этот email уже используется."] });
    }
    changes.email = email;
  }
  return userOut(patch("users", user.id, changes));
});

route("POST", "/me/password", (ctx) => {
  currentUser(ctx);
  const { current_password: current, new_password: next } = ctx.body || {};
  if (!current) throw invalid({ current_password: ["Текущий пароль неверен."] });
  if (!next || String(next).length < 8) throw invalid({ new_password: ["Пароль должен быть не короче 8 символов."] });
  if (current === next) throw invalid({ new_password: ["Новый пароль должен отличаться от текущего."] });
  return { detail: "Пароль обновлён." };
});

route("POST", "/me/photo", (ctx) => {
  const user = currentUser(ctx);
  const file = ctx.body?.file || ctx.body?.photo;
  if (!file?.url) throw invalid({ file: ["Прикрепите фото."] });
  return userOut(patch("users", user.id, { photo_url: file.url }));
});

route("DELETE", "/me/photo", (ctx) => userOut(patch("users", currentUser(ctx).id, { photo_url: null })));

route("GET", "/me/tenants", (ctx) => {
  const user = currentUser(ctx);
  return table("memberships")
    .filter((m) => m.user === user.id && m.is_active)
    .map(membershipOut);
});
