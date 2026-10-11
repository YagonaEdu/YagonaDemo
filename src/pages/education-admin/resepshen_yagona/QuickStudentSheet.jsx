import { useState } from "react";
import { Button, Field, PhoneInput } from "@/components/ui";
import { api } from "@/services/api/client";
import { today, toApiPhone } from "@/utils/format";
import { t } from "@/i18n";
import { digits, staffLabel } from "./utils";

/* i18n keys of the wizard steps. */
const STEPS = ["aQss.stepStudent", "aQss.stepParent", "aQss.stepLearning", "aQss.stepDone"];

export default function QuickStudentSheet({
  open,
  courses,
  groups,
  staff = [],
  students,
  leads,
  onClose,
  onCreated,
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    birth_date: "",
    parent_name: "",
    parent_phone: "",
    course: "",
    group: "",
    start_date: today(),
    force: false,
  });
  const [created, setCreated] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const courseGroups = groups.filter(
    (g) => !form.course || String(g.course) === String(form.course),
  );

  function findDuplicates() {
    const phoneDigits = digits(form.phone);
    const parentDigits = digits(form.parent_phone);
    const hits = [];
    students.forEach((s) => {
      if (phoneDigits && digits(s.phone) === phoneDigits) {
        hits.push({ kind: "student", id: s.id, full_name: s.full_name, phone: s.phone });
      }
    });
    leads.forEach((l) => {
      if (phoneDigits && digits(l.phone) === phoneDigits) {
        hits.push({ kind: "lead", id: l.id, full_name: l.full_name, phone: l.phone });
      }
    });
    if (parentDigits) {
      students.forEach((s) => {
        const gPhone = s.primary_guardian_phone || s.guardian_phone || "";
        if (digits(gPhone) === parentDigits) {
          hits.push({
            kind: "student",
            id: s.id,
            full_name: s.full_name,
            phone: s.phone,
            extra: t("aQss.parentsPhone"),
          });
        }
      });
    }
    return hits;
  }

  async function submitStudent() {
    setError("");
    const dups = findDuplicates();
    if (dups.length && !form.force && step === 0) {
      setError(t("aQss.similarRecordsFoundOpen"));
      return;
    }
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      const student = await api.post("/students", {
        full_name: form.full_name.trim(),
        phone: toApiPhone(form.phone),
        email: form.email.trim(),
        birth_date: form.birth_date || null,
        status: "active",
      });
      if (form.parent_name.trim() && form.parent_phone.trim()) {
        let guardian = null;
        const existing = await api.get(
          `/guardians?search=${encodeURIComponent(toApiPhone(form.parent_phone) || form.parent_phone.trim())}&page_size=20`,
        );
        const list = Array.isArray(existing) ? existing : existing.results || [];
        guardian =
          list.find((g) => digits(g.phone) === digits(form.parent_phone)) ||
          (await api.post("/guardians", {
            full_name: form.parent_name.trim(),
            phone: toApiPhone(form.parent_phone),
          }));
        await api.post("/student-guardians", {
          student: student.id,
          guardian: guardian.id,
          relationship: "parent",
          is_primary: true,
        });
      }
      if (form.group) {
        await api.post("/enrollments", {
          student: student.id,
          group: form.group,
          joined_at: form.start_date || today(),
        });
      }
      setCreated(student);
      setStep(3);
      onCreated?.(student);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const dups = step === 0 ? findDuplicates() : [];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aQss.addStudent")}>
      <button type="button" className="overlay-backdrop" aria-label={t("aQss.close")} onClick={onClose} />
      <div className="sheet reception-sheet">
        <div className="sheet-head">
          <div>
            <h2>{t("aQss.addStudent")}</h2>
            <p className="muted">
              {t("aQss.stepOf", { min: Math.min(step + 1, 4), length: STEPS.length, p: t(STEPS[Math.min(step, 3)]) })}
            </p>
          </div>
          <button type="button" className="sheet-close" onClick={onClose} aria-label={t("aQss.close")}>
            ×
          </button>
        </div>
        <div className="sheet-body">
          {error ? <p className="field-message error">{error}</p> : null}
          {step === 0 ? (
            <div className="form-grid">
              {dups.length ? (
                <div className="reception-dup span-2">
                  <strong>{t("aQss.aSimilarStudentOr")}</strong>
                  <ul>
                    {dups.map((d) => (
                      <li key={`${d.kind}-${d.id}`}>
                        {d.kind === "student" ? t("aQss.stepStudent") : t("aQss.lead")}: {d.full_name} · {d.phone}
                      </li>
                    ))}
                  </ul>
                  <label className="reception-force">
                    <input
                      type="checkbox"
                      checked={form.force}
                      onChange={(e) => setForm((p) => ({ ...p, force: e.target.checked }))}
                    />
                    {t("aQss.continue")}
                  </label>
                </div>
              ) : null}
              <Field label={t("aQss.fullName")} className="span-2">
                <input
                  value={form.full_name}
                  onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                  required
                />
              </Field>
              <Field label={t("aQss.phone")}>
                <PhoneInput
                  value={form.phone}
                  onChange={(phone) => setForm((p) => ({ ...p, phone }))}
                />
              </Field>
              <Field label="Email">
                <input
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                />
              </Field>
              <Field label={t("aQss.dateOfBirth")}>
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm((p) => ({ ...p, birth_date: e.target.value }))}
                />
              </Field>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="form-grid">
              <Field label={t("aQss.parentsName")}>
                <input
                  value={form.parent_name}
                  onChange={(e) => setForm((p) => ({ ...p, parent_name: e.target.value }))}
                />
              </Field>
              <Field label={t("aQss.parentsPhone2")}>
                <PhoneInput
                  value={form.parent_phone}
                  onChange={(phone) => setForm((p) => ({ ...p, parent_phone: phone }))}
                />
              </Field>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="form-grid">
              <Field label={t("aQss.course")}>
                <select
                  value={form.course}
                  onChange={(e) => setForm((p) => ({ ...p, course: e.target.value, group: "" }))}
                >
                  <option value="">—</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("aQss.group")}>
                <select
                  value={form.group}
                  onChange={(e) => setForm((p) => ({ ...p, group: e.target.value }))}
                >
                  <option value="">—</option>
                  {courseGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              {form.group ? (
                <Field label={t("aQss.groupTeacher")}>
                  <input
                    readOnly
                    value={(() => {
                      const g = groups.find((item) => String(item.id) === String(form.group));
                      if (!g?.teacher) return t("aQss.notAssigned");
                      const teacher = staff.find((s) => String(s.id) === String(g.teacher));
                      return teacher ? staffLabel(teacher) : t("aQss.assigned");
                    })()}
                  />
                </Field>
              ) : null}
              <Field label={t("aQss.startDate")}>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                />
              </Field>
            </div>
          ) : null}
          {step === 3 && created ? (
            <div className="reception-success">
              <h3>{t("aQss.studentCreated")}</h3>
              <p>
                {created.full_name}
                {created.temporary_password
                  ? t("aQss.temporaryPassword", { temporary_password: created.temporary_password })
                  : ""}
              </p>
              <div className="reception-next-actions">
                <Button type="button" onClick={() => onCreated?.(created, "open")}>
                  {t("aQss.openStudent")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => onCreated?.(created, "pay")}>
                  {t("aQss.takePayment")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreated(null);
                    setStep(0);
                    setForm({
                      full_name: "",
                      phone: "",
                      email: "",
                      birth_date: "",
                      parent_name: "",
                      parent_phone: "",
                      course: "",
                      group: "",
                      start_date: today(),
                      force: false,
                    });
                  }}
                >
                  {t("aQss.addAnother")}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        {step < 3 ? (
          <div className="sheet-foot">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("aQss.cancel")}
            </Button>
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                {t("aQss.back")}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={saving || !form.full_name.trim()}
              onClick={submitStudent}
            >
              {step < 2 ? t("aQss.next") : saving ? t("aQss.saving") : t("aQss.create")}
            </Button>
          </div>
        ) : (
          <div className="sheet-foot">
            <Button type="button" onClick={onClose}>
              {t("aQss.close")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
