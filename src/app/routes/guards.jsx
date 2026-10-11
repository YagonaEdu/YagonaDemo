import { Suspense, useEffect } from "react";
import { Navigate } from "react-router-dom";
import PageFallback from "@/components/layout/PageFallback";
import { clearSession } from "@/services/api/client";
import { canAccessSuperAdmin, currentMembership } from "@/services/auth";
import {
  educationHomePath,
  findMembershipBySlug,
  parseEducationSlug,
  resolveAuthedHome,
} from "@/utils/routes";
import { canAccessEducationSegment, isTeacherRole } from "@/utils/roleAccess";

/** Lazy screen with the shared loading placeholder. */
export function LazyPage({ Page }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  );
}

function routeMembership(session) {
  return findMembershipBySlug(session, parseEducationSlug(window.location.pathname)) || currentMembership(session);
}

/** Sends a role that may not open this cabinet section back to its home. */
export function RoleGuard({ session, segment, children }) {
  const membership = routeMembership(session);
  const role = membership?.role || "owner";
  if (!canAccessEducationSegment(role, segment)) {
    return <Navigate to={educationHomePath(membership?.tenant_slug || "")} replace />;
  }
  return children;
}

/** Same URL, different screen for teachers (their cabinet has its own pages). */
export function TeacherSwitch({ session, teacher, children }) {
  return isTeacherRole(routeMembership(session)?.role || "") ? teacher : children;
}

/** Platform screens are for super admins only. */
export function SuperGuard({ session, home = false, children }) {
  if (canAccessSuperAdmin(session)) return children;
  return <Navigate to={home ? resolveAuthedHome(session) || "/login" : "/login"} replace />;
}

export function RootRedirect({ session }) {
  const home = resolveAuthedHome(session);

  useEffect(() => {
    if (home) return;
    if (!session.access || !session.user) return;
    if (session.user.is_superuser) return;
    if (!Array.isArray(session.memberships) || session.memberships.length > 0) return;
    clearSession();
  }, [home, session.access, session.user, session.memberships]);

  return <Navigate to={home || "/login"} replace />;
}

export function AuthedLoginRedirect({ session }) {
  const home = resolveAuthedHome(session);
  if (home && home !== "/login") return <Navigate to={home} replace />;
  return null;
}
