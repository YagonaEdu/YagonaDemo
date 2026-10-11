/* All routes of the app, by kind of session. App.jsx only decides which set to render. */
import { Navigate, Route, Routes } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import EducationAdminLayout from "@/layouts/EducationAdminLayout";
import StudentLayout from "@/layouts/StudentLayout";
import SuperAdminLayout from "@/layouts/SuperAdminLayout";
import LoginPage from "@/pages/auth/LoginPage";
import { AuthedLoginRedirect, LazyPage, RoleGuard, RootRedirect, SuperGuard, TeacherSwitch } from "./guards";
import * as P from "./pages";

/* Cabinet sections: URL segment, screen for owner / reception / accountant, and the teacher's
   own screen where the same URL shows something else. Access per role: utils/roleAccess. */
const EDUCATION_ROUTES = [
  { segment: "", page: P.EduDashboardPage, teacher: P.TeacherDashboard },
  { segment: "crm", page: P.CrmPage },
  { segment: "students", page: P.StudentsPage, teacher: P.TeacherStudentsPage },
  { segment: "trials", page: P.TrialsPage },
  { segment: "courses", page: P.CoursesPage },
  { segment: "groups", page: P.GroupsPage, teacher: P.TeacherGroupsPage },
  { segment: "rooms", page: P.RoomsPage },
  { segment: "teachers", page: P.TeachersPage },
  { segment: "schedule", page: P.SchedulePage, teacher: P.TeacherSchedulePage },
  { segment: "attendance", page: P.AttendancePage, teacher: P.TeacherAttendancePage },
  { segment: "assignments", page: P.TeacherAssignmentsPage },
  { segment: "results", page: P.TeacherResultsPage },
  { segment: "materials", page: P.TeacherMaterialsPage },
  { segment: "billing", page: P.BillingPage },
  { segment: "finance", page: P.FinancePage },
  { segment: "staff", page: P.StaffPage },
  { segment: "notifications", page: P.NotificationsPage, teacher: P.TeacherNotificationsPage },
  { segment: "tasks", page: P.ReceptionTasksPage },
  { segment: "profile", page: P.TeacherProfilePage },
  { segment: "settings", page: P.SettingsPage },
];

const SUPER_ROUTES = [
  { path: "/super", page: P.SuperDashboardPage, home: true },
  { path: "/super/centers", page: P.CentersPage },
  { path: "/super/students", page: P.PlatformStudentsPage },
  { path: "/super/plans", page: P.PlansPage },
  { path: "/super/licenses", page: P.LicensesPage },
  { path: "/super/wallet", page: P.WalletPage },
  { path: "/super/analytics", page: P.AnalyticsPage },
];

const STUDENT_ROUTES = [
  { path: "schedule", page: P.StudentSchedulePage },
  { path: "grades", page: P.StudentAttendancePage },
  { path: "courses", page: P.StudentCoursesPage },
  { path: "payments", page: P.StudentPaymentsPage },
  { path: "profile", page: P.StudentProfilePage },
  { path: "homework", page: P.StudentHomeworkPage },
  { path: "homework/:id", page: P.StudentHomeworkDetailPage },
  { path: "vocab", page: P.StudentVocabPage },
  { path: "vocab/lists/:id", page: P.StudentVocabWordsPage },
  { path: "vocab/practice", page: P.StudentVocabPracticePage },
  { path: "vocab/result/:attemptId", page: P.StudentExamResultPage },
  { path: "materials", page: P.StudentMaterialsPage },
  { path: "notifications", page: P.StudentNotificationsPage },
];

export function GuestRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Route>
    </Routes>
  );
}

export function StudentRoutes({ session, onLogout }) {
  return (
    <Routes>
      {/* Exam focus mode: no sidebar or bottom navigation. */}
      <Route path="/student/exam/:attemptId" element={<LazyPage Page={P.StudentExamPage} />} />
      <Route path="/student" element={<StudentLayout session={session} onLogout={onLogout} />}>
        <Route index element={<LazyPage Page={P.StudentHomePage} />} />
        {STUDENT_ROUTES.map(({ path, page }) => (
          <Route key={path} path={path} element={<LazyPage Page={page} />} />
        ))}
        <Route path="attendance" element={<Navigate to="/student/grades" replace />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/student" replace />} />
    </Routes>
  );
}

export function StaffRoutes({ session, onLogout }) {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect session={session} />} />

      <Route element={<SuperAdminLayout session={session} onLogout={onLogout} />}>
        {SUPER_ROUTES.map(({ path, page, home }) => (
          <Route
            key={path}
            path={path}
            element={
              <SuperGuard session={session} home={home}>
                <LazyPage Page={page} />
              </SuperGuard>
            }
          />
        ))}
      </Route>

      <Route path="/education/:tenantSlug" element={<EducationAdminLayout session={session} onLogout={onLogout} />}>
        {EDUCATION_ROUTES.map(({ segment, page, teacher }) => {
          const screen = <LazyPage Page={page} />;
          const element = (
            <RoleGuard session={session} segment={segment}>
              {teacher ? (
                <TeacherSwitch session={session} teacher={<LazyPage Page={teacher} />}>
                  {screen}
                </TeacherSwitch>
              ) : (
                screen
              )}
            </RoleGuard>
          );
          return segment ? (
            <Route key={segment} path={segment} element={element} />
          ) : (
            <Route key="index" index element={element} />
          );
        })}
      </Route>

      <Route path="/login" element={<AuthedLoginRedirect session={session} />} />
      <Route path="*" element={<RootRedirect session={session} />} />
    </Routes>
  );
}
