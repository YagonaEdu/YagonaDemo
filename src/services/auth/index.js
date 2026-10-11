import { APP_MODES, ROLES } from "@/constants";
import {
  api,
  clearSession,
  getSession,
  setSession,
  setSessionSilent,
} from "@/services/api/client";

const LAST_STUDENT_TENANT_KEY = "yagona-last-student-tenant";

export function rememberStudentTenant(tenantId) {
  try {
    localStorage.setItem(LAST_STUDENT_TENANT_KEY, String(tenantId || ""));
  } catch {
    /* storage unavailable */
  }
}

/** Keep the last centre the student chose if it is still in the fresh list, else the first. */
export function pickRememberedMembership(list) {
  let last = "";
  try {
    last = localStorage.getItem(LAST_STUDENT_TENANT_KEY) || "";
  } catch {
    /* storage unavailable */
  }
  return list.find((item) => String(item.tenant_id) === last) || list[0];
}

const LAST_STAFF_TENANT_KEY = "yagona-last-staff-tenant";

/** Remember (or forget, with "") the centre a staff member opens straight after login. */
export function rememberStaffTenant(tenantId) {
  try {
    if (tenantId) localStorage.setItem(LAST_STAFF_TENANT_KEY, String(tenantId));
    else localStorage.removeItem(LAST_STAFF_TENANT_KEY);
  } catch {
    /* storage unavailable */
  }
}

function rememberedStaffTenant() {
  try {
    return localStorage.getItem(LAST_STAFF_TENANT_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Step 1 of login: check the credentials and load the user's centres.
 * Tokens are kept silently, so the app does not switch to the cabinet yet.
 */
export async function authenticate(identifier, password) {
  const tokens = await api.post(
    "/auth/token",
    { identifier, password },
    { tenant: false },
  );

  // Keep tokens available for /me/tenants without flipping the UI into "authed"
  // mid-flight (that used to race with AuthedLoginRedirect → clearSession).
  setSessionSilent({
    access: tokens.access,
    refresh: tokens.refresh,
  });

  let memberships;
  try {
    memberships = await api.get("/me/tenants", { tenant: false });
  } catch (err) {
    clearSession();
    throw err;
  }

  const staffMemberships = (memberships || []).filter((item) => item.role !== ROLES.STUDENT);
  const studentMemberships = (memberships || []).filter((item) => item.role === ROLES.STUDENT);
  const isSuper = Boolean(tokens.user?.is_superuser);

  if (!staffMemberships.length && !studentMemberships.length && !isSuper) {
    clearSession();
    const error = new Error("Нет доступа: учётная запись не привязана ни к одному учебному центру.");
    error.code = "no_membership";
    throw error;
  }

  return { tokens, staffMemberships, studentMemberships, isSuper };
}

/** A staff member of several centres who has not pinned one picks the centre first. */
export function needsCenterChoice(auth) {
  if (auth.isSuper || auth.staffMemberships.length < 2) return false;
  const pinned = rememberedStaffTenant();
  return !auth.staffMemberships.some((item) => String(item.tenant_id) === pinned);
}

/**
 * Step 2 of login: open the right cabinet. `chosen` is the staff centre picked on the
 * centre screen; without it the remembered centre (or the first one) opens.
 */
export function startSession(auth, chosen = null) {
  const { tokens, staffMemberships, studentMemberships, isSuper } = auth;

  if (!staffMemberships.length && !isSuper) {
    const membership = pickRememberedMembership(studentMemberships);
    rememberStudentTenant(membership.tenant_id);
    setSession({
      access: tokens.access,
      refresh: tokens.refresh,
      user: tokens.user,
      memberships: studentMemberships,
      tenantId: String(membership.tenant_id),
      tenantSlug: membership.tenant_slug || "",
      mode: APP_MODES.STUDENT,
    });
    return { mode: APP_MODES.STUDENT, memberships: studentMemberships, membership };
  }

  if (isSuper) {
    const membership = staffMemberships[0] || null;
    setSession({
      access: tokens.access,
      refresh: tokens.refresh,
      user: tokens.user,
      memberships: staffMemberships,
      tenantId: membership?.tenant_id || "",
      tenantSlug: membership?.tenant_slug || "",
      mode: APP_MODES.SUPER_ADMIN,
    });
    return { mode: APP_MODES.SUPER_ADMIN, memberships: staffMemberships, membership };
  }

  const pinned = rememberedStaffTenant();
  const membership =
    chosen ||
    staffMemberships.find((item) => String(item.tenant_id) === pinned) ||
    staffMemberships[0];
  setSession({
    access: tokens.access,
    refresh: tokens.refresh,
    user: tokens.user,
    memberships: staffMemberships,
    tenantId: membership.tenant_id,
    tenantSlug: membership.tenant_slug || "",
    mode: APP_MODES.EDUCATION_ADMIN,
  });
  return { mode: APP_MODES.EDUCATION_ADMIN, memberships: staffMemberships, membership };
}

export async function login(identifier, password) {
  return startSession(await authenticate(identifier, password));
}

export async function logout() {
  const session = getSession();
  try {
    if (session.refresh) {
      await api.post("/auth/logout", { refresh: session.refresh }, { tenant: false });
    }
  } catch {
    /* local logout still */
  }
  clearSession();
}

export function currentMembership(session = getSession()) {
  return (
    session.memberships.find((item) => item.tenant_id === session.tenantId) ||
    session.memberships[0] ||
    null
  );
}

export function canAccessSuperAdmin(session = getSession()) {
  return Boolean(session.access && session.user?.is_superuser);
}
