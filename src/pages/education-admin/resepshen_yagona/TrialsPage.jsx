import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Banner, Button, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/i18n";
import { api, ApiError } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { educationSegmentPath } from "@/utils/routes";
import { formatTime, formatUzPhone, toApiPhone, today } from "@/utils/format";
import { t } from "@/i18n";
import {
  buildTrialTopic,
  combineDateTime,
  digits,
  isSameLocalDay,
  isTrialLesson,
  parseTrialTopic,
  staffLabel,
  TRIAL_OUTCOME_HISTORY,
  TRIAL_TOPIC_PREFIX,
} from "./utils";
import TrialDetailPanel from "./TrialDetailPanel";
import { trialState, trialStatePill } from "./trialState";
import TrialLessonSheet from "./TrialLessonSheet";

async function asList(path) {
  try {
    return await getList(path);
  } catch (err) {
    // Access and connection problems are shown to the user; other failures read as an empty list.
    if (err instanceof ApiError && [0, 401, 403].includes(err.status)) {
      throw err;
    }
    return [];
  }
}

function findTrialLead(leads, parsed) {
  if (!parsed?.name && !parsed?.phone) return null;
  return (
    leads.find(
      (l) =>
        (parsed.phone && digits(l.phone) === digits(parsed.phone)) ||
        (parsed.name && l.full_name === parsed.name),
    ) || null
  );
}

function TrialListItem({ lesson, outcome, selected, onSelect, groupMap, staffMap }) {
  const parsed = parseTrialTopic(lesson.topic);
  const teacher = staffMap[String(lesson.teacher)];
  return (
    <li>
      <button
        type="button"
        className={`rx-trial-row${selected ? " is-selected" : ""}${lesson.status === "cancelled" ? " is-cancelled" : ""}`}
        aria-pressed={selected}
        onClick={() => onSelect(lesson)}
      >
        <span className="rx-date-tile" aria-hidden="true">
          <b>{formatDateTime(lesson.starts_at, { day: "numeric" })}</b>
          <small>{formatDateTime(lesson.starts_at, { month: "short" })}</small>
        </span>
        <span className="rx-hit-copy">
          <strong>{parsed.name || t("aTrials.visitor")}</strong>
          <small>
            {formatTime(lesson.starts_at)} · {groupMap[String(lesson.group)]?.name || "—"} ·{" "}
            {teacher ? staffLabel(teacher) : t("aTrials.noTeacher")}
          </small>
          <small>{parsed.phone ? formatUzPhone(parsed.phone) : "—"}</small>
        </span>
        {trialStatePill(lesson, outcome)}
      </button>
    </li>
  );
}

export default function TrialsPage() {
  const { tenantSlug = "" } = useParams();
  const path = (segment = "", query = "") =>
    educationSegmentPath(tenantSlug, segment) + (query ? `?${query}` : "");

  const [lessons, setLessons] = useState([]);
  const [leads, setLeads] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [trialOpen, setTrialOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [statusSaving, setStatusSaving] = useState(false);
  const [trialForm, setTrialForm] = useState({
    course: "",
    group: "",
    date: today(),
    start_time: "16:00",
    end_time: "17:00",
    teacher: "",
    room: "",
    comment: "",
  });
  const [trialPerson, setTrialPerson] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Settings → «Работа ресепшена»: trial length and the call-back delay after a no-show.
  const [centerSettings, setCenterSettings] = useState({});
  const [outcomes, setOutcomes] = useState({});
  const detailRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    api
      .get("/tenant/settings", { cache: true })
      .then((data) => setCenterSettings(data?.center_settings || {}))
      .catch(() => {
        /* defaults apply */
      });
    try {
      // Trial lessons (matched by the topic marker) plus the coming weeks for teacher clashes.
      const from = new Date(Date.now() - 86400000).toISOString();
      const to = new Date(Date.now() + 60 * 86400000).toISOString();
      const [trialData, windowData, leadData, studentData, groupData, courseData, staffData, roomData] =
        await Promise.all([
          asList(`/lessons?search=${encodeURIComponent(TRIAL_TOPIC_PREFIX.replace(":", ""))}&page_size=500&ordering=-starts_at`),
          asList(`/lessons?page_size=500&ordering=starts_at&starts_at_from=${encodeURIComponent(from)}&starts_at_to=${encodeURIComponent(to)}`),
          asList("/leads?page_size=200"),
          asList("/students?page_size=200"),
          asList("/groups?page_size=100"),
          asList("/courses?page_size=100"),
          asList("/staff?page_size=100"),
          asList("/rooms?page_size=100"),
        ]);
      const byId = new Map([...windowData, ...trialData].map((lesson) => [String(lesson.id), lesson]));
      setLessons([...byId.values()]);
      setLeads(leadData);
      setStudents(studentData);
      setGroups(groupData);
      setCourses(courseData);
      setStaff(staffData.filter((s) => s.role === "teacher"));
      setRooms(roomData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [String(g.id), g])),
    [groups],
  );
  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [String(c.id), c])),
    [courses],
  );
  const staffMap = useMemo(
    () => Object.fromEntries(staff.map((s) => [String(s.id), s])),
    [staff],
  );
  const roomMap = useMemo(
    () => Object.fromEntries(rooms.map((r) => [String(r.id), r])),
    [rooms],
  );

  const trials = useMemo(
    () =>
      lessons
        .filter(isTrialLesson)
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at)),
    [lessons],
  );

  const filteredTrials = useMemo(() => {
    const now = Date.now();
    if (filter === "today") return trials.filter((l) => isSameLocalDay(l.starts_at));
    if (filter === "upcoming") {
      return trials
        .filter((l) => l.status !== "cancelled" && new Date(l.starts_at).getTime() >= now - 3600000)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    if (filter === "past") {
      return trials.filter((l) => new Date(l.starts_at).getTime() < now);
    }
    return trials;
  }, [trials, filter]);

  const counts = useMemo(() => {
    const now = Date.now();
    return {
      all: trials.length,
      today: trials.filter((l) => isSameLocalDay(l.starts_at)).length,
      upcoming: trials.filter((l) => l.status !== "cancelled" && new Date(l.starts_at).getTime() >= now - 3600000).length,
      past: trials.filter((l) => new Date(l.starts_at).getTime() < now).length,
      cancelled: trials.filter((l) => l.status === "cancelled").length,
      cameToday: trials.filter((l) => isSameLocalDay(l.starts_at) && trialState(l, outcomes[l.id]) === "came").length,
    };
  }, [trials, outcomes]);

  // Open the nearest trial right away so the card on the right is never blank.
  useEffect(() => {
    if (selectedId || !trials.length) return;
    const now = Date.now();
    const next =
      [...trials]
        .filter((l) => l.status !== "cancelled" && new Date(l.ends_at).getTime() >= now)
        .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[0] || trials[0];
    setSelectedId(next.id);
  }, [trials, selectedId]);

  function pick(lesson) {
    setSelectedId(lesson.id);
    // Phones: the card is below the list — bring it into view.
    if (window.matchMedia("(max-width: 1100px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const selected = useMemo(
    () => trials.find((l) => String(l.id) === String(selectedId)) || null,
    [trials, selectedId],
  );

  useEffect(() => {
    if (selectedId && !selected && trials.length) {
      setSelectedId(null);
    }
  }, [selectedId, selected, trials.length]);

  const selectedParsed = selected ? parseTrialTopic(selected.topic) : null;
  const selectedLead = selectedParsed ? findTrialLead(leads, selectedParsed) : null;
  const selectedGroup = selected ? groupMap[String(selected.group)] : null;
  const selectedCourse = selectedGroup ? courseMap[String(selectedGroup.course)] : null;
  const selectedTeacher = selected ? staffMap[String(selected.teacher)] : null;
  const selectedRoom = selected ? roomMap[String(selected.room)] : null;

  /* Returns { busy, text } so callers never match on the (translated) text. */
  function teacherBusyLabel(teacherId, date, start, end) {
    if (!teacherId || !date || !start || !end) return "";
    const startAt = combineDateTime(date, start).getTime();
    const endAt = combineDateTime(date, end).getTime();
    const conflict = lessons.find((l) => {
      if (String(l.teacher) !== String(teacherId) || l.status === "cancelled") return false;
      const a = new Date(l.starts_at).getTime();
      const b = new Date(l.ends_at).getTime();
      return a < endAt && b > startAt;
    });
    if (conflict) {
      return { busy: true, text: t("aTrials.busy", { time: formatTime(conflict.starts_at), time2: formatTime(conflict.ends_at) }) };
    }
    return { busy: false, text: t("aTrials.free") };
  }

  function teacherBusyForLesson(lesson) {
    if (!lesson?.teacher) return "";
    const startAt = new Date(lesson.starts_at).getTime();
    const endAt = new Date(lesson.ends_at).getTime();
    const conflict = lessons.find((l) => {
      if (String(l.id) === String(lesson.id)) return false;
      if (String(l.teacher) !== String(lesson.teacher) || l.status === "cancelled") return false;
      const a = new Date(l.starts_at).getTime();
      const b = new Date(l.ends_at).getTime();
      return a < endAt && b > startAt;
    });
    if (conflict) {
      return t("aTrials.anotherLesson", { time: formatTime(conflict.starts_at), time2: formatTime(conflict.ends_at) });
    }
    return "";
  }

  async function markTrialStatus(outcome) {
    if (!selected) return;
    const parsed = parseTrialTopic(selected.topic);
    const lead = findTrialLead(leads, parsed);
    setStatusSaving(true);
    setError("");
    try {
      if (lead) {
        await api.post(`/leads/${lead.id}/activities`, {
          kind: "note",
          content: `Пробный урок: ${TRIAL_OUTCOME_HISTORY[outcome]}`,
          occurred_at: new Date().toISOString(),
        });
        if (outcome === "no_show") {
          await api.patch(`/leads/${lead.id}`, {
            next_follow_up_at: new Date(
              Date.now() + (Number(centerSettings.reception?.default_followup_days) || 1) * 86400000,
            ).toISOString(),
          });
        }
      }
      if (outcome === "cancelled" || outcome === "rescheduled") {
        await api.patch(`/lessons/${selected.id}`, { status: "cancelled" });
      }
      if (outcome === "came" || outcome === "no_show") setOutcomes((prev) => ({ ...prev, [selected.id]: outcome }));
      setInfo(`${parsed.name || t("aTrials.visitor")}: ${t(`aRec.outcome_${outcome}`)}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatusSaving(false);
    }
  }

  async function submitTrial(event) {
    event.preventDefault();
    setFormError("");
    if (!trialPerson?.full_name?.trim()) {
      setFormError(t("aTrials.chooseWhoYouAre"));
      return;
    }
    setSaving(true);
    try {
      const busy = teacherBusyLabel(
        trialForm.teacher,
        trialForm.date,
        trialForm.start_time,
        trialForm.end_time,
      );
      if (busy.busy) {
        throw new Error(t("aTrials.theTeacherAlreadyHas", { text: busy.text }));
      }
      const name = trialPerson.full_name;
      const phone = toApiPhone(trialPerson.phone) || "";
      const created = await api.post("/lessons", {
        group: trialForm.group,
        teacher: trialForm.teacher,
        room: trialForm.room,
        starts_at: combineDateTime(trialForm.date, trialForm.start_time).toISOString(),
        ends_at: combineDateTime(trialForm.date, trialForm.end_time).toISOString(),
        topic: buildTrialTopic({ name, phone, comment: trialForm.comment }),
      });
      setTrialOpen(false);
      setInfo(t("aTrials.trialLessonBooked", { name }));
      if (created?.id) setSelectedId(created.id);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const peopleOptions = useMemo(() => {
    const leadOpts = leads
      .filter((l) => !l.converted_student)
      .map((l) => ({
        key: `lead:${l.id}`,
        label: t("aTrials.lead", { full_name: l.full_name, p: l.phone ? ` · ${formatUzPhone(l.phone)}` : "" }),
        person: { ...l, kind: "lead" },
      }));
    const studentOpts = students
      .filter((s) => s.status === "active")
      .map((s) => ({
        key: `student:${s.id}`,
        label: t("aTrials.student", { full_name: s.full_name, p: s.phone ? ` · ${formatUzPhone(s.phone)}` : "" }),
        person: { ...s, kind: "student" },
      }));
    return [...leadOpts, ...studentOpts];
  }, [leads, students]);

  const staffWithAvailability = staff.map((s) => ({
    ...s,
    _label: `${staffLabel(s)} · ${teacherBusyLabel(
      s.id,
      trialForm.date,
      trialForm.start_time,
      trialForm.end_time,
    ).text}`,
  }));


  return (
    <div className="reception-page rx-page">
      <PageHeader
        title={t("aTrials.trialLessons")}
        subtitle={t("aTrials.visitorBookingsAndTrial")}
        actions={
          <>
            <Button
              type="button"
              onClick={() => {
                const minutes = Number(centerSettings.education?.trial_lesson_duration_minutes) || 60;
                const end = new Date(`2000-01-01T${trialForm.start_time}:00`);
                end.setMinutes(end.getMinutes() + minutes);
                setTrialPerson(null);
                setTrialForm((p) => ({
                  ...p,
                  end_time: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
                  teacher: staff[0]?.id || "",
                  room: rooms[0]?.id || "",
                  group: groups[0]?.id || "",
                }));
                setTrialOpen(true);
              }}
            >
              {t("aTrials.bookATrialLesson")}
            </Button>
          </>
        }
      />

      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="ok">{info}</Banner> : null}

      <section className="rx-stats rx-stats-4" aria-label={t("aTrials.list")}>
        <article className="rx-stat">
          <span>{t("rxTrials.statToday")}</span>
          <strong>{loading ? "—" : counts.today}</strong>
          <small>{t("rxDash.trialsCame", { count: counts.cameToday })}</small>
        </article>
        <article className="rx-stat">
          <span>{t("rxTrials.statUpcoming")}</span>
          <strong>{loading ? "—" : counts.upcoming}</strong>
          <small>{t("rxTrials.statUpcomingHint")}</small>
        </article>
        <article className="rx-stat">
          <span>{t("rxTrials.statPast")}</span>
          <strong>{loading ? "—" : counts.past}</strong>
          <small>{t("rxTrials.statPastHint")}</small>
        </article>
        <article className="rx-stat">
          <span>{t("rxTrials.statCancelled")}</span>
          <strong>{loading ? "—" : counts.cancelled}</strong>
          <small>{t("rxTrials.statCancelledHint")}</small>
        </article>
      </section>

      <div className="rx-grid rx-trials-grid">
        <section className="rx-card">
          <div className="rx-card-head">
            <h2>{t("aTrials.list")}</h2>
          </div>
          <div className="rx-seg rx-tabs" role="tablist" aria-label={t("aTrials.trialFilter")}>
            {[
              ["all", t("aTrials.all")],
              ["today", t("aTrials.today")],
              ["upcoming", t("aTrials.upcoming")],
              ["past", t("aTrials.past")],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={filter === value ? "is-active" : ""}
                onClick={() => setFilter(value)}
              >
                {label}
                <span className="rx-count">{counts[value]}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="rx-empty">{t("aTrials.loading")}</p>
          ) : !filteredTrials.length ? (
            <p className="rx-empty">{t("aTrials.noTrialLessons")}</p>
          ) : (
            <ul className="rx-trial-list">
              {filteredTrials.map((lesson) => (
                <TrialListItem
                  key={lesson.id}
                  lesson={lesson}
                  outcome={outcomes[lesson.id]}
                  selected={String(lesson.id) === String(selectedId)}
                  onSelect={pick}
                  groupMap={groupMap}
                  staffMap={staffMap}
                />
              ))}
            </ul>
          )}
        </section>

        <div className="rx-trial-side" ref={detailRef}>
          <TrialDetailPanel
            lesson={selected}
            outcome={selected ? outcomes[selected.id] : undefined}
            group={selectedGroup}
            course={selectedCourse}
            teacher={selectedTeacher}
            room={selectedRoom}
            lead={selectedLead}
            crmPath={path("crm")}
            schedulePath={path("schedule")}
            busy={selected ? teacherBusyForLesson(selected) : ""}
            saving={statusSaving}
            onMarkStatus={markTrialStatus}
            onCancel={() => {
              const name = selectedParsed?.name || t("aTrials.visitor");
              if (window.confirm(t("rxTrials.confirmCancel", { name }))) markTrialStatus("cancelled");
            }}
          />
        </div>
      </div>

      <TrialLessonSheet
        open={trialOpen}
        form={trialForm}
        setForm={setTrialForm}
        person={trialPerson}
        onPersonChange={setTrialPerson}
        peopleOptions={peopleOptions}
        courses={courses}
        groups={groups}
        staff={staffWithAvailability}
        rooms={rooms}
        saving={saving}
        error={formError}
        onClose={() => setTrialOpen(false)}
        onSubmit={submitTrial}
      />
    </div>
  );
}
