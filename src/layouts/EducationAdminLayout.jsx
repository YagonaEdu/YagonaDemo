import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import ReceptionShell from "@/layouts/ReceptionShell";
import TeacherShell from "@/layouts/TeacherShell";
import { APP_MODES } from "@/constants";
import { setSession } from "@/services/api/client";
import { educationHomePath, findMembershipBySlug } from "@/utils/routes";

import "@/styles/teacher.css";
import "@/styles/teacher-learning.css";

export default function EducationAdminLayout({ session, onLogout }) {
  const { tenantSlug = "" } = useParams();
  const slug = String(tenantSlug).toLowerCase();
  const membership = findMembershipBySlug(session, slug);
  const superInCenter =
    session.user?.is_superuser &&
    session.tenantId &&
    String(session.tenantSlug || "").toLowerCase() === slug;

  const membershipId = membership?.id || "";
  const membershipTenantId = membership ? String(membership.tenant_id) : "";

  useEffect(() => {
    if (membershipId && membershipTenantId) {
      const needsSync =
        membershipTenantId !== String(session.tenantId || "") ||
        session.mode !== APP_MODES.EDUCATION_ADMIN ||
        String(session.tenantSlug || "").toLowerCase() !== slug;
      if (needsSync) {
        setSession({
          tenantId: membershipTenantId,
          tenantSlug: slug,
          mode: APP_MODES.EDUCATION_ADMIN,
        });
      }
      return;
    }
    if (superInCenter && session.mode !== APP_MODES.EDUCATION_ADMIN) {
      setSession({ mode: APP_MODES.EDUCATION_ADMIN });
    }
  }, [
    membershipId,
    membershipTenantId,
    superInCenter,
    slug,
    session.mode,
    session.tenantId,
    session.tenantSlug,
  ]);

  if (!membership && !superInCenter) {
    if (session.memberships?.length) {
      return <Navigate to={educationHomePath(session.memberships[0].tenant_slug)} replace />;
    }
    if (session.user?.is_superuser) {
      return <Navigate to="/super" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  if (membership?.role === "teacher") {
    return <TeacherShell session={session} membership={membership} slug={slug} onLogout={onLogout} />;
  }
  // Owner, reception and accountant share one cabinet; the menu depends on the role.
  // A super admin visiting a centre sees the owner's cabinet.
  return <ReceptionShell session={session} membership={membership} slug={slug} onLogout={onLogout} />;
}
