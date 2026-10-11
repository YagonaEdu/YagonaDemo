import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  MoneyInput,
  PageHeader,
  RowActionsMenu,
  StatCard,
} from "@/components/ui";
import { api } from "@/services/api/client";
import { getList, lessonsWindowPath } from "@/services/api/paginate";
import { currentMembership } from "@/services/auth";
import {
  formatDate,
  formatTime,
  formatWhen,
  money,
  normalizePriceDigits,
  priceToApi,
} from "@/utils/format";
import { t } from "@/i18n";

const emptyForm = { name: "", description: "", price: "", currency: "UZS", is_active: true };

function coursePriceLabel(course) {
  return Number(course?.price) > 0 ? money(course.price, course.currency || "UZS") : "—";
}

/* rule.weekday comes from the API: 0 = Monday … 6 = Sunday (Python date.weekday()),
   the same order as week.days. */
const weekdayShort = (day) => t("week.days").split(",")[Number(day)];

function formatRuleTime(value) {
  if (!value) return "—";
  const parts = String(value).split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return formatTime(value);
}

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

function durationLabel(groups) {
  const starts = groups.map((item) => item.start_date).filter(Boolean).sort();
  const ends = groups.map((item) => item.end_date).filter(Boolean).sort();
  if (!starts.length && !ends.length) return "—";
  const from = starts[0];
  const to = ends[ends.length - 1];
  if (from && to) return `${formatDate(from)} — ${formatDate(to)}`;
  if (from) return t("aCrs.from", { date: formatDate(from) });
  if (to) return t("aCrs.until", { date: formatDate(to) });
  return "—";
}

function enrichCourses({ courses, groups, staff, lessons, rules }) {
  const groupsByCourse = {};
  for (const group of groups) {
    (groupsByCourse[group.course] ||= []).push(group);
  }

  return courses.map((course) => {
    const courseGroups = groupsByCourse[course.id] || [];
    const activeGroups = courseGroups.filter((item) => item.status === "active");
    const teacherIds = [...new Set(courseGroups.map((item) => item.teacher).filter(Boolean))];
    const teachers = teacherIds.map((id) => staffLabel(staff, id)).filter(Boolean);
    const groupIds = new Set(courseGroups.map((item) => String(item.id)));
    const courseLessons = lessons
      .filter((item) => groupIds.has(String(item.group)))
      .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
    const upcomingLessons = courseLessons.filter(
      (item) => item.starts_at && new Date(item.starts_at) >= new Date(),
    );
    const courseRules = rules.filter((item) => groupIds.has(String(item.group)) && item.is_active);

    return {
      ...course,
      groups: courseGroups,
      group_count: courseGroups.length,
      active_group_count: activeGroups.length,
      student_count: courseGroups.reduce((sum, item) => sum + Number(item.active_students || 0), 0),
      teachers,
      teacher_label: teachers.length ? teachers.join(", ") : "—",
      duration_label: durationLabel(courseGroups),
      start_date: courseGroups.map((item) => item.start_date).filter(Boolean).sort()[0] || null,
      lessons: courseLessons,
      upcoming_lessons: upcomingLessons.slice(0, 6),
      schedule_rules: courseRules,
    };
  });
}

export default function CoursesPage() {
  const canWrite = ["owner", "admin"].includes(currentMembership()?.role);
  const [courses, setCourses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [groupsFilter, setGroupsFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const [courseData, groupData, staffData, lessonData, ruleData] = await Promise.all([
        asList("/courses?page_size=100"),
        asList("/groups?page_size=100"),
        optionalList("/staff?page_size=100"),
        optionalList(lessonsWindowPath(30, 90)),
        optionalList("/schedule-rules?page_size=200"),
      ]);
      const teachers = staffData.filter((item) => item.role === "teacher");
      setStaff(teachers);
      setCourses(
        enrichCourses({
          courses: courseData,
          groups: groupData,
          staff: teachers,
          lessons: lessonData,
          rules: ruleData,
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
    return courses.filter((course) => {
      if (statusFilter === "active" && !course.is_active) return false;
      if (statusFilter === "inactive" && course.is_active) return false;
      if (teacherFilter) {
        const hasTeacher = course.groups.some(
          (group) => String(group.teacher) === String(teacherFilter),
        );
        if (!hasTeacher) return false;
      }
      if (groupsFilter === "with" && !course.group_count) return false;
      if (groupsFilter === "without" && course.group_count) return false;
      if (!q) return true;
      return [course.name, course.description, course.teacher_label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [courses, query, statusFilter, teacherFilter, groupsFilter]);

  const selected = useMemo(
    () => courses.find((item) => String(item.id) === String(selectedId)) || null,
    [courses, selectedId],
  );

  const stats = useMemo(() => {
    const priced = courses.filter((item) => Number(item.price) > 0);
    return {
      total: courses.length,
      active: courses.filter((item) => item.is_active).length,
      students: courses.reduce((sum, item) => sum + item.student_count, 0),
      avgPrice: priced.length
        ? Math.round(priced.reduce((sum, item) => sum + Number(item.price || 0), 0) / priced.length)
        : null,
    };
  }, [courses]);

  function openCreate() {
    setError("");
    setInfo("");
    setFormError("");
    setForm(emptyForm);
    setCreateOpen(true);
  }

  function openCourse(course) {
    setError("");
    setInfo("");
    setFormError("");
    setSelectedId(course.id);
    setEditOpen(false);
    setEditForm(null);
  }

  function openEdit(course = selected) {
    if (!course) return;
    setSelectedId(course.id);
    setFormError("");
    setEditForm({
      name: course.name || "",
      description: course.description || "",
      price: normalizePriceDigits(course.price),
      currency: course.currency || "UZS",
      is_active: Boolean(course.is_active),
    });
    setEditOpen(true);
  }

  function closeCourse() {
    setSelectedId("");
    setEditOpen(false);
    setEditForm(null);
    setFormError("");
  }

  async function createCourse(event) {
    event.preventDefault();
    setFormError("");
    setError("");
    setInfo("");
    const name = form.name.trim();
    if (!name) {
      setFormError(t("aCrs.enterACourseName"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/courses", {
        name,
        description: form.description.trim(),
        price: priceToApi(form.price),
        currency: form.currency || "UZS",
        is_active: form.is_active,
      });
      setCreateOpen(false);
      setForm(emptyForm);
      setInfo(t("aCrs.courseAdded", { name }));
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCourse(event) {
    event.preventDefault();
    if (!selected || !editForm) return;
    setFormError("");
    setError("");
    setInfo("");
    const name = editForm.name.trim();
    if (!name) {
      setFormError(t("aCrs.enterACourseName"));
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/courses/${selected.id}`, {
        name,
        description: editForm.description.trim(),
        price: priceToApi(editForm.price),
        currency: editForm.currency || "UZS",
        is_active: editForm.is_active,
      });
      setInfo(t("aCrs.courseSaved"));
      setEditOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(course) {
    if (!canWrite) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await api.patch(`/courses/${course.id}`, { is_active: !course.is_active });
      setInfo(course.is_active ? t("aCrs.courseArchived") : t("aCrs.courseActivated"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function duplicateCourse(course) {
    if (!canWrite) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await api.post("/courses", {
        name: `${course.name} (копия)`,
        description: course.description || "",
        price: course.price || "0",
        currency: course.currency || "UZS",
        is_active: false,
      });
      setInfo(t("aCrs.courseDuplicated", { name: course.name }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourse(course) {
    if (!canWrite || course.group_count > 0) return;
    if (!window.confirm(t("aCrs.deleteCourse", { name: course.name }))) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await api.del(`/courses/${course.id}`);
      if (String(selectedId) === String(course.id)) closeCourse();
      setInfo(t("aCrs.courseDeleted"));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function courseMenuItems(course, { includeView = false } = {}) {
    return [
      { label: t("aCrs.open"), onClick: () => openCourse(course), hidden: !includeView },
      { label: t("aCrs.edit"), onClick: () => openEdit(course), hidden: !canWrite },
      {
        label: course.is_active ? t("aCrs.archive") : t("aCrs.activate"),
        onClick: () => toggleActive(course),
        hidden: !canWrite,
        disabled: busy,
      },
      { label: t("aCrs.duplicate"), onClick: () => duplicateCourse(course), hidden: !canWrite, disabled: busy },
      {
        label: t("aCrs.delete"),
        onClick: () => deleteCourse(course),
        hidden: !canWrite || course.group_count > 0,
        danger: true,
        disabled: busy,
      },
    ];
  }

  const hasFilters = query || statusFilter || teacherFilter || groupsFilter;
  const teacherOptions = staff.filter((item) =>
    courses.some((course) => course.groups.some((group) => String(group.teacher) === String(item.id))),
  );

  return (
    <div className="courses-page">
      <PageHeader
        title={t("aCrs.courses")}
        subtitle={t("aCrs.manageTheCentresCourses")}
        actions={
          canWrite ? (
            <Button type="button" onClick={openCreate}>
              {t("aCrs.addCourse")}
            </Button>
          ) : null
        }
      />
      <Banner>{error}</Banner>
      <Banner tone="ok">{info}</Banner>

      {!loading && courses.length ? (
        <div className="courses-stats grid cols-4">
          <StatCard label={t("aCrs.totalCourses")} value={stats.total} />
          <StatCard label={t("aCrs.activeCourses")} value={stats.active} />
          <StatCard label={t("aCrs.totalStudents")} value={stats.students} hint={t("aCrs.acrossCourseGroups")} />
          {stats.avgPrice != null ? (
            <StatCard label={t("aCrs.averagePrice")} value={money(stats.avgPrice)} hint={t("aCrs.forPricedCourses")} />
          ) : null}
        </div>
      ) : null}

      <div className="crm-toolbar">
        <div className="crm-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("aCrs.searchByCourseName")}
          />
          <button
            type="button"
            className={`crm-filter-btn ${filtersOpen ? "is-active" : ""}`}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            {t("aCrs.filters")}
          </button>
        </div>
        <div className="crm-toolbar-stats">
          <span>
            {t("aCrs.shown")} <strong>{filtered.length}</strong>
          </span>
          <span className="dot" />
          <span>
            {t("aCrs.total")} <strong>{courses.length}</strong>
          </span>
        </div>
      </div>

      {filtersOpen ? (
        <div className="crm-filters">
          <Field label={t("aCrs.status")}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t("aCrs.all")}</option>
              <option value="active">{t("aCrs.active")}</option>
              <option value="inactive">{t("aCrs.inactive")}</option>
            </select>
          </Field>
          <Field label={t("aCrs.teacher")}>
            <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
              <option value="">{t("aCrs.all")}</option>
              {teacherOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {staffLabel(staff, item.id) || item.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("aCrs.groups")}>
            <select value={groupsFilter} onChange={(e) => setGroupsFilter(e.target.value)}>
              <option value="">{t("aCrs.allCourses")}</option>
              <option value="with">{t("aCrs.withGroups")}</option>
              <option value="without">{t("aCrs.withoutGroups")}</option>
            </select>
          </Field>
          <Button type="button" className="secondary compact" busy={loading} onClick={load}>
            {t("aCrs.refresh")}
          </Button>
          {hasFilters ? (
            <Button
              type="button"
              className="secondary compact"
              onClick={() => {
                setQuery("");
                setStatusFilter("");
                setTeacherFilter("");
                setGroupsFilter("");
              }}
            >
              {t("aCrs.reset")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <EmptyState title={t("aCrs.loading")} body={t("aCrs.fetchingTheCourseCatalogue")} />
        </div>
      ) : error && !courses.length ? (
        <div className="card">
          <EmptyState
            title={t("aCrs.couldNotLoadCourses")}
            body={error}
            action={
              <Button type="button" className="secondary" onClick={load}>
                {t("aCrs.retry")}
              </Button>
            }
          />
        </div>
      ) : !courses.length ? (
        <div className="card">
          <EmptyState
            title={t("aCrs.noCoursesYet")}
            body={t("aCrs.createTheFirstCourse")}
            action={
              canWrite ? (
                <Button type="button" onClick={openCreate}>
                  {t("aCrs.addCourse")}
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="card courses-table-card">
          <DataTable
            rows={filtered}
            empty={hasFilters ? t("aCrs.nothingMatchesTheFilters") : t("aCrs.noCoursesYet2")}
            onRowClick={openCourse}
            columns={[
              {
                key: "name",
                title: t("aCrs.course"),
                render: (row) => (
                  <div className="courses-cell-main">
                    <button
                      type="button"
                      className="table-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCourse(row);
                      }}
                    >
                      {row.name}
                    </button>
                    {row.description ? <div className="muted courses-desc">{row.description}</div> : null}
                  </div>
                ),
              },
              {
                key: "teacher",
                title: t("aCrs.teachers"),
                render: (row) => row.teacher_label,
              },
              {
                key: "groups",
                title: t("aCrs.groups"),
                render: (row) => row.group_count || 0,
              },
              {
                key: "students",
                title: t("aCrs.students"),
                render: (row) => row.student_count || 0,
              },
              {
                key: "price",
                title: t("aCrs.price"),
                render: (row) => coursePriceLabel(row),
              },
              {
                key: "duration",
                title: t("aCrs.period"),
                render: (row) => row.duration_label,
              },
              {
                key: "status",
                title: t("aCrs.status"),
                render: (row) => (
                  <Badge
                    value={row.is_active ? "active" : "inactive"}
                    label={row.is_active ? t("aCrs.active2") : t("aCrs.archived")}
                  />
                ),
              },
              {
                key: "actions",
                title: "",
                stopRowClick: true,
                render: (row) => <RowActionsMenu items={courseMenuItems(row, { includeView: true })} />,
              },
            ]}
          />
        </div>
      )}

      {createOpen ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aCrs.newCourse")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aCrs.close")}
            onClick={() => setCreateOpen(false)}
          />
          <form className="sheet" onSubmit={createCourse}>
            <div className="sheet-head">
              <div>
                <div className="topbar-eyebrow">{t("aCrs.courses")}</div>
                <h2>{t("aCrs.addCourse")}</h2>
                <p className="muted">{t("aCrs.enterTheCourseName")}</p>
              </div>
              <button
                type="button"
                className="sheet-close"
                onClick={() => setCreateOpen(false)}
                aria-label={t("aCrs.close")}
              >
                ×
              </button>
            </div>
            <div className="sheet-body">
              <Banner>{formError}</Banner>
              <div className="grid" style={{ gap: 12 }}>
                <Field label={t("aCrs.name")}>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder={t("aCrs.forExampleIelts")}
                    required
                    autoFocus
                  />
                </Field>
                <Field label={t("aCrs.description")}>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={t("aCrs.programmeLevelFormat")}
                  />
                </Field>
                <div className="grid cols-2" style={{ gap: 12 }}>
                  <Field label={t("aCrs.price")}>
                    <MoneyInput
                      value={form.price}
                      onChange={(price) => setForm({ ...form, price })}
                    />
                  </Field>
                  <Field label={t("aCrs.currency")}>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    >
                      <option value="UZS">UZS</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>
                </div>
                <Field label={t("aCrs.status")}>
                  <select
                    value={form.is_active ? "active" : "inactive"}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.value === "active" })
                    }
                  >
                    <option value="active">{t("aCrs.active3")}</option>
                    <option value="inactive">{t("aCrs.archived2")}</option>
                  </select>
                </Field>
              </div>
            </div>
            <div className="sheet-foot">
              <Button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
                {t("aCrs.cancel")}
              </Button>
              <Button type="submit" busy={busy}>
                {t("aCrs.saveCourse")}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {selected ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aCrs.courseCard")}>
          <button
            type="button"
            className="overlay-backdrop"
            aria-label={t("aCrs.close")}
            onClick={closeCourse}
          />
          <aside className="sheet sheet-detail">
            <div className="sheet-head">
              <div>
                <div className="topbar-eyebrow">{t("aCrs.course")}</div>
                <h2>{editOpen ? t("aCrs.editCourse") : selected.name}</h2>
                <p className="muted">
                  {editOpen ? selected.name : selected.description || t("aCrs.noDescription")}
                </p>
              </div>
              <div className="sheet-head-actions">
                {canWrite && !editOpen ? (
                  <RowActionsMenu items={courseMenuItems(selected)} />
                ) : null}
                <button type="button" className="sheet-close" onClick={closeCourse} aria-label={t("aCrs.close")}>
                  ×
                </button>
              </div>
            </div>

            <div className="sheet-body">
              {editOpen && editForm ? (
                <form id="course-edit-form" onSubmit={saveCourse}>
                  <Banner>{formError}</Banner>
                  <div className="grid" style={{ gap: 12 }}>
                    <Field label={t("aCrs.name")}>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        required
                        autoFocus
                      />
                    </Field>
                    <Field label={t("aCrs.description")}>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      />
                    </Field>
                    <div className="grid cols-2" style={{ gap: 12 }}>
                      <Field label={t("aCrs.price")}>
                        <MoneyInput
                          value={editForm.price}
                          onChange={(price) => setEditForm({ ...editForm, price })}
                        />
                      </Field>
                      <Field label={t("aCrs.currency")}>
                        <select
                          value={editForm.currency}
                          onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                        >
                          <option value="UZS">UZS</option>
                          <option value="USD">USD</option>
                        </select>
                      </Field>
                    </div>
                    <Field label={t("aCrs.status")}>
                      <select
                        value={editForm.is_active ? "active" : "inactive"}
                        onChange={(e) =>
                          setEditForm({ ...editForm, is_active: e.target.value === "active" })
                        }
                      >
                        <option value="active">{t("aCrs.active3")}</option>
                        <option value="inactive">{t("aCrs.archived2")}</option>
                      </select>
                    </Field>
                  </div>
                  <div className="sheet-foot sheet-foot-inline">
                    <Button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditOpen(false);
                        setEditForm(null);
                        setFormError("");
                      }}
                    >
                      {t("aCrs.cancel")}
                    </Button>
                    <Button type="submit">{t("aCrs.save")}</Button>
                  </div>
                </form>
              ) : (
                <>
              <div className="detail-badges">
                <Badge
                  value={selected.is_active ? "active" : "inactive"}
                  label={selected.is_active ? t("aCrs.active2") : t("aCrs.archived")}
                />
                <Badge value="scheduled" label={t("plural.groups", { count: selected.group_count })} />
                <Badge value="active" label={t("plural.students", { count: selected.student_count })} />
                {Number(selected.price) > 0 ? (
                  <Badge value="paid" label={coursePriceLabel(selected)} />
                ) : null}
              </div>

              <section className="detail-section">
                <h3>{t("aCrs.aboutTheCourse")}</h3>
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>{t("aCrs.price")}</dt>
                    <dd>{coursePriceLabel(selected)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aCrs.teachers")}</dt>
                    <dd>{selected.teacher_label}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aCrs.groups")}</dt>
                    <dd>{selected.group_count}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aCrs.students")}</dt>
                    <dd>{selected.student_count}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aCrs.period")}</dt>
                    <dd>{selected.duration_label}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aCrs.startDate")}</dt>
                    <dd>{formatDate(selected.start_date)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>{t("aCrs.created")}</dt>
                    <dd>{formatDate(selected.created_at)}</dd>
                  </div>
                </dl>
              </section>

              {selected.groups?.length ? (
                <section className="detail-section">
                  <h3>{t("aCrs.groups")}</h3>
                  <ul className="doc-list">
                    {selected.groups.map((group) => (
                      <li key={group.id}>
                        <div>
                          <strong>{group.name}</strong>
                          <span>
                            {staffLabel(staff, group.teacher) || t("aCrs.noTeacher")}
                            {group.active_students != null ? t("aCrs.stud", { active_students: group.active_students }) : ""}
                          </span>
                        </div>
                        <Badge value={group.status} />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {selected.schedule_rules?.length ? (
                <section className="detail-section">
                  <h3>{t("aCrs.schedule")}</h3>
                  <ul className="doc-list">
                    {selected.schedule_rules.map((rule) => {
                      const group = selected.groups.find(
                        (item) => String(item.id) === String(rule.group),
                      );
                      return (
                        <li key={rule.id}>
                          <div>
                            <strong>{group?.name || t("aCrs.group")}</strong>
                            <span>
                              {weekdayShort(rule.weekday) || rule.weekday} {formatRuleTime(rule.starts_at)}–
                              {formatRuleTime(rule.ends_at)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}

              {selected.upcoming_lessons?.length ? (
                <section className="detail-section">
                  <h3>{t("aCrs.upcomingLessons")}</h3>
                  <ul className="doc-list">
                    {selected.upcoming_lessons.map((lesson) => {
                      const group = selected.groups.find(
                        (item) => String(item.id) === String(lesson.group),
                      );
                      return (
                        <li key={lesson.id}>
                          <div>
                            <strong>{group?.name || t("aCrs.group")}</strong>
                            <span>{formatWhen(lesson.starts_at)}</span>
                          </div>
                          <Badge value={lesson.status} />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ) : null}
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
