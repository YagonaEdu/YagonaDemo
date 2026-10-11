/* Every screen is its own chunk: it is downloaded the first time its route opens. */
import { lazy } from "react";

export const EduDashboardPage = lazy(() => import("@/pages/education-admin/DashboardPage"));
export const CrmPage = lazy(() => import("@/pages/education-admin/CrmPage"));
export const StudentsPage = lazy(() => import("@/pages/education-admin/StudentsPage"));
export const CoursesPage = lazy(() => import("@/pages/education-admin/CoursesPage"));
export const GroupsPage = lazy(() => import("@/pages/education-admin/GroupsPage"));
export const RoomsPage = lazy(() => import("@/pages/education-admin/RoomsPage"));
export const SchedulePage = lazy(() => import("@/pages/education-admin/SchedulePage"));
export const AttendancePage = lazy(() => import("@/pages/education-admin/AttendancePage"));
export const BillingPage = lazy(() => import("@/pages/education-admin/BillingPage"));
export const FinancePage = lazy(() => import("@/pages/education-admin/FinancePage"));
export const StaffPage = lazy(() => import("@/pages/education-admin/StaffPage"));
export const NotificationsPage = lazy(() => import("@/pages/education-admin/NotificationsPage"));
export const SettingsPage = lazy(() => import("@/pages/education-admin/SettingsPage"));
export const ReceptionTasksPage = lazy(() => import("@/pages/education-admin/resepshen_yagona/TasksPage"));
export const TeachersPage = lazy(() => import("@/pages/education-admin/resepshen_yagona/TeachersPage"));
export const TrialsPage = lazy(() => import("@/pages/education-admin/resepshen_yagona/TrialsPage"));

export const TeacherDashboard = lazy(() => import("@/pages/education-admin/teachers_account"));
export const TeacherGroupsPage = lazy(() => import("@/pages/education-admin/teachers_account/GroupsPage"));
export const TeacherStudentsPage = lazy(() => import("@/pages/education-admin/teachers_account/StudentsPage"));
export const TeacherSchedulePage = lazy(() => import("@/pages/education-admin/teachers_account/SchedulePage"));
export const TeacherAttendancePage = lazy(() => import("@/pages/education-admin/teachers_account/AttendancePage"));
export const TeacherAssignmentsPage = lazy(() => import("@/pages/education-admin/teachers_account/AssignmentsPage"));
export const TeacherResultsPage = lazy(() => import("@/pages/education-admin/teachers_account/ResultsPage"));
export const TeacherMaterialsPage = lazy(() => import("@/pages/education-admin/teachers_account/MaterialsPage"));
export const TeacherNotificationsPage = lazy(() => import("@/pages/education-admin/teachers_account/NotificationsPage"));
export const TeacherProfilePage = lazy(() => import("@/pages/education-admin/teachers_account/ProfilePage"));

export const StudentHomePage = lazy(() => import("@/pages/student/HomePage"));
export const StudentSchedulePage = lazy(() => import("@/pages/student/SchedulePage"));
export const StudentAttendancePage = lazy(() => import("@/pages/student/AttendancePage"));
export const StudentPaymentsPage = lazy(() => import("@/pages/student/PaymentsPage"));
export const StudentProfilePage = lazy(() => import("@/pages/student/ProfilePage"));
export const StudentCoursesPage = lazy(() => import("@/pages/student/CoursesPage"));
export const StudentHomeworkPage = lazy(() => import("@/pages/student/HomeworkPage"));
export const StudentHomeworkDetailPage = lazy(() => import("@/pages/student/HomeworkDetailPage"));
export const StudentVocabPage = lazy(() => import("@/pages/student/VocabPage"));
export const StudentVocabWordsPage = lazy(() => import("@/pages/student/VocabWordsPage"));
export const StudentVocabPracticePage = lazy(() => import("@/pages/student/VocabPracticePage"));
export const StudentExamPage = lazy(() => import("@/pages/student/ExamPage"));
export const StudentExamResultPage = lazy(() => import("@/pages/student/ExamResultPage"));
export const StudentMaterialsPage = lazy(() => import("@/pages/student/MaterialsPage"));
export const StudentNotificationsPage = lazy(() => import("@/pages/student/NotificationsPage"));

export const SuperDashboardPage = lazy(() => import("@/pages/super-admin/DashboardPage"));
export const CentersPage = lazy(() => import("@/pages/super-admin/CentersPage"));
export const PlatformStudentsPage = lazy(() => import("@/pages/super-admin/StudentsPage"));
export const PlansPage = lazy(() => import("@/pages/super-admin/PlansPage"));
export const LicensesPage = lazy(() => import("@/pages/super-admin/LicensesPage"));
export const WalletPage = lazy(() => import("@/pages/super-admin/WalletPage"));
export const AnalyticsPage = lazy(() => import("@/pages/super-admin/AnalyticsPage"));
