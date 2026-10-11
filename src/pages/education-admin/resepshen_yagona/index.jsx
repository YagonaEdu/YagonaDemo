import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { Banner, Button } from "@/components/ui";
import { initialsOf } from "@/components/layout/FigmaChrome";
import NotificationsSendSheet from "@/pages/education-admin/NotificationsSendSheet";
import { api, getSession, invalidateApiCache } from "@/services/api/client";
import { attendanceForLessons } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import {
  educationSegmentPath,
} from "@/utils/routes";
import { formatTime, formatUzPhone, formatWhen, money, toApiPhone, today } from "@/utils/format";
import { formatDateTime, t } from "@/i18n";
import NewVisitorSheet from "./NewVisitorSheet";
import TrialLessonSheet from "./TrialLessonSheet";
import QuickPaymentSheet from "./QuickPaymentSheet";
import QuickStudentSheet from "./QuickStudentSheet";
import StudentQuickCard from "./StudentQuickCard";
import MarkArrivalSheet from "./MarkArrivalSheet";
import TeacherDrawer from "./TeacherDrawer";
import { asList, LEADS_PATH, todayLessonsPath } from "./receptionData";
import {
  IconArrowRight,
  IconCard,
  IconCheckSquare,
  IconPhone,
  IconRefresh,
  IconSearch,
  IconStar,
  IconUserPlus,
  IconUsers,
} from "./rxIcons";
import {
  buildTrialTopic,
  combineDateTime,
  digits,
  invoiceBalance,
  isSameLocalDay,
  isTrialLesson,
  parseTrialTopic,
  staffLabel,
  TRIAL_OUTCOME_HISTORY,
  VISIT_TIME_NOTE,
} from "./utils";

const EMPTY_VISITOR = {
  first_name: "",
  last_name: "",
  for_whom: "self",
  time: "",
  phone: "",
  parent_name: "",
  parent_phone: "",
  course: "",
  source: "manual",
  stage: "",
  notes: "",
  force: false,
};

const EMPTY_TRIAL = {
  course: "",
  group: "",
  date: today(),
  start_time: "16:00",
  end_time: "17:00",
  teacher: "",
  room: "",
  comment: "",
};

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 6) return t("aDash.goodNight");
  if (hour < 12) return t("aDash.goodMorning");
  if (hour < 18) return t("aDash.goodAfternoon");
  return t("aDash.goodEvening");
}


async function loadAttendanceForLessons(lessonsData) {
  const now = Date.now();
  const pastToday = lessonsData
    .filter(
      (lesson) =>
        isSameLocalDay(lesson.starts_at) &&
        lesson.status !== "cancelled" &&
        new Date(lesson.starts_at).getTime() < now,
    )
    .slice(0, 8);
  if (!pastToday.length) return {};
  return attendanceForLessons(pastToday.map((lesson) => lesson.id)).catch(() => ({}));
}

export default function ReceptionDashboard() {
  const session = getSession();
  const membership = currentMembership(session);
  const { tenantSlug = "" } = useParams();
  const navigate = useNavigate();
  const currency = membership?.currency || "UZS";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [students, setStudents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [stages, setStages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [guardians, setGuardians] = useState([]);
  const [guardianLinks, setGuardianLinks] = useState([]);
  const [attendanceByLesson, setAttendanceByLesson] = useState({});
  const [secondaryLoading, setSecondaryLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState("all"); // all | students | leads | teachers
  const [cardTeacher, setCardTeacher] = useState(null);

  const [visitorOpen, setVisitorOpen] = useState(false);
  const [visitorForm, setVisitorForm] = useState(EMPTY_VISITOR);
  const [visitorSaving, setVisitorSaving] = useState(false);
  const [visitorError, setVisitorError] = useState("");
  const [createdLead, setCreatedLead] = useState(null);

  const [trialOpen, setTrialOpen] = useState(false);
  const [trialForm, setTrialForm] = useState(EMPTY_TRIAL);
  const [trialPerson, setTrialPerson] = useState(null);
  const [trialSaving, setTrialSaving] = useState(false);
  const [trialError, setTrialError] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [payStudentId, setPayStudentId] = useState("");
  const [studentCreateOpen, setStudentCreateOpen] = useState(false);
  const [cardStudent, setCardStudent] = useState(null);
  const [arriveStudent, setArriveStudent] = useState(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [convertLead, setConvertLead] = useState(null);
  const [convertGroup, setConvertGroup] = useState("");
  const [convertBusy, setConvertBusy] = useState(false);
  const [centerSettings, setCenterSettings] = useState({});
  const [lessonTab, setLessonTab] = useState("next");
  const [attentionAll, setAttentionAll] = useState(false);
  const [trialOutcomes, setTrialOutcomes] = useState({});
  const [arrivalMode, setArrivalMode] = useState(false);
  const searchInputRef = useRef(null);
  const searchBoxRef = useRef(null);
  const quickActionsRef = useRef([]);
  const outlet = useOutletContext();

  const userFirstName =
    session.user?.first_name ||
    String(session.user?.name || "")
      .trim()
      .split(/\s+/)[0] ||
    t("aDash.colleague");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let lessonsData = [];
    api
      .get("/tenant/settings", { cache: true })
      .then((data) => setCenterSettings(data?.center_settings || {}))
      .catch(() => {
        /* defaults apply */
      });

    try {
      const core = await Promise.all([
        asList(todayLessonsPath()),
        asList(LEADS_PATH),
        asList("/lead-stages?page_size=30"),
        asList("/groups?page_size=80"),
        asList("/courses?page_size=80"),
        asList("/staff?page_size=80"),
        asList("/rooms?page_size=40"),
      ]);
      lessonsData = core[0];
      setLessons(core[0]);
      setLeads(core[1]);
      setStages(core[2]);
      setGroups(core[3]);
      setCourses(core[4]);
      setStaff(core[5]);
      setRooms(core[6]);
    } catch (err) {
      setError(err.message);
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    setSecondaryLoading(true);
    try {
      const [studentsData, enrollmentsData, invoicesData, guardiansData, linksData] =
        await Promise.all([
          asList("/students?page_size=150"),
          asList("/enrollments?page_size=300"),
          asList("/invoices?page_size=120"),
          asList("/guardians?page_size=120"),
          asList("/student-guardians?page_size=300"),
        ]);
      setStudents(studentsData);
      setEnrollments(enrollmentsData);
      setInvoices(invoicesData);
      setGuardians(guardiansData);
      setGuardianLinks(linksData);

      const attendance = await loadAttendanceForLessons(lessonsData);
      setAttendanceByLesson(attendance);
    } catch (err) {
      setError((prev) => prev || err.message);
    } finally {
      setSecondaryLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, session.tenantId]);

  useEffect(() => {
    if (!visitorForm.stage && stages.length) {
      const preferred =
        stages.find((s) => /trial|проб/i.test(s.name)) ||
        stages.find((s) => /new|нов/i.test(s.name)) ||
        stages[0];
      if (preferred) setVisitorForm((p) => ({ ...p, stage: preferred.id }));
    }
  }, [stages, visitorForm.stage]);

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [String(c.id), c])),
    [courses],
  );
  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [String(g.id), g])),
    [groups],
  );
  const staffMap = useMemo(
    () => Object.fromEntries(staff.map((s) => [String(s.id), s])),
    [staff],
  );
  const roomMap = useMemo(
    () => Object.fromEntries(rooms.map((r) => [String(r.id), r])),
    [rooms],
  );
  const guardianMap = useMemo(
    () => Object.fromEntries(guardians.map((g) => [String(g.id), g])),
    [guardians],
  );

  function studentGroups(studentId) {
    return enrollments
      .filter((e) => String(e.student) === String(studentId) && e.status === "active")
      .map((e) => groupMap[String(e.group)])
      .filter(Boolean);
  }

  function studentDebt(studentId) {
    return invoices
      .filter((inv) => String(inv.student) === String(studentId))
      .filter((inv) => !["paid", "void", "canceled", "cancelled"].includes(inv.status))
      .reduce((sum, inv) => sum + Math.max(0, invoiceBalance(inv)), 0);
  }

  function studentParent(studentId) {
    const link = guardianLinks.find(
      (l) => String(l.student) === String(studentId) && (l.is_primary || true),
    );
    return link ? guardianMap[String(link.guardian)] : null;
  }

  const lessonsToday = useMemo(
    () =>
      lessons
        .filter((l) => isSameLocalDay(l.starts_at) && l.status !== "cancelled")
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
    [lessons],
  );

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = digits(search);
    if (!q && !qDigits) return { students: [], leads: [], teachers: [] };

    const studentsHits = students
      .map((s) => {
        const parent = studentParent(s.id);
        const groupsFor = studentGroups(s.id);
        const teacher = groupsFor[0]?.teacher
          ? staff.find((m) => String(m.id) === String(groupsFor[0].teacher))
          : null;
        const hay = [s.full_name, s.phone, s.email, parent?.phone, parent?.full_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const phoneHit =
          qDigits &&
          (digits(s.phone).includes(qDigits) || digits(parent?.phone).includes(qDigits));
        const textHit = q && hay.includes(q);
        if (!phoneHit && !textHit) return null;
        return {
          student: s,
          parent,
          groups: groupsFor,
          teacher,
          debt: studentDebt(s.id),
        };
      })
      .filter(Boolean)
      .slice(0, 10);

    const leadsHits = leads
      .filter((l) => !l.converted_student)
      .filter((l) => {
        const hay = [l.full_name, l.phone, l.email, l.source_details].join(" ").toLowerCase();
        const phoneHit = qDigits && digits(l.phone).includes(qDigits);
        return phoneHit || (q && hay.includes(q));
      })
      .slice(0, 8);

    const teachersHits = staff
      .filter((m) => m.role === "teacher")
      .map((m) => {
        const name = staffLabel(m);
        const phone = m.user?.phone || "";
        const email = m.user?.email || "";
        const teacherGroups = groups.filter((g) => String(g.teacher) === String(m.id));
        const todayLs = lessonsToday.filter((l) => String(l.teacher) === String(m.id));
        const hay = [name, phone, email].join(" ").toLowerCase();
        const phoneHit = qDigits && digits(phone).includes(qDigits);
        if (!(phoneHit || (q && hay.includes(q)))) return null;
        return {
          teacher: {
            ...m,
            name,
            phone,
            email,
            groups: teacherGroups,
            todayLessons: todayLs,
            courseNames: [
              ...new Set(
                teacherGroups
                  .map((g) => courseMap[String(g.course)]?.name)
                  .filter(Boolean),
              ),
            ],
          },
        };
      })
      .filter(Boolean)
      .slice(0, 8);

    return { students: studentsHits, leads: leadsHits, teachers: teachersHits };
  }, [
    search,
    students,
    leads,
    staff,
    groups,
    lessonsToday,
    enrollments,
    invoices,
    guardianLinks,
    guardians,
    courseMap,
  ]);

  const trialsToday = useMemo(
    () => lessonsToday.filter(isTrialLesson),
    [lessonsToday],
  );

  const followToday = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return leads
      .filter((l) => !l.converted_student && l.next_follow_up_at)
      .filter((l) => {
        const d = new Date(l.next_follow_up_at);
        return d >= start && d <= end;
      })
      .sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at));
  }, [leads]);

  const followOverdue = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return leads
      .filter((l) => !l.converted_student && l.next_follow_up_at)
      .filter((l) => new Date(l.next_follow_up_at) < start)
      .sort((a, b) => new Date(a.next_follow_up_at) - new Date(b.next_follow_up_at))
      .slice(0, 10);
  }, [leads]);

  const attention = useMemo(() => {
    const items = [];
    followOverdue.slice(0, 4).forEach((l) => {
      items.push({
        id: `lead-${l.id}`,
        title: l.full_name,
        detail: t("aDash.overdueContact", { phone: l.phone || "" }),
        action: "crm",
        lead: l,
      });
    });
    lessonsToday.forEach((lesson) => {
      const expected = enrollments.filter(
        (e) => String(e.group) === String(lesson.group) && e.status === "active",
      ).length;
      const marks = attendanceByLesson[String(lesson.id)] || [];
      if (expected > 0 && marks.length === 0 && new Date(lesson.starts_at) < new Date()) {
        items.push({
          id: `att-${lesson.id}`,
          title: groupMap[String(lesson.group)]?.name || t("aDash.group"),
          detail: t("aDash.attendanceNotMarked"),
          action: "attendance",
          lesson,
        });
      }
    });
    students
      .filter((s) => s.status === "active")
      .forEach((s) => {
        const debt = studentDebt(s.id);
        if (debt >= 100000) {
          items.push({
            id: `debt-${s.id}`,
            title: s.full_name,
            detail: t("aDash.debt", { amount: money(debt, currency) }),
            action: "pay",
            student: s,
          });
        }
      });
    groups.forEach((g) => {
      if (!g.teacher && g.status === "active") {
        items.push({
          id: `noteacher-${g.id}`,
          title: g.name,
          detail: t("aDash.noTeacherAssigned"),
          action: "groups",
          assign: true,
        });
      }
      const active = Number(g.active_students || 0);
      if (g.capacity > 0 && active >= g.capacity) {
        items.push({
          id: `cap-${g.id}`,
          title: g.name,
          detail: t("aDash.full", { active, capacity: g.capacity }),
          action: "groups",
        });
      }
    });
    lessonsToday.forEach((lesson) => {
      if (!lesson.teacher) {
        items.push({
          id: `nolessonteacher-${lesson.id}`,
          title: groupMap[String(lesson.group)]?.name || t("aDash.lesson"),
          detail: t("aDash.noTeacherAssigned2", { time: formatTime(lesson.starts_at) }),
          action: "schedule",
        });
      }
    });
    return items.slice(0, 12);
  }, [
    followOverdue,
    lessonsToday,
    enrollments,
    attendanceByLesson,
    students,
    groups,
    invoices,
    currency,
    groupMap,
  ]);

  const teachersToday = useMemo(() => {
    const map = new Map();
    lessonsToday.forEach((lesson) => {
      if (!lesson.teacher) return;
      const id = String(lesson.teacher);
      if (!map.has(id)) {
        const member = staffMap[id];
        map.set(id, {
          id,
          member,
          name: member ? staffLabel(member) : t("aDash.teacher"),
          lessons: [],
          groups: new Set(),
        });
      }
      const row = map.get(id);
      row.lessons.push(lesson);
      const g = groupMap[String(lesson.group)];
      if (g) row.groups.add(g.name);
    });
    return [...map.values()]
      .map((row) => ({
        ...row,
        next: row.lessons.find((l) => new Date(l.starts_at) >= new Date()) || row.lessons[0],
        groupNames: [...row.groups],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [lessonsToday, staffMap, groupMap]);

  /* Settings → «Работа ресепшена». Missing values keep the old behaviour. */
  const receptionSettings = centerSettings.reception || {};
  const financeSettings = centerSettings.finance || {};
  const trialMinutes = Number(centerSettings.education?.trial_lesson_duration_minutes) || 60;
  const followUpDays = Number(receptionSettings.default_followup_days) || 1;
  const warnDuplicates = receptionSettings.warn_duplicate_phone !== false;

  const visitorDuplicates = useMemo(() => {
    const phoneDigits = digits(visitorForm.phone);
    if (!phoneDigits || !warnDuplicates) return [];
    const hits = [];
    students.forEach((s) => {
      if (digits(s.phone) === phoneDigits) {
        hits.push({
          kind: "student",
          id: s.id,
          full_name: s.full_name,
          phone: s.phone,
          extra: studentGroups(s.id)[0]?.name || "",
        });
      }
    });
    leads.forEach((l) => {
      if (digits(l.phone) === phoneDigits) {
        hits.push({ kind: "lead", id: l.id, full_name: l.full_name, phone: l.phone });
      }
    });
    return hits;
  }, [visitorForm.phone, students, leads, enrollments, groups, warnDuplicates]);

  function path(segment) {
    return educationSegmentPath(tenantSlug, segment);
  }

  /* The student's lesson today: the one running now, else the next, else the last one. */
  function studentTodayLesson(studentId) {
    const ids = new Set(studentGroups(studentId).map((g) => String(g.id)));
    const mine = lessonsToday.filter((l) => ids.has(String(l.group)) && !isTrialLesson(l));
    if (!mine.length) return null;
    const now = Date.now();
    const lesson =
      mine.find((l) => new Date(l.starts_at).getTime() <= now && new Date(l.ends_at).getTime() > now) ||
      mine.find((l) => new Date(l.starts_at).getTime() > now) ||
      mine[mine.length - 1];
    return {
      lesson,
      groupName: groupMap[String(lesson.group)]?.name,
      roomName: roomMap[String(lesson.room)]?.name,
      teacherName: lesson.teacher ? staffLabel(staffMap[String(lesson.teacher)]) : "",
    };
  }

  function findTrialLead(parsed) {
    return leads.find(
      (l) =>
        (parsed.phone && digits(l.phone) === digits(parsed.phone)) ||
        (parsed.name && l.full_name === parsed.name),
    );
  }

  function openStudentCard(student) {
    setSearchOpen(false);
    setCardStudent(student);
  }

  /* «Отметить приход»: find the student first, the result row then offers «Приход». */
  function startArrival() {
    setArrivalMode(true);
    setSearchTab("students");
    setSearchOpen(true);
    searchInputRef.current?.focus();
  }

  // Close the search results on an outside click.
  useEffect(() => {
    if (!searchOpen) return undefined;
    function onDoc(event) {
      if (!searchBoxRef.current?.contains(event.target)) {
        setSearchOpen(false);
        setArrivalMode(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [searchOpen]);

  // Hotkeys from the mockup: «/» search, N/A/P/T/S quick actions (not while typing or in a dialog).
  useEffect(() => {
    function onKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      const target = event.target;
      if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (document.querySelector(".overlay")) return;
      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      const action = quickActionsRef.current.find((item) => item.key === event.key.toUpperCase());
      if (action) {
        event.preventDefault();
        action.run();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function openVisitor() {
    setVisitorError("");
    setCreatedLead(null);
    setVisitorForm({ ...EMPTY_VISITOR, stage: "", source: receptionSettings.default_lead_source || "manual" });
    setVisitorOpen(true);
  }

  async function submitVisitor(event) {
    event.preventDefault();
    // «Сохранить и записать на пробный» submits with value "trial".
    const thenTrial = event.nativeEvent?.submitter?.value === "trial";
    setVisitorError("");
    if (visitorDuplicates.length && !visitorForm.force) {
      setVisitorError(t("aDash.aMatchWasFound"));
      return;
    }
    setVisitorSaving(true);
    try {
      const courseName = courseMap[String(visitorForm.course)]?.name || "";
      const forChild = visitorForm.for_whom === "child";
      // Notes are stored data read by every cabinet, so their labels stay Russian.
      const notesParts = [
        visitorForm.notes.trim(),
        courseName ? `Интерес: ${courseName}` : "",
        forChild ? "Для ребёнка" : "",
        forChild && (visitorForm.parent_name.trim() || visitorForm.parent_phone.trim())
          ? `Родитель: ${visitorForm.parent_name.trim()} ${visitorForm.parent_phone.trim()}`.trim()
          : "",
        visitorForm.time ? `Удобное время: ${VISIT_TIME_NOTE[visitorForm.time]}` : "",
      ].filter(Boolean);
      const preferredStage =
        stages.find((s) => /trial|проб/i.test(s.name)) || stages.find((s) => /new|нов/i.test(s.name)) || stages[0];
      const created = await api.post("/leads", {
        full_name: [visitorForm.first_name.trim(), visitorForm.last_name.trim()].filter(Boolean).join(" "),
        phone: toApiPhone(visitorForm.phone),
        source: visitorForm.source,
        stage: visitorForm.stage || preferredStage?.id,
        notes: notesParts.join("\n"),
        source_details: courseName,
      });
      setVisitorOpen(false);
      setInfo(t("aDash.visitorSavedToCrm", { full_name: created.full_name }));
      if (thenTrial) {
        openTrialFor({ ...created, kind: "lead", course: visitorForm.course });
      } else {
        setCreatedLead(created);
      }
      await load();
    } catch (err) {
      setVisitorError(err.message);
    } finally {
      setVisitorSaving(false);
    }
  }

  function openTrialFor(person) {
    const next =
      person?.kind === "blank" || (!person?.full_name && !person?.id) ? null : person;
    setTrialPerson(next);
    setTrialError("");
    const end = new Date(`2000-01-01T${EMPTY_TRIAL.start_time}:00`);
    end.setMinutes(end.getMinutes() + trialMinutes);
    setTrialForm({
      ...EMPTY_TRIAL,
      end_time: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      course: next?.course || "",
      teacher: staff.find((s) => s.role === "teacher")?.id || staff[0]?.id || "",
      room: rooms[0]?.id || "",
      group: groups[0]?.id || "",
    });
    setTrialOpen(true);
  }

  const trialPeopleOptions = useMemo(() => {
    const leadOpts = leads
      .filter((l) => !l.converted_student)
      .map((l) => ({
        key: `lead:${l.id}`,
        label: t("aDash.lead", { full_name: l.full_name, p: l.phone ? ` · ${formatUzPhone(l.phone)}` : "" }),
        person: { ...l, kind: "lead" },
      }));
    const studentOpts = students
      .filter((s) => s.status === "active")
      .map((s) => ({
        key: `student:${s.id}`,
        label: t("aDash.student", { full_name: s.full_name, p: s.phone ? ` · ${formatUzPhone(s.phone)}` : "" }),
        person: { ...s, kind: "student" },
      }));
    return [...leadOpts, ...studentOpts];
  }, [leads, students]);

  async function submitTrial(event) {
    event.preventDefault();
    setTrialError("");
    if (!trialPerson?.full_name?.trim()) {
      setTrialError(t("aDash.chooseWhoYouAre"));
      return;
    }
    setTrialSaving(true);
    try {
      const startAt = combineDateTime(trialForm.date, trialForm.start_time).getTime();
      const endAt = combineDateTime(trialForm.date, trialForm.end_time).getTime();
      const conflict = lessons.find((l) => {
        if (String(l.teacher) !== String(trialForm.teacher) || l.status === "cancelled") return false;
        const a = new Date(l.starts_at).getTime();
        const b = new Date(l.ends_at).getTime();
        return a < endAt && b > startAt;
      });
      if (conflict) {
        throw new Error(
          t("aDash.theTeacherAlreadyHas", { time: formatTime(conflict.starts_at), time2: formatTime(conflict.ends_at) }),
        );
      }
      const name = trialPerson?.full_name || trialPerson?.name || t("aDash.visitor");
      const phone = toApiPhone(trialPerson?.phone) || "";
      await api.post("/lessons", {
        group: trialForm.group,
        teacher: trialForm.teacher,
        room: trialForm.room,
        starts_at: combineDateTime(trialForm.date, trialForm.start_time).toISOString(),
        ends_at: combineDateTime(trialForm.date, trialForm.end_time).toISOString(),
        topic: buildTrialTopic({ name, phone, comment: trialForm.comment }),
      });
      if (trialPerson?.id && trialPerson?.kind !== "student") {
        const trialStage =
          stages.find((s) => /trial|проб/i.test(s.name)) || null;
        if (trialStage) {
          await api.patch(`/leads/${trialPerson.id}`, { stage: trialStage.id });
        }
        await api.post(`/leads/${trialPerson.id}/activities`, {
          kind: "note",
          content: `Запись на пробный урок ${trialForm.date} ${trialForm.start_time}`,
          occurred_at: new Date().toISOString(),
        });
      }
      setTrialOpen(false);
      setCreatedLead(null);
      setInfo(t("aDash.trialLessonBooked"));
      await load();
    } catch (err) {
      setTrialError(err.message);
    } finally {
      setTrialSaving(false);
    }
  }

  async function markTrialStatus(lesson, outcome) {
    const parsed = parseTrialTopic(lesson.topic);
    const lead = findTrialLead(parsed);
    // «Перенести» cancels this lesson, so ask first; then the booking form opens for the same guest.
    if (outcome === "rescheduled" && !window.confirm(t("rxTrials.confirmReschedule", { name: parsed.name || t("aDash.visitor") }))) {
      return;
    }
    try {
      if (lead) {
        await api.post(`/leads/${lead.id}/activities`, {
          kind: "note",
          content: `Пробный урок: ${TRIAL_OUTCOME_HISTORY[outcome]}`,
          occurred_at: new Date().toISOString(),
        });
        if (outcome === "no_show") {
          await api.patch(`/leads/${lead.id}`, {
            next_follow_up_at: new Date(Date.now() + followUpDays * 86400000).toISOString(),
          });
        }
      }
      if (outcome === "rescheduled") {
        await api.patch(`/lessons/${lesson.id}`, { status: "cancelled" });
      }
      setTrialOutcomes((prev) => ({ ...prev, [lesson.id]: outcome }));
      setInfo(`${parsed.name || t("aDash.visitor")}: ${t(`aRec.outcome_${outcome}`)}`);
      await load();
      if (outcome === "enrolled" && lead) {
        setConvertLead(lead);
        setConvertGroup(String(lesson.group || ""));
      }
      if (outcome === "rescheduled") {
        const course = groupMap[String(lesson.group)]?.course || "";
        openTrialFor(
          lead
            ? { ...lead, kind: "lead", course }
            : { full_name: parsed.name || t("aDash.visitor"), phone: parsed.phone, kind: "visitor", course },
        );
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function doConvert() {
    if (!convertLead) return;
    setConvertBusy(true);
    setError("");
    try {
      const body = convertGroup ? { group_id: convertGroup } : {};
      const student = await api.post(`/leads/${convertLead.id}/convert`, body);
      setInfo(t("aDash.leadConvertedToStudent", { full_name: student.full_name || convertLead.full_name }));
      setConvertLead(null);
      await load();
      if (student?.id) {
        const full = students.find((s) => String(s.id) === String(student.id)) || student;
        setCardStudent(full);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setConvertBusy(false);
    }
  }

  async function completeFollowUp(lead) {
    try {
      await api.post(`/leads/${lead.id}/activities`, {
        kind: "call",
        content: "Контакт выполнен (ресепшн)",
        occurred_at: new Date().toISOString(),
      });
      await api.patch(`/leads/${lead.id}`, { next_follow_up_at: null });
      setInfo(t("aDash.contactWithMarked", { full_name: lead.full_name }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const nowMs = Date.now();
  const lessonRows = lessonsToday.map((lesson) => {
    const g = groupMap[String(lesson.group)];
    const expected = enrollments.filter(
      (e) => String(e.group) === String(lesson.group) && e.status === "active",
    ).length;
    const marks = attendanceByLesson[String(lesson.id)] || [];
    const present = marks.filter((m) => ["present", "late"].includes(m.status)).length;
    const startMs = new Date(lesson.starts_at).getTime();
    const endMs = new Date(lesson.ends_at).getTime();
    const started = startMs <= nowMs;
    const ended = endMs <= nowMs;
    let state = "planned";
    if (!lesson.teacher && !ended) state = "noteacher";
    else if (started && !ended) state = "live";
    else if (ended) state = "done";
    else if (startMs - nowMs <= 3 * 3600000) state = "soon";
    return {
      lesson,
      group: g,
      course: courseMap[String(g?.course)],
      teacher: staffMap[String(lesson.teacher)],
      room: roomMap[String(lesson.room)],
      expected,
      present,
      marked: marks.length > 0,
      started,
      ended,
      state,
      minutesLeft: Math.max(0, Math.round((startMs - nowMs) / 60000)),
    };
  });
  const visibleLessons = lessonTab === "all" ? lessonRows : lessonRows.filter((row) => !row.ended);
  const startedRows = lessonRows.filter((row) => row.started && row.expected > 0);
  const cameTotal = startedRows.reduce((sum, row) => sum + row.present, 0);
  const expectedTotal = startedRows.reduce((sum, row) => sum + row.expected, 0);
  const debtors = students
    .filter((s) => s.status === "active")
    .map((s) => studentDebt(s.id))
    .filter((debt) => debt > 0);
  const debtSum = debtors.reduce((sum, debt) => sum + debt, 0);
  const trialsCame = trialsToday.filter((lesson) => trialOutcomes[lesson.id] === "came").length;
  const contactsDue = [...followOverdue, ...followToday];

  function lessonPill(row) {
    if (row.state === "noteacher") return <span className="rx-pill is-amber">{t("rxDash.noTeacherPill")}</span>;
    if (row.state === "live") return <span className="rx-pill is-teal">{t("rxDash.live")}</span>;
    if (row.state === "done") return <span className="rx-pill">{t("rxDash.finished")}</span>;
    if (row.state === "soon") {
      const h = Math.floor(row.minutesLeft / 60);
      const m = row.minutesLeft % 60;
      return (
        <span className="rx-pill is-blue">
          {h && m ? t("rxDash.inHoursMinutes", { h, m }) : h ? t("rxDash.inHours", { h }) : t("rxDash.inMinutes", { m })}
        </span>
      );
    }
    return <span className="rx-pill">{t("rxDash.planned")}</span>;
  }

  function attentionTone(item) {
    if (item.action === "pay") return "is-red";
    if (item.action === "crm") return "is-blue";
    return "is-amber";
  }

  function attentionAction(item) {
    if (item.action === "pay") {
      return (
        <button
          type="button"
          className="rx-btn is-outline is-sm"
          onClick={() => {
            setPayStudentId(String(item.student.id));
            setPayOpen(true);
          }}
        >
          {t("aDash.payment")}
        </button>
      );
    }
    const to = { crm: "crm", attendance: "attendance", groups: "groups", schedule: "schedule" }[item.action];
    return (
      <Link className="rx-btn is-outline is-sm" to={path(to)}>
        {item.assign ? t("aDash.assign") : item.action === "crm" ? t("aDash.call") : t("aDash.open")}
      </Link>
    );
  }

  const quickActions = [
    { key: "N", id: "visitor", tone: "is-blue", icon: IconUserPlus, title: t("aDash.newVisitor"), text: t("rxDash.newVisitorHint"), run: openVisitor },
    { key: "A", id: "find_student", tone: "is-navy", icon: IconCheckSquare, title: t("rxDash.markArrival"), text: t("rxDash.markArrivalHint"), run: startArrival },
    {
      key: "P",
      id: "payment",
      icon: IconCard,
      title: t("aDash.takePayment"),
      text: t("rxDash.paymentHint"),
      run: () => {
        setPayStudentId("");
        setPayOpen(true);
      },
    },
    { key: "T", id: "trial", icon: IconStar, title: t("aDash.trialLesson"), text: t("aDash.bookATrial"), run: () => openTrialFor({ full_name: "", phone: "", kind: "blank" }) },
    { key: "S", id: "student", icon: IconUsers, title: t("rxDash.newStudent"), text: t("rxDash.newStudentHint"), run: () => setStudentCreateOpen(true) },
  ].filter((item) => !Array.isArray(receptionSettings.quick_actions) || receptionSettings.quick_actions.includes(item.id));
  quickActionsRef.current = quickActions;

  const searchTabs = [
    ["all", t("aDash.all")],
    ["students", t("aDash.students")],
    ["leads", t("aDash.leads")],
    ["teachers", t("aDash.teachers")],
  ];
  const hasHits = searchHits.students.length || searchHits.leads.length || searchHits.teachers.length;

  return (
    <div className="reception-page rx-dash">
      <header className="rx-hero">
        <div>
          <p className="rx-hero-date">
            {formatDateTime(new Date(), { weekday: "long", day: "numeric", month: "long" })} · {formatTime(new Date())}
          </p>
          <h1>
            {greetingForNow()}, {userFirstName}
          </h1>
        </div>
        <div className="rx-hero-actions">
          <button
            type="button"
            className="rx-btn is-outline"
            onClick={() => {
              invalidateApiCache(session.tenantId);
              load();
              outlet?.refreshCounts?.();
            }}
            disabled={loading || secondaryLoading}
          >
            <IconRefresh size={18} />
            {loading || secondaryLoading ? t("aDash.refreshing") : t("aDash.refresh")}
          </button>
        </div>
      </header>

      <section className={`rx-search${searchOpen && search.trim() ? " is-open" : ""}`} ref={searchBoxRef}>
        <div className="rx-search-bar">
          <IconSearch size={20} />
          <input
            ref={searchInputRef}
            id="reception-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSearch("");
                setSearchOpen(false);
                event.currentTarget.blur();
              }
            }}
            placeholder={arrivalMode ? t("rxDash.searchForArrival") : t("rxDash.searchPlaceholder")}
            aria-label={t("aDash.quickSearch")}
            autoComplete="off"
          />
          <div className="rx-seg" role="tablist" aria-label={t("aDash.quickSearch")}>
            {searchTabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={searchTab === id}
                className={searchTab === id ? "is-active" : ""}
                onClick={() => {
                  setSearchTab(id);
                  searchInputRef.current?.focus();
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <kbd className="rx-kbd" title={t("rxDash.slashHint")}>/</kbd>
        </div>

        {searchOpen && search.trim() ? (
          <div className="rx-search-results">
            {!hasHits ? <p className="rx-empty">{t("aDash.nothingFound")}</p> : null}

            {(searchTab === "all" || searchTab === "students") &&
              searchHits.students.map(({ student, groups: gList, debt }) => (
                <div key={`s-${student.id}`} className="rx-hit">
                  <button type="button" className="rx-hit-main" onClick={() => openStudentCard(student)}>
                    <span className="rx-av">{initialsOf(student.full_name)}</span>
                    <span className="rx-hit-copy">
                      <strong>{student.full_name}</strong>
                      <small>
                        {t("rxDash.studentTag")} · {student.phone ? formatUzPhone(student.phone) : "—"} ·{" "}
                        {gList.map((g) => g.name).join(", ") || t("aDash.noGroup")}
                      </small>
                    </span>
                    {debt > 0 ? <span className="rx-pill is-red">{t("aDash.debt", { amount: money(debt, currency) })}</span> : null}
                  </button>
                  <div className="rx-hit-actions">
                    <button type="button" className={`rx-btn is-sm ${arrivalMode ? "is-teal" : "is-outline"}`} onClick={() => setArriveStudent(student)}>
                      {t("aDash.arrival")}
                    </button>
                    <button
                      type="button"
                      className="rx-btn is-outline is-sm"
                      onClick={() => {
                        setPayStudentId(String(student.id));
                        setPayOpen(true);
                      }}
                    >
                      {t("aDash.payment")}
                    </button>
                  </div>
                </div>
              ))}

            {(searchTab === "all" || searchTab === "leads") &&
              searchHits.leads.map((lead) => (
                <div key={`l-${lead.id}`} className="rx-hit">
                  <div className="rx-hit-main">
                    <span className="rx-av is-blue">{initialsOf(lead.full_name)}</span>
                    <span className="rx-hit-copy">
                      <strong>{lead.full_name}</strong>
                      <small>
                        {t("aDash.lead2", { p: lead.phone ? formatUzPhone(lead.phone) : "—", p2: lead.source_details ? ` · ${lead.source_details}` : "" })}
                      </small>
                    </span>
                  </div>
                  <div className="rx-hit-actions">
                    {lead.phone ? (
                      <a className="rx-btn is-outline is-sm" href={`tel:${lead.phone}`}>
                        {t("aDash.call")}
                      </a>
                    ) : null}
                    <button type="button" className="rx-btn is-outline is-sm" onClick={() => openTrialFor({ ...lead, kind: "lead" })}>
                      {t("aDash.trial")}
                    </button>
                    <Link className="rx-btn is-outline is-sm" to={path("crm")}>
                      CRM
                    </Link>
                  </div>
                </div>
              ))}

            {(searchTab === "all" || searchTab === "teachers") &&
              searchHits.teachers.map(({ teacher }) => (
                <div key={`t-${teacher.id}`} className="rx-hit">
                  <button type="button" className="rx-hit-main" onClick={() => setCardTeacher(teacher)}>
                    <span className="rx-av is-teal">{initialsOf(teacher.name)}</span>
                    <span className="rx-hit-copy">
                      <strong>{teacher.name}</strong>
                      <small>
                        {t("aDash.teacher2")} {teacher.phone ? formatUzPhone(teacher.phone) : "—"}
                        {teacher.courseNames?.length ? ` · ${teacher.courseNames.join(" / ")}` : ""}
                        {t("aDash.groupsCount", { count: teacher.groups?.length || 0 })}
                      </small>
                    </span>
                  </button>
                  <div className="rx-hit-actions">
                    <Link className="rx-btn is-outline is-sm" to={`${path("schedule")}?teacher=${encodeURIComponent(teacher.id)}`}>
                      {t("aDash.schedule")}
                    </Link>
                    {teacher.phone ? (
                      <a className="rx-btn is-outline is-sm" href={`tel:${teacher.phone}`}>
                        {t("aDash.call")}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        ) : null}
      </section>

      <section className="rx-quick" aria-label={t("aDash.whatToDoNow")}>
        {quickActions.map(({ key, tone, icon: Icon, title, text, run }) => (
          <button key={key} type="button" className={`rx-quick-card ${tone || ""}`.trim()} onClick={run}>
            <span className="rx-quick-icon">
              <Icon size={20} />
            </span>
            <kbd className="rx-quick-key" title={t("rxDash.hotkey", { key })}>{key}</kbd>
            <strong>{title}</strong>
            <small>{text}</small>
          </button>
        ))}
      </section>

      <section className="rx-stats" aria-label={t("aDash.todayAtAGlance")}>
        <article className="rx-stat">
          <span>{t("rxDash.statLessons")}</span>
          <strong>{loading ? "—" : lessonsToday.length}</strong>
          <small>{t("rxDash.liveNow", { count: lessonRows.filter((row) => row.state === "live").length })}</small>
        </article>
        <article className="rx-stat">
          <span>{t("rxDash.statCame")}</span>
          <strong>{expectedTotal ? `${cameTotal} / ${expectedTotal}` : "—"}</strong>
          <small>
            {expectedTotal
              ? t("rxDash.attendanceRate", { pct: Math.round((cameTotal / expectedTotal) * 100) })
              : t("rxDash.noMarksYet")}
          </small>
        </article>
        <article className="rx-stat">
          <span>{t("rxDash.statTrials")}</span>
          <strong>{loading ? "—" : trialsToday.length}</strong>
          <small>{t("rxDash.trialsCame", { count: trialsCame })}</small>
        </article>
        <article className="rx-stat">
          <span>{t("rxDash.statContacts")}</span>
          <strong className={contactsDue.length ? "is-amber" : ""}>{contactsDue.length}</strong>
          <small>{t("rxDash.overdueCount", { count: followOverdue.length })}</small>
        </article>
        <article className="rx-stat">
          <span>{t("rxDash.statDebts")}</span>
          <strong className={debtors.length ? "is-red" : ""}>
            {secondaryLoading && !students.length ? "—" : t("plural.students", { count: debtors.length })}
          </strong>
          <small>{money(debtSum, currency)}</small>
        </article>
      </section>

      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="ok">{info}</Banner> : null}

      {createdLead ? (
        <section className="rx-card rx-next">
          <div className="rx-card-head">
            <div>
              <h2>{t("aDash.whatNext")}</h2>
              <p>
                {createdLead.full_name} · {createdLead.phone}
              </p>
            </div>
            <button type="button" className="rx-btn is-ghost is-sm" onClick={() => setCreatedLead(null)}>
              {t("aDash.close")}
            </button>
          </div>
          <div className="rx-next-actions">
            <button
              type="button"
              className="rx-btn is-primary"
              onClick={() => openTrialFor({ ...createdLead, kind: "lead", course: visitorForm.course })}
            >
              {t("aDash.bookATrialLesson")}
            </button>
            <button
              type="button"
              className="rx-btn is-outline"
              onClick={async () => {
                const when = new Date(Date.now() + 3600000).toISOString();
                await api.patch(`/leads/${createdLead.id}`, { next_follow_up_at: when });
                setInfo(t("aDash.callScheduledInAn"));
                setCreatedLead(null);
                load();
              }}
            >
              {t("aDash.scheduleACall")}
            </button>
            <button
              type="button"
              className="rx-btn is-outline"
              onClick={() => {
                setConvertLead(createdLead);
                setConvertGroup("");
              }}
            >
              {t("aDash.createStudent")}
            </button>
            <button type="button" className="rx-btn is-outline" onClick={() => navigate(path("crm"))}>
              {t("aDash.openCrm")}
            </button>
          </div>
        </section>
      ) : null}

      <div className="rx-grid">
        <div className="rx-col">
          <section className="rx-card">
            <div className="rx-card-head">
              <div>
                <h2>{t("aDash.lessonsToday")}</h2>
                <p>{t("rxDash.lessonsSub")}</p>
              </div>
              <div className="rx-seg is-small" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={lessonTab === "next"}
                  className={lessonTab === "next" ? "is-active" : ""}
                  onClick={() => setLessonTab("next")}
                >
                  {t("rxDash.nowAndNext")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={lessonTab === "all"}
                  className={lessonTab === "all" ? "is-active" : ""}
                  onClick={() => setLessonTab("all")}
                >
                  {t("rxDash.allCount", { count: lessonRows.length })}
                </button>
              </div>
            </div>
            {loading ? (
              <p className="rx-empty">{t("aDash.loadingLessons")}</p>
            ) : !visibleLessons.length ? (
              <p className="rx-empty">{lessonRows.length ? t("rxDash.allLessonsOver") : t("aDash.noLessonsToday")}</p>
            ) : (
              <ul className="rx-lessons">
                {visibleLessons.map((row) => (
                  <li key={row.lesson.id}>
                    <Link to={path("attendance")} className={`rx-lesson is-${row.state}`}>
                      <span className="rx-lesson-time">{formatTime(row.lesson.starts_at)}</span>
                      <span className="rx-lesson-copy">
                        <strong>
                          {row.group?.name || "—"}
                          {row.course?.name && row.course.name !== row.group?.name ? <em>{row.course.name}</em> : null}
                          {isTrialLesson(row.lesson) ? <em className="is-trial">{t("aDash.trial")}</em> : null}
                        </strong>
                        <small className={row.state === "noteacher" ? "is-red" : ""}>
                          {row.teacher ? staffLabel(row.teacher) : t("rxDash.noTeacherLine")}
                          {row.room ? ` · ${row.room.name}` : ""}
                        </small>
                      </span>
                      <span className="rx-lesson-count">
                        {row.started && row.expected ? (
                          <>
                            <b>{t("rxDash.cameOf", { present: row.present, expected: row.expected })}</b>
                            <i className="rx-bar">
                              <i style={{ width: `${Math.min(100, Math.round((row.present / row.expected) * 100))}%` }} />
                            </i>
                          </>
                        ) : (
                          <b className="is-muted">{t("plural.students", { count: row.expected })}</b>
                        )}
                      </span>
                      {lessonPill(row)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link className="rx-link" to={path("schedule")}>
              {t("rxDash.openDaySchedule")} <IconArrowRight size={16} />
            </Link>
          </section>

          <section className="rx-card">
            <div className="rx-card-head">
              <h2>
                {t("rxDash.teachersToday")} <span className="rx-count">{teachersToday.length}</span>
              </h2>
              <Link className="rx-link is-head" to={path("teachers")}>
                {t("aDash.all")}
              </Link>
            </div>
            {!teachersToday.length ? (
              <p className="rx-empty">{t("aDash.nobodyIsTeachingToday")}</p>
            ) : (
              <ul className="rx-teachers">
                {teachersToday.map((row) => {
                  const current = row.lessons.find(
                    (l) => new Date(l.starts_at).getTime() <= nowMs && new Date(l.ends_at).getTime() > nowMs,
                  );
                  const upcoming = row.lessons.find((l) => new Date(l.starts_at).getTime() > nowMs);
                  const currentGroup = current ? groupMap[String(current.group)] : null;
                  const currentRoom = current ? roomMap[String(current.room)] : null;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="rx-teacher"
                        onClick={() =>
                          row.member &&
                          setCardTeacher({
                            ...row.member,
                            name: row.name,
                            phone: row.member.user?.phone || "",
                            email: row.member.user?.email || "",
                            groups: groups.filter((g) => String(g.teacher) === String(row.id)),
                            todayLessons: row.lessons,
                            courseNames: [],
                          })
                        }
                      >
                        <span className="rx-av is-soft">{initialsOf(row.name)}</span>
                        <span className="rx-hit-copy">
                          <strong>{row.name}</strong>
                          <small>
                            {current
                              ? [currentGroup?.name, currentRoom?.name].filter(Boolean).join(" · ")
                              : upcoming
                                ? t("rxDash.nextAt", { time: formatTime(upcoming.starts_at) })
                                : t("rxDash.dayDone")}
                          </small>
                        </span>
                        <span className={`rx-pill ${current ? "is-blue" : "is-teal"}`}>
                          {current ? t("rxDash.inLesson") : t("rxDash.free")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="rx-col">
          <section className="rx-card">
            <div className="rx-card-head">
              <h2>
                {t("aDash.needsAttention")} <span className={`rx-count${attention.length ? " is-red" : ""}`}>{attention.length}</span>
              </h2>
            </div>
            {!attention.length ? (
              <p className="rx-empty">{t("aDash.nothingUrgentWorkTo")}</p>
            ) : (
              <ul className="rx-attn">
                {(attentionAll ? attention : attention.slice(0, 5)).map((item) => (
                  <li key={item.id}>
                    <span className={`rx-attn-icon ${attentionTone(item)}`} aria-hidden="true">!</span>
                    <span className="rx-hit-copy">
                      <strong>{item.detail}</strong>
                      <small>{item.title}</small>
                    </span>
                    {attentionAction(item)}
                  </li>
                ))}
              </ul>
            )}
            {attention.length > 5 ? (
              <button type="button" className="rx-link" onClick={() => setAttentionAll((value) => !value)}>
                {attentionAll ? t("rxDash.showLess") : t("rxDash.showAll", { count: attention.length })}
              </button>
            ) : null}
          </section>

          <section className="rx-card">
            <div className="rx-card-head">
              <div>
                <h2>
                  {t("aDash.trialsToday")} <span className="rx-count">{trialsToday.length}</span>
                </h2>
                <p>{t("rxDash.trialsSub")}</p>
              </div>
            </div>
            {!trialsToday.length ? (
              <p className="rx-empty">{t("aDash.noTrialLessons")}</p>
            ) : (
              <ul className="rx-trials">
                {trialsToday.map((lesson) => {
                  const parsed = parseTrialTopic(lesson.topic);
                  const outcome = trialOutcomes[lesson.id];
                  const g = groupMap[String(lesson.group)];
                  const teacher = staffMap[String(lesson.teacher)];
                  const lead = findTrialLead(parsed);
                  return (
                    <li key={lesson.id} className={outcome === "came" ? "is-came" : ""}>
                      <div className="rx-trial-head">
                        <span className="rx-av is-soft">{initialsOf(parsed.name || t("aDash.visitor"))}</span>
                        <span className="rx-hit-copy">
                          <strong>{parsed.name || t("aDash.visitor")}</strong>
                          <small>
                            {formatTime(lesson.starts_at)}
                            {g ? ` · ${g.name}` : ""}
                            {teacher ? ` · ${staffLabel(teacher)}` : ""}
                          </small>
                        </span>
                        {outcome ? (
                          <span className={`rx-pill ${outcome === "came" ? "is-teal-solid" : "is-amber"}`}>
                            {t(`aRec.outcome_${outcome}`)}
                          </span>
                        ) : null}
                      </div>
                      <div className="rx-trial-actions">
                        {outcome === "came" ? (
                          lead ? (
                            <button
                              type="button"
                              className="rx-btn is-primary is-sm"
                              onClick={() => {
                                setConvertLead(lead);
                                setConvertGroup(String(lesson.group || ""));
                              }}
                            >
                              {t("rxDash.enrolInGroup")}
                            </button>
                          ) : null
                        ) : (
                          <>
                            <button type="button" className="rx-btn is-teal is-sm" onClick={() => markTrialStatus(lesson, "came")}>
                              {t("aDash.came2")}
                            </button>
                            <button type="button" className="rx-btn is-outline is-sm" onClick={() => markTrialStatus(lesson, "no_show")}>
                              {t("aDash.noShow")}
                            </button>
                          </>
                        )}
                        <button type="button" className="rx-btn is-outline is-sm" onClick={() => markTrialStatus(lesson, "rescheduled")}>
                          {t("rxDash.reschedule")}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rx-card">
            <div className="rx-card-head">
              <h2>
                {t("rxDash.contactToday")} <span className="rx-count">{contactsDue.length}</span>
              </h2>
            </div>
            {!contactsDue.length ? (
              <p className="rx-empty">{t("aDash.noContactsForToday")}</p>
            ) : (
              <ul className="rx-contacts">
                {contactsDue.slice(0, 8).map((lead) => {
                  const overdue = new Date(lead.next_follow_up_at) < new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <li key={lead.id}>
                      <span className="rx-hit-copy">
                        <strong>{lead.full_name}</strong>
                        <small className={overdue ? "is-red" : ""}>
                          {overdue
                            ? t("rxDash.overdueSince", { when: formatWhen(lead.next_follow_up_at) })
                            : lead.source_details || t("rxDash.dueAt", { time: formatTime(lead.next_follow_up_at) })}
                        </small>
                        <small>{lead.phone ? formatUzPhone(lead.phone) : "—"}</small>
                      </span>
                      {lead.phone ? (
                        <a className="rx-icon-btn is-teal" href={`tel:${lead.phone}`} aria-label={t("aDash.call")} title={t("aDash.call")}>
                          <IconPhone size={18} />
                        </a>
                      ) : null}
                      <button type="button" className="rx-btn is-outline is-sm" onClick={() => completeFollowUp(lead)}>
                        {t("aDash.done")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link className="rx-link" to={path("tasks")}>
              {t("rxDash.allTasksToday")} <IconArrowRight size={16} />
            </Link>
          </section>
        </div>
      </div>

      {secondaryLoading ? <p className="rx-loading">{t("aDash.loadingStudentsDebtsAnd")}</p> : null}

      <NewVisitorSheet
        open={visitorOpen}
        form={visitorForm}
        setForm={setVisitorForm}
        courses={courses}
        duplicates={visitorDuplicates}
        saving={visitorSaving}
        error={visitorError}
        onClose={() => setVisitorOpen(false)}
        onSubmit={submitVisitor}
        onOpenExisting={(item) => {
          setVisitorOpen(false);
          if (item.kind === "student") {
            const s = students.find((row) => String(row.id) === String(item.id));
            if (s) setCardStudent(s);
          } else {
            navigate(path("crm"));
          }
        }}
      />

      <TrialLessonSheet
        open={trialOpen}
        form={trialForm}
        setForm={setTrialForm}
        person={trialPerson}
        onPersonChange={setTrialPerson}
        peopleOptions={trialPeopleOptions}
        courses={courses}
        groups={groups}
        staff={staff
          .filter((s) => s.role === "teacher")
          .map((s) => {
            let avail = t("aDash.free");
            if (trialForm.date && trialForm.start_time && trialForm.end_time) {
              const startAt = combineDateTime(trialForm.date, trialForm.start_time).getTime();
              const endAt = combineDateTime(trialForm.date, trialForm.end_time).getTime();
              const conflict = lessons.find((l) => {
                if (String(l.teacher) !== String(s.id) || l.status === "cancelled") return false;
                const a = new Date(l.starts_at).getTime();
                const b = new Date(l.ends_at).getTime();
                return a < endAt && b > startAt;
              });
              if (conflict) {
                avail = t("aDash.busy", { time: formatTime(conflict.starts_at), time2: formatTime(conflict.ends_at) });
              }
            }
            return { ...s, _label: `${staffLabel(s)} · ${avail}` };
          })}
        rooms={rooms}
        saving={trialSaving}
        error={trialError}
        onClose={() => setTrialOpen(false)}
        onSubmit={submitTrial}
      />

      <QuickPaymentSheet
        key={`pay-${payOpen}-${payStudentId}`}
        open={payOpen}
        students={students}
        invoices={invoices}
        currency={currency}
        preselectStudentId={payStudentId}
        allowedMethods={financeSettings.allowed_payment_methods}
        defaultMethod={financeSettings.default_payment_method}
        onClose={() => setPayOpen(false)}
        onSuccess={(msg) => {
          setInfo(msg);
          load();
        }}
      />

      <QuickStudentSheet
        open={studentCreateOpen}
        courses={courses}
        groups={groups}
        staff={staff}
        students={students}
        leads={leads}
        onClose={() => setStudentCreateOpen(false)}
        onCreated={(student, action) => {
          load();
          if (action === "pay") {
            setStudentCreateOpen(false);
            setPayStudentId(String(student.id));
            setPayOpen(true);
          } else if (action === "open") {
            setStudentCreateOpen(false);
            setCardStudent(student);
          }
        }}
      />

      <StudentQuickCard
        open={Boolean(cardStudent)}
        student={cardStudent}
        groupName={cardStudent ? studentGroups(cardStudent.id)[0]?.name : ""}
        courseName={
          cardStudent
            ? courseMap[String(studentGroups(cardStudent.id)[0]?.course)]?.name
            : ""
        }
        teacherName={
          cardStudent
            ? staffLabel(staffMap[String(studentGroups(cardStudent.id)[0]?.teacher)])
            : ""
        }
        parent={cardStudent ? studentParent(cardStudent.id) : null}
        debt={cardStudent ? studentDebt(cardStudent.id) : 0}
        invoices={cardStudent ? invoices.filter((inv) => String(inv.student) === String(cardStudent.id)) : []}
        currency={currency}
        todayLesson={cardStudent ? studentTodayLesson(cardStudent.id) : null}
        onClose={() => setCardStudent(null)}
        onPay={() => {
          setPayStudentId(String(cardStudent.id));
          setCardStudent(null);
          setPayOpen(true);
        }}
        onNotify={() => {
          setCardStudent(null);
          setNotifyOpen(true);
        }}
        onFullProfile={() => navigate(path("students"))}
        onSaved={(msg) => {
          setInfo(msg);
          invalidateApiCache(session.tenantId);
          loadAttendanceForLessons(lessons).then(setAttendanceByLesson);
        }}
      />

      <TeacherDrawer
        open={Boolean(cardTeacher)}
        teacher={cardTeacher}
        courses={courses}
        onClose={() => setCardTeacher(null)}
        schedulePath={
          cardTeacher
            ? `${path("schedule")}?teacher=${encodeURIComponent(cardTeacher.id)}`
            : path("schedule")
        }
        groupsPath={path("groups")}
      />

      <MarkArrivalSheet
        open={Boolean(arriveStudent)}
        student={arriveStudent}
        lessons={lessons}
        groups={groups}
        enrollments={enrollments}
        onClose={() => setArriveStudent(null)}
        onSaved={(msg) => {
          setInfo(msg);
          load();
        }}
      />

      <NotificationsSendSheet
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        onSent={() => {
          setNotifyOpen(false);
          setInfo(t("aDash.notificationSent"));
        }}
        tenantName={membership?.tenant_name || tenantSlug}
        students={students}
        groups={groups}
        courses={courses}
        enrollments={enrollments}
      />

      {convertLead ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aDash.conversion")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aDash.close")}
            onClick={() => setConvertLead(null)}
          />
          <div className="sheet reception-sheet">
            <div className="sheet-head">
              <div>
                <h2>{t("aDash.createAStudentFrom")}</h2>
                <p className="muted">
                  {convertLead.full_name} · {convertLead.phone}
                </p>
              </div>
              <button
                type="button"
                className="sheet-close"
                onClick={() => setConvertLead(null)}
                aria-label={t("aDash.close")}
              >
                ×
              </button>
            </div>
            <div className="sheet-body">
              <label className="field">
                <span>{t("aDash.groupOptional")}</span>
                <select value={convertGroup} onChange={(e) => setConvertGroup(e.target.value)}>
                  <option value="">{t("aDash.noGroup2")}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="sheet-foot">
              <Button type="button" variant="ghost" onClick={() => setConvertLead(null)}>
                {t("aDash.cancel")}
              </Button>
              <Button type="button" disabled={convertBusy} onClick={doConvert}>
                {convertBusy ? "…" : t("aDash.convert")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
