import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { APP_MODES } from "@/constants";
import { setTranslatedArea } from "@/i18n";
import { clearSession, setSession } from "@/services/api/client";
import { currentMembership, logout as doLogout } from "@/services/auth";
import {
  educationHomePath,
  findMembershipBySlug,
  parseEducationSlug,
  parseEducationSubdomain,
} from "@/utils/routes";
import { GuestRoutes, StaffRoutes, StudentRoutes } from "./routes";

/* Session plumbing (tenant sync, translated areas, logout). Routes live in ./routes. */
export default function App() {
  const session = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const authed = Boolean(session.access && session.user);

  const urlSlug = parseEducationSlug(location.pathname);
  const hostSlug = parseEducationSubdomain(window.location.hostname);
  const activeSlug = urlSlug || hostSlug;

  // Login and the staff cabinets (teacher, reception, owner, accountant) are translated
  // (UZ / RU / EN); student and platform screens stay Russian.
  const areaMembership = authed
    ? findMembershipBySlug(session, activeSlug) || currentMembership(session)
    : null;
  setTranslatedArea(
    !authed ||
      (session.mode !== APP_MODES.STUDENT &&
        !location.pathname.startsWith("/super") &&
        ["teacher", "admin", "owner", "accountant"].includes(areaMembership?.role)),
  );

  useEffect(() => {
    const onAuthExpired = () => {
      navigate("/login", { replace: true });
    };
    window.addEventListener("yagona-auth-expired", onAuthExpired);
    return () => window.removeEventListener("yagona-auth-expired", onAuthExpired);
  }, [navigate]);

  useEffect(() => {
    if (session.access && !session.user) {
      clearSession();
    }
  }, [session.access, session.user]);

  const membershipIdsKey = (session.memberships || [])
    .map((item) => `${item.id}:${item.tenant_slug}`)
    .join("|");

  useEffect(() => {
    if (!authed || !activeSlug || session.mode === APP_MODES.STUDENT) return;
    const membership = findMembershipBySlug(session, activeSlug);
    if (membership) {
      const needsSync =
        String(membership.tenant_id) !== String(session.tenantId || "") ||
        session.mode !== APP_MODES.EDUCATION_ADMIN ||
        String(session.tenantSlug || "").toLowerCase() !== activeSlug;
      if (needsSync) {
        setSession({
          tenantId: String(membership.tenant_id),
          tenantSlug: activeSlug,
          mode: APP_MODES.EDUCATION_ADMIN,
        });
      }
      return;
    }
    if (
      session.user?.is_superuser &&
      String(session.tenantSlug || "").toLowerCase() === activeSlug &&
      session.tenantId &&
      session.mode !== APP_MODES.EDUCATION_ADMIN
    ) {
      setSession({ mode: APP_MODES.EDUCATION_ADMIN });
    }
    // membershipIdsKey tracks membership identity without depending on array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authed,
    activeSlug,
    session.mode,
    session.tenantId,
    session.tenantSlug,
    session.user?.is_superuser,
    membershipIdsKey,
  ]);

  useEffect(() => {
    if (!authed || !hostSlug || urlSlug || session.mode === APP_MODES.STUDENT) return;
    if (location.pathname === "/" || location.pathname.startsWith("/login")) {
      navigate(educationHomePath(hostSlug), { replace: true });
    }
  }, [authed, hostSlug, urlSlug, location.pathname, navigate, session.mode]);

  async function onLogout() {
    await doLogout();
    navigate("/login", { replace: true });
  }

  if (!authed) return <GuestRoutes />;
  if (session.mode === APP_MODES.STUDENT) return <StudentRoutes session={session} onLogout={onLogout} />;
  return <StaffRoutes session={session} onLogout={onLogout} />;
}
