import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Banner,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  RowActionsMenu,
  StatCard,
  TextAction,
} from "@/components/ui";
import { STUDENT_STATUS_LABELS } from "@/constants";
import { api } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import { educationSegmentPath } from "@/utils/routes";
import { formatDate, today, addDays } from "@/utils/format";
import { t, translated } from "@/i18n";

/* rule.weekday comes from the API: 0 = Monday … 6 = Sunday (Python date.weekday()),
   the same order as week.days. */
const weekdayShort = (day) => t("week.days").split(",")[Number(day)];
const GROUP_STATUSES = [
  { value: "planned", label: "t:aGrp.stPlanned" },
  { value: "active", label: "t:aGrp.stActive" },
  { value: "completed", label: "t:aGrp.stCompleted" },
  { value: "archived", label: "t:aGrp.stArchived" },
].map(translated);
const DURATION_PRESETS = [
  { label: "t:aGrp.preset3m", days: 92 },
  { label: "t:aGrp.preset6m", days: 183 },
  { label: "t:aGrp.preset9m", days: 274 },
  { label: "t:aGrp.preset1y", days: 365 },
].map(translated);

const emptyForm = {
  name: "",
  course: "",
  teacher: "",
  capacity: 10,
  start_date: today(),
  end_date: addDays(today(), 183),
  status: "active",
};

function asList(path) {
  return getList(path);
}

async function optionalList(path) {
  try {
    return await asList(path);
  } catch {
    return [];
  }
}

function staffLabel(staff, id) {
  if (!id) return null;
  const item = staff.find((row) => String(row.id) === String(id));
  if (!item?.user) return null;
  const user = item.user;
  return user.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
}

function formatRuleTime(value) {
  if (!value) return "—";
  const parts = String(value).split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return value;
}

function validateDates(startDate, endDate) {
  if (!startDate || !endDate) return "";
  if (endDate < startDate) return t("aGrp.theEndDateCannot");
  return "";
}

function applyDuration(startDate, days) {
  const base = startDate || today();
  return addDays(base, days);
}

function DurationPicks({ startDate, onPick }) {
  return (
    <div className="groups-date-picks">
      <span className="muted">{t("aGrp.quick")}</span>
      {DURATION_PRESETS.map((item) => (
        <button
          key={item.days}
          type="button"
          className="groups-date-pick"
          onClick={() => onPick(applyDuration(startDate, item.days))}
        >
          {item.label}
        </button>
      ))}
      <button type="button" className="groups-date-pick" onClick={() => onPick("")}>
        {t("aGrp.noDate")}
      </button>
    </div>
  );
}

function GroupDatesFields({ startDate, endDate, onStartChange, onEndChange }) {
  const dateError = validateDates(startDate, endDate);
  return (
    <>
      <Field label={t("aGrp.startDate")}>
        <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} />
      </Field>
      <Field label={t("aGrp.endDate")}>
        <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => onEndChange(e.target.value)} />
      </Field>
      <div className="groups-date-picks-wrap">
        <DurationPicks startDate={startDate} onPick={onEndChange} />
        {dateError ? <p className="groups-date-error">{dateError}</p> : null}
      </div>
    </>
  );
}

function scheduleSummary(rules) {
  if (!rules.length) return "—";
  return rules
    .slice(0, 2)
    .map(
      (rule) =>
        `${weekdayShort(rule.weekday) || rule.weekday} ${formatRuleTime(rule.starts_at)}`,
    )
    .join(", ");
}

function durationLabel(startDate, endDate) {
  if (!startDate || !endDate) return "—";
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  const days = Math.round((end - start) / 86400000);
  if (days < 0) return "—";
  if (days < 32) return t("aGrp.d", { days });
  const months = Math.round(days / 30.44);
  if (months < 12) return t("aGrp.mo", { months });
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem ? t("aGrp.yrMo", { years, rem }) : t("aGrp.yr", { years });
}

function enrichGroups({ groups, courses, staff, rules, rooms, enrollments, students }) {
  const courseMap = Object.fromEntries(courses.map((item) => [item.id, item]));
  const roomMap = Object.fromEntries(rooms.map((item) => [item.id, item]));
  const studentMap = Object.fromEntries(students.map((item) => [item.id, item]));
  const rulesByGroup = {};
  for (const rule of rules) {
    (rulesByGroup[rule.group] ||= []).push(rule);
  }
  const enrollmentsByGroup = {};
  for (const row of enrollments) {
    (enrollmentsByGroup[row.group] ||= []).push(row);
  }

  return groups.map((group) => {
    const groupRules = (rulesByGroup[group.id] || []).filter((item) => item.is_active);
    const roomIds = [...new Set(groupRules.map((item) => item.room).filter(Boolean))];
    const roomsList = roomIds.map((id) => roomMap[id]?.name).filter(Boolean);
    const groupEnrollments = enrollmentsByGroup[group.id] || [];
    const activeEnrollments = groupEnrollments.filter((item) => item.status === "active");
    const memberStudents = activeEnrollments
      .map((item) => {
        const student = studentMap[item.student];
        if (!student) return null;
        return { ...student, enrollment_id: item.id, enrollment_status: item.status };
      })
      .filter(Boolean);

    const count = Number(group.active_students ?? memberStudents.length);
    const capacity = Number(group.capacity || 0);
    const fillPct = capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : 0;

    return {
      ...group,
      course_name: courseMap[group.course]?.name || "—",
      teacher_label: staffLabel(staff, group.teacher) || "—",
      schedule_rules: groupRules,
      schedule_label: scheduleSummary(groupRules),
      room_label: roomsList.length ? roomsList.join(", ") : "—",
      duration_label: durationLabel(group.start_date, group.end_date),
      enrollments: groupEnrollments,
      students: memberStudents,
      student_count: count,
      fill_pct: fillPct,
      is_full: capacity > 0 && count >= capacity,
      has_seats: capacity > 0 && count < capacity,
    };
  });
}

function CapacityCell({ count, capacity, fillPct, isFull }) {
  return (
    <div className="groups-capacity">
      <span className={isFull ? "groups-capacity-full" : ""}>
        {count} / {capacity}
      </span>
      <div className="groups-capacity-bar" aria-hidden="true">
        <i style={{ width: `${fillPct}%` }} className={isFull ? "is-full" : ""} />
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const { tenantSlug = "" } = useParams();
  const canWrite = ["owner", "admin"].includes(currentMembership()?.role);
  const studentsPath = educationSegmentPath(tenantSlug, "students");

  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [capacityFilter, setCapacityFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({ student: "", joined_at: today() });
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [removeEnrollmentId, setRemoveEnrollmentId] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      const [groupData, courseData, staffData, ruleData, roomData, enrollmentData, studentData] =
        await Promise.all([
          asList("/groups?page_size=100"),
          asList("/courses?page_size=100"),
          optionalList("/staff?page_size=100"),
          optionalList("/schedule-rules?page_size=200"),
          optionalList("/rooms?page_size=100"),
          optionalList("/enrollments?page_size=200"),
          optionalList("/students?page_size=100"),
        ]);
      const courseList = courseData;
      const teachers = staffData.filter((item) => item.role === "teacher");
      setCourses(courseList);
      setStaff(teachers);
      setAllStudents(studentData);
      setRooms(roomData);
      setGroups(
        enrichGroups({
          groups: groupData,
          courses: courseList,
          staff: teachers,
          rules: ruleData,
          rooms: roomData,
          enrollments: enrollmentData,
          students: studentData,
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((group) => {
      if (courseFilter && String(group.course) !== String(courseFilter)) return false;
      if (teacherFilter === "none" && group.teacher) return false;
      if (teacherFilter && teacherFilter !== "none" && String(group.teacher) !== String(teacherFilter)) {
        return false;
      }
      if (statusFilter && group.status !== statusFilter) return false;
      if (capacityFilter === "available" && !group.has_seats) return false;
      if (capacityFilter === "full" && !group.is_full) return false;
      if (!q) return true;
      return [group.name, group.course_name, group.teacher_label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [groups, query, courseFilter, teacherFilter, statusFilter, capacityFilter]);

  const selected = useMemo(
    () => groups.find((item) => String(item.id) === String(selectedId)) || null,
    [groups, selectedId],
  );

  const stats = useMemo(
    () => ({
      total: groups.length,
      active: groups.filter((item) => item.status === "active").length,
      students: groups.reduce((sum, item) => sum + item.student_count, 0),
      noTeacher: groups.filter((item) => !item.teacher).length,
    }),
    [groups],
  );

  const availableStudents = useMemo(() => {
    if (!selected) return [];
    const enrolled = new Set(selected.students.map((item) => String(item.id)));
    const q = studentPickerQuery.trim().toLowerCase();
    return allStudents.filter((item) => {
      if (enrolled.has(String(item.id)) || item.status !== "active") return false;
      if (!q) return true;
      return [item.full_name, item.phone, item.email].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [selected, allStudents, studentPickerQuery]);

  function openAddStudent() {
    setFormError("");
    setStudentPickerQuery("");
    setAddStudentForm({ student: "", joined_at: today() });
    setAddStudentOpen(true);
  }

  function openCreate() {
    setFormError("");
    const start = today();
    setForm({
      ...emptyForm,
      course: courses[0]?.id || "",
      teacher: staff[0]?.id || "",
      start_date: start,
      end_date: addDays(start, 183),
    });
    setCreateOpen(true);
  }

  function onCreateCourseChange(courseId) {
    const course = courses.find((item) => String(item.id) === String(courseId));
    const sibling = groups.find((item) => String(item.course) === String(courseId));
    setForm((prev) => ({
      ...prev,
      course: courseId,
      name:
        prev.name.trim() ||
        (course ? t("aGrp.group", { name: course.name, p: groups.filter((g) => String(g.course) === String(courseId)).length + 1 }) : ""),
      teacher: prev.teacher || sibling?.teacher || "",
      capacity: prev.capacity || sibling?.capacity || 10,
    }));
  }

  function openGroup(group) {
    setError("");
    setInfo("");
    setFormError("");
    setRemoveEnrollmentId("");
    setAddStudentOpen(false);
    setSelectedId(group.id);
    setEditOpen(false);
    setEditForm(null);
  }

  function openEdit(group = selected) {
    if (!group) return;
    setSelectedId(group.id);
    setFormError("");
    setEditForm({
      name: group.name || "",
      course: group.course || "",
      teacher: group.teacher || "",
      capacity: group.capacity || 10,
      start_date: group.start_date || today(),
      end_date: group.end_date || "",
      status: group.status || "active",
    });
    setEditOpen(true);
  }

  function closeGroup() {
    setSelectedId("");
    setEditOpen(false);
    setEditForm(null);
    setAddStudentOpen(false);
    setRemoveEnrollmentId("");
    setFormError("");
  }

  async function createGroup(event) {
    event.preventDefault();
    setFormError("");
    const name = form.name.trim();
    if (!name) {
      setFormError(t("aGrp.enterAGroupName"));
      return;
    }
    if (!form.course) {
      setFormError(t("aGrp.chooseACourse"));
      return;
    }
    const dateError = validateDates(form.start_date, form.end_date);
    if (dateError) {
      setFormError(dateError);
      return;
    }
    setBusy(true);
    try {
      await api.post("/groups", {
        name,
        course: form.course,
        teacher: form.teacher || null,
        capacity: Number(form.capacity) || 10,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
      });
      setCreateOpen(false);
      setInfo(t("aGrp.groupCreated", { name }));
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveGroup(event) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setFormError("");
    const name = editForm.name.trim();
    if (!name) {
      setFormError(t("aGrp.enterAGroupName"));
      return;
    }
    const dateError = validateDates(editForm.start_date, editForm.end_date);
    if (dateError) {
      setFormError(dateError);
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/groups/${selected.id}`, {
        name,
        course: editForm.course,
        teacher: editForm.teacher || null,
        capacity: Number(editForm.capacity) || 10,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        status: editForm.status,
      });
      setEditOpen(false);
      setInfo(t("aGrp.groupSaved"));
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function addStudentToGroup(event) {
    event.preventDefault();
    if (!selected || !addStudentForm.student) return;
    setFormError("");
    setBusy(true);
    try {
      await api.post("/enrollments", {
        student: addStudentForm.student,
        group: selected.id,
        joined_at: addStudentForm.joined_at || today(),
      });
      setAddStudentOpen(false);
      setStudentPickerQuery("");
      setAddStudentForm({ student: "", joined_at: today() });
      setInfo(t("aGrp.studentEnrolledInThe"));
      const keepId = selected.id;
      await load();
      setSelectedId(keepId);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setGroupStatus(group, status) {
    if (!canWrite) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/groups/${group.id}`, { status });
      setInfo(t("aGrp.groupStatusUpdated"));
      const keepId = group.id;
      await load();
      setSelectedId(keepId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicateGroup(group) {
    if (!canWrite) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/groups", {
        name: `${group.name} (копия)`,
        course: group.course,
        teacher: group.teacher || null,
        capacity: group.capacity,
        start_date: group.start_date || null,
        end_date: group.end_date || null,
        status: "planned",
      });
      setInfo(t("aGrp.groupDuplicated", { name: group.name }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function groupMenuItems(group, { includeView = false } = {}) {
    return [
      { label: t("aGrp.view"), onClick: () => openGroup(group), hidden: !includeView },
      { label: t("aGrp.editGroup"), onClick: () => openEdit(group), hidden: !canWrite },
      { label: t("aGrp.duplicate"), onClick: () => duplicateGroup(group), hidden: !canWrite, disabled: busy },
      {
        label: t("aGrp.activate"),
        onClick: () => setGroupStatus(group, "active"),
        hidden: !canWrite || group.status === "active",
        disabled: busy,
      },
      {
        label: t("aGrp.complete"),
        onClick: () => setGroupStatus(group, "completed"),
        hidden: !canWrite || group.status === "completed",
        disabled: busy,
      },
      {
        label: t("aGrp.archive"),
        onClick: () => setGroupStatus(group, "archived"),
        hidden: !canWrite || group.status === "archived",
        disabled: busy,
      },
    ];
  }

  async function removeStudentFromGroup(enrollmentId) {
    if (!selected || !enrollmentId) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/enrollments/${enrollmentId}`, { status: "cancelled" });
      setRemoveEnrollmentId("");
      setInfo(t("aGrp.studentRemovedFromThe"));
      const keepId = selected.id;
      await load();
      setSelectedId(keepId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hasFilters = query || courseFilter || teacherFilter || statusFilter || capacityFilter;

  return (
    <div className="groups-page">
      <PageHeader
        title={t("aGrp.groups")}
        subtitle={t("aGrp.manageStudyGroups")}
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              {t("aGrp.createGroup")}
            </Button>
          ) : null
        }
      />
      <Banner>{error}</Banner>
      <Banner tone="ok">{info}</Banner>

      {!loading && groups.length ? (
        <div className="groups-stats grid cols-4">
          <StatCard label={t("aGrp.totalGroups")} value={stats.total} />
          <StatCard label={t("aGrp.activeGroups")} value={stats.active} />
          <StatCard label={t("aGrp.totalStudents")} value={stats.students} hint={t("aGrp.inActiveGroups")} />
          <StatCard label={t("aGrp.withoutATeacher")} value={stats.noTeacher} />
        </div>
      ) : null}

      <div className="crm-toolbar">
        <div className="crm-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("aGrp.searchByGroupName")}
          />
          <button
            type="button"
            className={`crm-filter-btn ${filtersOpen ? "is-active" : ""}`}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            {t("aGrp.filters")}
          </button>
        </div>
        <div className="crm-toolbar-stats">
          <span>
            {t("aGrp.shown")} <strong>{filtered.length}</strong>
          </span>
          <span className="dot" />
          <span>
            {t("aGrp.total")} <strong>{groups.length}</strong>
          </span>
        </div>
      </div>

      {filtersOpen ? (
        <div className="crm-filters">
          <Field label={t("aGrp.course")}>
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="">{t("aGrp.allCourses")}</option>
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("aGrp.teacher")}>
            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
              <option value="">{t("aGrp.all")}</option>
              <option value="none">{t("aGrp.withoutATeacher")}</option>
              {staff.map((item) => (
                <option key={item.id} value={item.id}>
                  {staffLabel(staff, item.id) || item.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("aGrp.status")}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("aGrp.allStatuses")}</option>
              {GROUP_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("aGrp.places")}>
            <select value={capacityFilter} onChange={(e) => setCapacityFilter(e.target.value)}>
              <option value="">{t("aGrp.all")}</option>
              <option value="available">{t("aGrp.placesAvailable")}</option>
              <option value="full">{t("aGrp.fullGroups")}</option>
            </select>
          </Field>
          <Button type="button" className="secondary compact" busy={loading} onClick={load}>
            {t("aGrp.refresh")}
          </Button>
          {hasFilters ? (
            <Button
              type="button"
              className="secondary compact"
              onClick={() => {
                setQuery("");
                setCourseFilter("");
                setTeacherFilter("");
                setStatusFilter("");
                setCapacityFilter("");
              }}
            >
              {t("aGrp.reset")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <EmptyState title={t("aGrp.loading")} body={t("aGrp.fetchingTheGroupList")} />
        </div>
      ) : error && !groups.length ? (
        <div className="card">
          <EmptyState
            title={t("aGrp.couldNotLoadGroups")}
            body={error}
            action={
              <Button type="button" className="secondary" onClick={load}>
                {t("aGrp.retry")}
              </Button>
            }
          />
        </div>
      ) : !groups.length ? (
        <div className="card">
          <EmptyState
            title={t("aGrp.noGroupsYet")}
            body={t("aGrp.createAGroupAnd")}
            action={
              canWrite ? (
                <Button type="button" onClick={openCreate}>
                  {t("aGrp.createGroup")}
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="card groups-table-card">
          <DataTable
            rows={filtered}
            empty={hasFilters ? t("aGrp.nothingMatchesTheFilters") : t("aGrp.noGroupsYet2")}
            onRowClick={openGroup}
            columns={[
              {
                key: "name",
                title: t("aGrp.group2"),
                render: (row) => (
                  <button
                    type="button"
                    className="table-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      openGroup(row);
                    }}
                  >
                    {row.name}
                  </button>
                ),
              },
              { key: "course", title: t("aGrp.course"), render: (row) => row.course_name },
              { key: "teacher", title: t("aGrp.teacher"), render: (row) => (
                row.teacher ? (
                  row.teacher_label
                ) : (
                  <span className="groups-no-teacher">
                    {t("aGrp.noTeacherAssigned")}
                    {canWrite ? (
                      <button
                        type="button"
                        className="text-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(row);
                        }}
                      >
                        {t("aGrp.assign")}
                      </button>
                    ) : null}
                  </span>
                )
              ) },
              {
                key: "students",
                title: t("aGrp.students"),
                render: (row) => row.student_count,
              },
              {
                key: "capacity",
                title: t("aGrp.places"),
                render: (row) => (
                  <CapacityCell
                    count={row.student_count}
                    capacity={row.capacity}
                    fillPct={row.fill_pct}
                    isFull={row.is_full}
                  />
                ),
              },
              { key: "schedule", title: t("aGrp.schedule"), render: (row) => row.schedule_label },
              {
                key: "start_date",
                title: t("aGrp.period"),
                render: (row) => (
                  <>
                    <div>{formatDate(row.start_date)}</div>
                    <div className="muted">{row.end_date ? t("aGrp.until", { date: formatDate(row.end_date) }) : "—"}</div>
                  </>
                ),
              },
              {
                key: "status",
                title: t("aGrp.status"),
                render: (row) => <Badge value={row.status} />,
              },
              {
                key: "actions",
                title: "",
                stopRowClick: true,
                render: (row) => <RowActionsMenu items={groupMenuItems(row, { includeView: true })} />,
              },
            ]}
          />
        </div>
      )}

      {createOpen ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aGrp.newGroup")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aGrp.close")}
            onClick={() => setCreateOpen(false)}
          />
          <form className="sheet" onSubmit={createGroup}>
            <div className="sheet-head">
              <div>
                <div className="topbar-eyebrow">{t("aGrp.groups")}</div>
                <h2>{t("aGrp.createGroup")}</h2>
                <p className="muted">{t("aGrp.scheduleAndRoomAre")}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                onClick={() => setCreateOpen(false)}
                aria-label={t("aGrp.close")}
              >
                ×
              </button>
            </div>
            <div className="sheet-body">
              <Banner>{formError}</Banner>
              <div className="grid cols-2" style={{ gap: 12 }}>
            <Field label={t("aGrp.name")}>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                    autoFocus
              />
            </Field>
            <Field label={t("aGrp.course")}>
                  <select
                    value={form.course}
                    onChange={(e) => onCreateCourseChange(e.target.value)}
                    required
                  >
                    <option value="">{t("aGrp.chooseACourse2")}</option>
                {courses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("aGrp.teacher")}>
              <select
                value={form.teacher}
                onChange={(e) => setForm({ ...form, teacher: e.target.value })}
              >
                    <option value="">{t("aGrp.notAssigned")}</option>
                {staff.map((item) => (
                  <option key={item.id} value={item.id}>
                        {staffLabel(staff, item.id) || item.id}
                  </option>
                ))}
              </select>
            </Field>
                <Field label={t("aGrp.studentLimit")}>
              <input
                type="number"
                    min={1}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    required
                  />
                </Field>
                <GroupDatesFields
                  startDate={form.start_date}
                  endDate={form.end_date}
                  onStartChange={(start_date) => setForm({ ...form, start_date })}
                  onEndChange={(end_date) => setForm({ ...form, end_date })}
                />
                <Field label={t("aGrp.status")}>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {GROUP_STATUSES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="sheet-foot">
              <Button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
                {t("aGrp.cancel")}
              </Button>
              <Button type="submit" busy={busy}>
                {t("aGrp.createGroup2")}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {selected ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aGrp.groupCard")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aGrp.close")}
            onClick={closeGroup}
          />
          <aside className="sheet sheet-detail sheet-wide">
            <div className="sheet-head">
              <div>
                <div className="topbar-eyebrow">
                  {editOpen ? t("aGrp.editing") : selected.course_name}
                </div>
                <h2>{editOpen ? t("aGrp.editGroup") : selected.name}</h2>
                <p className="muted">{editOpen ? selected.name : selected.teacher_label}</p>
              </div>
              <div className="sheet-head-actions">
                {canWrite && !editOpen ? <RowActionsMenu items={groupMenuItems(selected)} /> : null}
                <button
                  type="button"
                  className="sheet-close"
                  onClick={editOpen ? () => setEditOpen(false) : closeGroup}
                  aria-label={t("aGrp.close")}
                >
                  ×
                </button>
              </div>
            </div>

            <div className="sheet-body">
              {editOpen && editForm ? (
                <form className="grid" style={{ gap: 12 }} onSubmit={saveGroup}>
                  <Banner>{formError}</Banner>
                  <div className="grid cols-2" style={{ gap: 12 }}>
                    <Field label={t("aGrp.name")}>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                        autoFocus
                      />
                    </Field>
                    <Field label={t("aGrp.course")}>
                      <select
                        value={editForm.course}
                        onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                        required
                      >
                        {courses.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("aGrp.teacher")}>
                      <select
                        value={editForm.teacher}
                        onChange={(e) => setEditForm({ ...editForm, teacher: e.target.value })}
                      >
                        <option value="">{t("aGrp.notAssigned")}</option>
                        {staff.map((item) => (
                          <option key={item.id} value={item.id}>
                            {staffLabel(staff, item.id) || item.id}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("aGrp.studentLimit")}>
                      <input
                        type="number"
                        min={1}
                        value={editForm.capacity}
                        onChange={(e) => setEditForm({ ...editForm, capacity: Number(e.target.value) })}
                        required
              />
            </Field>
                    <GroupDatesFields
                      startDate={editForm.start_date}
                      endDate={editForm.end_date}
                      onStartChange={(start_date) => setEditForm({ ...editForm, start_date })}
                      onEndChange={(end_date) => setEditForm({ ...editForm, end_date })}
                    />
                    <Field label={t("aGrp.status")}>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      >
                        {GROUP_STATUSES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </Field>
          </div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <Button type="submit" busy={busy}>
            {t("aGrp.save")}
          </Button>
                    <Button type="button" className="secondary" onClick={() => setEditOpen(false)}>
                      {t("aGrp.cancel")}
                    </Button>
                  </div>
        </form>
              ) : (
                <>
              <div className="detail-badges">
                <Badge value={selected.status} />
                <Badge value="active" label={t("aGrp.places2", { student_count: selected.student_count, capacity: selected.capacity })} />
              </div>

              <section className="detail-section groups-students-panel">
                <div className="groups-section-head">
                  <h3>{t("aGrp.students2", { length: selected.students.length, capacity: selected.capacity })}</h3>
                  {canWrite ? (
                    <Button
                      type="button"
                      className="compact"
                      onClick={openAddStudent}
                      disabled={selected.is_full}
                    >
                      {t("aGrp.addStudent")}
                    </Button>
                  ) : null}
                </div>
                {selected.is_full ? (
                  <p className="muted groups-hint">{t("aGrp.theGroupIsFull")}</p>
                ) : null}
                {selected.students.length ? (
                  <div className="table-wrap groups-students-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{t("aGrp.fullName")}</th>
                          <th>{t("aGrp.phone")}</th>
                          <th>{t("aGrp.status")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {selected.students.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <strong>{student.full_name}</strong>
                            </td>
                            <td>{student.phone || "—"}</td>
                            <td>
                              <Badge
                                value={student.status}
                                label={STUDENT_STATUS_LABELS[student.status] || student.status}
                              />
                            </td>
                            <td>
                              <div className="groups-student-actions">
                                <Link className="text-action" to={studentsPath}>
                                  {t("aGrp.profile")}
                                </Link>
                                {canWrite ? (
                                  removeEnrollmentId === student.enrollment_id ? (
                                    <div className="inline-confirm">
                                      <span>{t("aGrp.remove")}</span>
                                      <Button
                                        type="button"
                                        className="compact"
                                        busy={busy}
                                        onClick={() => removeStudentFromGroup(student.enrollment_id)}
                                      >
                                        {t("aGrp.yes")}
                                      </Button>
                                      <Button
                                        type="button"
                                        className="secondary compact"
                                        onClick={() => setRemoveEnrollmentId("")}
                                      >
                                        {t("aGrp.no")}
                                      </Button>
                                    </div>
                                  ) : (
                                    <TextAction
                                      onClick={() => setRemoveEnrollmentId(student.enrollment_id)}
                                    >
                                      {t("aGrp.remove2")}
                                    </TextAction>
                                  )
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="groups-students-empty">
                    <p className="muted">{t("aGrp.noStudentsInThe")}</p>
                    {canWrite && !selected.is_full ? (
                      <Button type="button" onClick={openAddStudent}>
                        {t("aGrp.addTheFirstStudent")}
                      </Button>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="detail-section">
                <h3>{t("aGrp.aboutTheGroup")}</h3>
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>{t("aGrp.course")}</dt>
                    <dd>{selected.course_name}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.teacher")}</dt>
                    <dd>{selected.teacher_label}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.startDate")}</dt>
                    <dd>{formatDate(selected.start_date)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.endDate")}</dt>
                    <dd>{formatDate(selected.end_date)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.period")}</dt>
                    <dd>{selected.duration_label}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.schedule")}</dt>
                    <dd>{selected.schedule_label}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.room")}</dt>
                    <dd>{selected.room_label}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aGrp.places")}</dt>
                    <dd>
                      <CapacityCell
                        count={selected.student_count}
                        capacity={selected.capacity}
                        fillPct={selected.fill_pct}
                        isFull={selected.is_full}
                      />
                    </dd>
                  </div>
                </dl>
              </section>

              {selected.schedule_rules?.length ? (
                <section className="detail-section">
                  <h3>{t("aGrp.schedule")}</h3>
                  <ul className="doc-list">
                    {selected.schedule_rules.map((rule) => (
                      <li key={rule.id}>
                        <div>
                          <strong>
                            {weekdayShort(rule.weekday) || rule.weekday}{" "}
                            {formatRuleTime(rule.starts_at)}–{formatRuleTime(rule.ends_at)}
                          </strong>
                          <span>{rooms.find((r) => String(r.id) === String(rule.room))?.name || "—"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {addStudentOpen && selected ? (
        <div className="overlay overlay-nested" role="dialog" aria-modal="true" aria-label={t("aGrp.addStudent2")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aGrp.close")}
            onClick={() => {
              setAddStudentOpen(false);
              setFormError("");
              setStudentPickerQuery("");
            }}
          />
          <form className="sheet" onSubmit={addStudentToGroup}>
            <div className="sheet-head">
              <div>
                <div className="topbar-eyebrow">{selected.name}</div>
                <h2>{t("aGrp.addStudent2")}</h2>
                <p className="muted">
                  {t("aGrp.placesLeft", { max: Math.max(0, selected.capacity - selected.student_count) })}
                </p>
              </div>
              <button
                type="button"
                className="sheet-close"
                onClick={() => {
                  setAddStudentOpen(false);
                  setFormError("");
                  setStudentPickerQuery("");
                }}
                aria-label={t("aGrp.close")}
              >
                ×
              </button>
            </div>
            <div className="sheet-body">
              <Banner>{formError}</Banner>
              <div className="grid" style={{ gap: 12 }}>
                <Field label={t("aGrp.findStudent")}>
                  <input
                    value={studentPickerQuery}
                    onChange={(e) => setStudentPickerQuery(e.target.value)}
                    placeholder={t("aGrp.nameOrPhone")}
                    autoFocus
                  />
                </Field>
                <Field label={t("aGrp.student")}>
                  <select
                    value={addStudentForm.student}
                    onChange={(e) =>
                      setAddStudentForm({ ...addStudentForm, student: e.target.value })
                    }
                    required
                  >
                    <option value="">{t("aGrp.chooseAStudent")}</option>
                    {availableStudents.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name}
                        {item.phone ? ` · ${item.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {!availableStudents.length ? (
                  <p className="muted">
                    {studentPickerQuery
                      ? t("aGrp.nobodyFoundChangeThe")
                      : t("aGrp.allActiveStudentsAre")}
                  </p>
                ) : null}
                <Field label={t("aGrp.enrolmentDate")}>
                  <input
                    type="date"
                    value={addStudentForm.joined_at}
                    onChange={(e) =>
                      setAddStudentForm({ ...addStudentForm, joined_at: e.target.value })
                    }
                    required
                  />
                </Field>
              </div>
            </div>
            <div className="sheet-foot">
              <Button
                type="button"
                className="secondary"
                onClick={() => {
                  setAddStudentOpen(false);
                  setFormError("");
                  setStudentPickerQuery("");
                }}
              >
                {t("aGrp.cancel")}
              </Button>
              <Button type="submit" busy={busy} disabled={!availableStudents.length}>
                {t("aGrp.enrolInGroup")}
              </Button>
            </div>
          </form>
      </div>
      ) : null}
    </div>
  );
}
