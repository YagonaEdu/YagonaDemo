import { CloseButton, PhoneInput } from "@/components/ui";
import { formatUzPhone } from "@/utils/format";
import { t } from "@/i18n";
import { SOURCE_OPTIONS, VISIT_TIMES } from "./utils";

function Chips({ items, value, onChange, label }) {
  return (
    <div className="rx-chips" role="radiogroup" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="radio"
          aria-checked={value === item.value}
          className={`rx-chip${value === item.value ? " is-active" : ""}`}
          onClick={() => onChange(value === item.value ? "" : item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* Figma 04 «Новый посетитель»: a CRM lead in 30–60 seconds, phone first so duplicates show early. */
export default function NewVisitorSheet({
  open,
  form,
  setForm,
  courses,
  duplicates,
  saving,
  error,
  onClose,
  onSubmit,
  onOpenExisting,
}) {
  if (!open) return null;
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const blocked = duplicates.length > 0 && !form.force;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aNvs.newVisitor")}>
      <button type="button" className="overlay-backdrop" aria-label={t("aNvs.close")} onClick={onClose} tabIndex={-1} />
      <div className="sheet">
        <div className="sheet-head">
          <div>
            <h2>{t("aNvs.newVisitor")}</h2>
            <p className="muted">{t("aNvs.quickCrmSignUp")}</p>
          </div>
          <CloseButton onClick={onClose} className="sheet-close" label={t("aNvs.close")} />
        </div>
        <form className="sheet-body" onSubmit={onSubmit}>
          {error ? <p className="field-message error">{error}</p> : null}

          <section className="rx-sheet-section">
            <label>
              <span className="rx-field-label">{t("aNvs.phone")}</span>
              <PhoneInput value={form.phone} onChange={(phone) => set({ phone })} required autoFocus />
            </label>
            {duplicates.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="rx-warn" role="status">
                <span className="rx-hit-copy">
                  <strong>{t("rxSheet.similarExists")}</strong>
                  <small>
                    {item.kind === "student" ? t("aNvs.student") : t("aNvs.lead")}: {item.full_name}
                    {item.phone ? ` · ${formatUzPhone(item.phone)}` : ""}
                    {item.extra ? ` · ${item.extra}` : ""}
                  </small>
                </span>
                <button type="button" className="rx-btn is-outline is-sm" onClick={() => onOpenExisting(item)}>
                  {t("aNvs.open")}
                </button>
              </div>
            ))}
            {duplicates.length ? (
              <label className="rx-check">
                <input type="checkbox" checked={Boolean(form.force)} onChange={(e) => set({ force: e.target.checked })} />
                {t("aNvs.continueDespiteTheMatch")}
              </label>
            ) : null}
          </section>

          <section className="rx-sheet-section rx-form-row">
            <label>
              <span className="rx-field-label">{t("rxSheet.firstName")}</span>
              <input value={form.first_name} onChange={(e) => set({ first_name: e.target.value })} required />
            </label>
            <label>
              <span className="rx-field-label">{t("rxSheet.lastName")}</span>
              <input value={form.last_name} onChange={(e) => set({ last_name: e.target.value })} />
            </label>
          </section>

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("rxSheet.interestedIn")}</span>
            <Chips
              label={t("rxSheet.interestedIn")}
              value={form.course}
              onChange={(course) => set({ course })}
              items={courses.filter((c) => c.is_active !== false).map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </section>

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("rxSheet.forWhom")}</span>
            <Chips
              label={t("rxSheet.forWhom")}
              value={form.for_whom}
              onChange={(for_whom) => set({ for_whom: for_whom || "self" })}
              items={[
                { value: "self", label: t("rxSheet.forSelf") },
                { value: "child", label: t("rxSheet.forChild") },
              ]}
            />
            {form.for_whom === "child" ? (
              <div className="rx-form-row">
                <label>
                  <span className="rx-field-label">{t("aNvs.parentGuardianName")}</span>
                  <input value={form.parent_name} onChange={(e) => set({ parent_name: e.target.value })} />
                </label>
                <label>
                  <span className="rx-field-label">{t("aNvs.parentsPhone")}</span>
                  <PhoneInput value={form.parent_phone} onChange={(parent_phone) => set({ parent_phone })} />
                </label>
              </div>
            ) : null}
          </section>

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("rxSheet.howFound")}</span>
            <Chips
              label={t("rxSheet.howFound")}
              value={form.source}
              onChange={(source) => set({ source: source || "manual" })}
              items={SOURCE_OPTIONS.map((s) => ({ value: s.value, label: s.value === "manual" ? t("rxSheet.walkIn") : s.label }))}
            />
          </section>

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("rxSheet.convenientTime")}</span>
            <Chips
              label={t("rxSheet.convenientTime")}
              value={form.time}
              onChange={(time) => set({ time })}
              items={VISIT_TIMES.map((value) => ({ value, label: t(`rxSheet.time_${value}`) }))}
            />
          </section>

          <section className="rx-sheet-section">
            <label>
              <span className="rx-field-label">{t("aNvs.comment")}</span>
              <textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder={t("aNvs.inShortWhatThey")} />
            </label>
          </section>

          <div className="sheet-foot">
            <button type="submit" value="save" className="rx-btn is-outline" disabled={saving || blocked}>
              {saving ? t("aNvs.saving") : t("rxSheet.saveLead")}
            </button>
            <button type="submit" value="trial" className="rx-btn is-primary" disabled={saving || blocked}>
              {t("rxSheet.saveAndBook")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
