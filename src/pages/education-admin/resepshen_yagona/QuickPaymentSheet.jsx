import { useEffect, useMemo, useRef, useState } from "react";
import { CloseButton, MoneyInput } from "@/components/ui";
import { initialsOf } from "@/components/layout/FigmaChrome";
import { formatUzPhone, money, priceToApi, today } from "@/utils/format";
import { numberLocaleTag, t } from "@/i18n";
import { api } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { invoiceBalance, newIdempotencyKey, PAYMENT_METHODS } from "./utils";
import { IconSearch } from "./rxIcons";

const OPEN = (inv) => !["paid", "void", "canceled", "cancelled"].includes(inv.status);

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* Figma 03 «Принять оплату»: student, amount presets, invoice, method, receipt. */
export default function QuickPaymentSheet({
  open,
  students,
  invoices,
  currency = "UZS",
  preselectStudentId = "",
  allowedMethods,
  defaultMethod,
  onClose,
  onSuccess,
}) {
  const [studentId, setStudentId] = useState(preselectStudentId || "");
  const [picking, setPicking] = useState(!preselectStudentId);
  // Opened for a known student: start from the whole debt, as in the mockup.
  const [amount, setAmount] = useState(() => {
    if (!preselectStudentId) return "";
    const balance = invoices
      .filter((inv) => String(inv.student) === String(preselectStudentId))
      .filter(OPEN)
      .reduce((sum, inv) => sum + Math.max(0, invoiceBalance(inv)), 0);
    return balance > 0 ? String(Math.round(balance)) : "";
  });
  // Settings → «Работа ресепшена»: allowed methods and the default one.
  const methods = Array.isArray(allowedMethods) && allowedMethods.length
    ? PAYMENT_METHODS.filter((m) => allowedMethods.includes(m.value))
    : PAYMENT_METHODS;
  const [method, setMethod] = useState(() =>
    methods.some((m) => m.value === defaultMethod) ? defaultMethod : methods[0]?.value || "cash",
  );
  const [paidAt, setPaidAt] = useState(nowLocal);
  const [note, setNote] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const amountRef = useRef(null);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digitsQ = q.replace(/\D/g, "");
    const list = q
      ? students.filter(
          (s) =>
            String(s.full_name || "").toLowerCase().includes(q) ||
            (digitsQ && String(s.phone || "").replace(/\D/g, "").includes(digitsQ)),
        )
      : students;
    return list.slice(0, 8);
  }, [students, query]);

  // The chosen student's invoices straight from the API, so debt never depends on how many
  // invoices the page happened to load.
  const [ownInvoices, setOwnInvoices] = useState(null);
  useEffect(() => {
    if (!studentId) {
      setOwnInvoices(null);
      return undefined;
    }
    let alive = true;
    getList(`/invoices?student=${encodeURIComponent(studentId)}&page_size=500`)
      .then((list) => alive && setOwnInvoices(list))
      .catch(() => alive && setOwnInvoices(null));
    return () => {
      alive = false;
    };
  }, [studentId]);

  const studentInvoices = useMemo(() => {
    if (!studentId) return [];
    const source = ownInvoices || invoices.filter((inv) => String(inv.student) === String(studentId));
    return source.filter(OPEN).sort((a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0));
  }, [invoices, ownInvoices, studentId]);

  const debt = useMemo(
    () => studentInvoices.reduce((sum, inv) => sum + Math.max(0, invoiceBalance(inv)), 0),
    [studentInvoices],
  );

  // Exact debt arrived from the API: refresh the suggested amount unless the cashier typed one.
  const amountTouched = useRef(false);
  useEffect(() => {
    if (ownInvoices && !amountTouched.current) setAmount(debt > 0 ? String(Math.round(debt)) : "");
  }, [ownInvoices, debt]);

  const selectedStudent = students.find((s) => String(s.id) === String(studentId));
  const payNumber = Number(priceToApi(amount)) || 0;
  const debtAfter = Math.max(0, debt - payNumber);
  const presets = [...new Set(studentInvoices.map((inv) => Math.round(invoiceBalance(inv))).filter((v) => v > 0 && v !== Math.round(debt)))].slice(0, 2);

  if (!open) return null;

  function pickStudent(id) {
    amountTouched.current = false;
    setStudentId(String(id));
    setInvoiceId("");
    setPicking(false);
    setQuery("");
    const balance = invoices
      .filter((inv) => String(inv.student) === String(id))
      .filter(OPEN)
      .reduce((sum, inv) => sum + Math.max(0, invoiceBalance(inv)), 0);
    setAmount(balance > 0 ? String(Math.round(balance)) : "");
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (!studentId) throw new Error(t("aQps.chooseAStudent"));
      let targetInvoice = invoiceId;
      const payAmount = priceToApi(amount);
      if (!payAmount || Number(payAmount) <= 0) throw new Error(t("aQps.enterTheAmount"));

      if (!targetInvoice) {
        if (studentInvoices[0]) {
          targetInvoice = String(studentInvoices[0].id);
        } else {
          const created = await api.post("/invoices", {
            student: studentId,
            amount: payAmount,
            due_at: new Date().toISOString(),
            description: note.trim() || "Оплата на ресепшн",
          });
          targetInvoice = String(created.id);
        }
      }

      await api.post("/payments", {
        invoice: targetInvoice,
        amount: payAmount,
        method,
        paid_at: new Date(paidAt).toISOString(),
        note: note.trim(),
        idempotency_key: newIdempotencyKey(),
      });
      onSuccess?.(t("aQps.paymentReceived", { amount: money(payAmount, currency) }));
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const invoiceNumbers = studentInvoices.map((inv) => `№${inv.number || String(inv.id).slice(0, 6)}`);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("aQps.takePayment")}>
      <button type="button" className="overlay-backdrop" aria-label={t("aQps.close")} onClick={onClose} tabIndex={-1} />
      <div className="sheet">
        <div className="sheet-head">
          <div>
            <h2>{t("aQps.takePayment")}</h2>
            <p className="muted">{t("aQps.quickPaymentAtThe")}</p>
          </div>
          <CloseButton onClick={onClose} className="sheet-close" label={t("aQps.close")} />
        </div>
        <form className="sheet-body" onSubmit={submit}>
          {error ? <p className="field-message error">{error}</p> : null}

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("aQps.student")}</span>
            {selectedStudent && !picking ? (
              <div className="rx-person">
                <span className="rx-av is-soft">{initialsOf(selectedStudent.full_name)}</span>
                <span className="rx-hit-copy">
                  <strong>{selectedStudent.full_name}</strong>
                  <small>{selectedStudent.phone ? formatUzPhone(selectedStudent.phone) : t("aQps.noPhone")}</small>
                </span>
                <button type="button" className="rx-link" onClick={() => setPicking(true)}>
                  {t("rxSheet.change")}
                </button>
              </div>
            ) : (
              <div className="rx-picker">
                <label className="rx-picker-search">
                  <IconSearch size={18} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("aQps.nameOrPhone")}
                    aria-label={t("aQps.findStudent")}
                    autoFocus
                  />
                </label>
                <ul className="rx-picker-list">
                  {filteredStudents.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => pickStudent(s.id)}>
                        <span className="rx-av is-soft">{initialsOf(s.full_name)}</span>
                        <span className="rx-hit-copy">
                          <strong>{s.full_name}</strong>
                          <small>{s.phone ? formatUzPhone(s.phone) : t("aQps.noPhone")}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!filteredStudents.length ? <li className="rx-empty">{t("aDash.nothingFound")}</li> : null}
                </ul>
              </div>
            )}
          </section>

          {selectedStudent ? (
            <section className="rx-sheet-section">
              <div className="rx-tiles">
                <div className={`rx-tile${debt > 0 ? " is-red" : ""}`}>
                  <span>{t("aQps.debt")}</span>
                  <strong>{money(debt, currency)}</strong>
                </div>
                <div className="rx-tile">
                  <span>{t("aQps.openInvoices")}</span>
                  <strong>{studentInvoices.length}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("rxSheet.sum")}</span>
            <div className="rx-sum" ref={amountRef}>
              <MoneyInput
                value={amount}
                onChange={(value) => {
                  amountTouched.current = true;
                  setAmount(value);
                }}
                currency={currency}
                placeholder="300 000"
                required
              />
            </div>
            <div className="rx-chips">
              {debt > 0 ? (
                <button
                  type="button"
                  className={`rx-chip${payNumber === Math.round(debt) ? " is-active" : ""}`}
                  onClick={() => setAmount(String(Math.round(debt)))}
                >
                  {t("rxSheet.wholeDebt")}
                </button>
              ) : null}
              {presets.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`rx-chip${payNumber === value ? " is-active" : ""}`}
                  onClick={() => setAmount(String(value))}
                >
                  {new Intl.NumberFormat(numberLocaleTag()).format(value)}
                </button>
              ))}
              <button
                type="button"
                className="rx-chip"
                onClick={() => {
                  setAmount("");
                  amountRef.current?.querySelector("input")?.focus();
                }}
              >
                {t("rxSheet.otherSum")}
              </button>
            </div>
          </section>

          <section className="rx-sheet-section">
            <label>
              <span className="rx-field-label">{t("aQps.invoice")}</span>
              <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                <option value="">
                  {studentInvoices.length
                    ? t("rxSheet.autoOldest", { list: invoiceNumbers.join(", ") })
                    : t("aQps.autoNew")}
                </option>
                {studentInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {t("aQps.due", {
                      number: inv.number || String(inv.id).slice(0, 6),
                      amount: money(invoiceBalance(inv), inv.currency || currency),
                    })}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="rx-sheet-section">
            <span className="rx-field-label">{t("rxSheet.payMethod")}</span>
            <div className="rx-chips" role="radiogroup" aria-label={t("rxSheet.payMethod")}>
              {methods.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={method === m.value}
                  className={`rx-chip${method === m.value ? " is-active" : ""}`}
                  onClick={() => setMethod(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rx-sheet-section rx-form-row">
            <label>
              <span className="rx-field-label">{t("rxSheet.dateTime")}</span>
              <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
            </label>
            <label>
              <span className="rx-field-label">{t("aQps.comment")}</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("rxSheet.commentExample")} />
            </label>
          </section>

          <div className="sheet-foot">
            {selectedStudent ? (
              <span className="rx-foot-note">
                {t("rxSheet.debtAfter")}
                <strong className={debtAfter > 0 ? "is-red" : ""}>{money(debtAfter, currency)}</strong>
              </span>
            ) : null}
            <button type="button" className="rx-btn is-outline" onClick={onClose}>
              {t("aQps.cancel")}
            </button>
            <button type="submit" className="rx-btn is-primary" disabled={saving || !studentId}>
              {saving
                ? t("aQps.saving")
                : payNumber > 0
                  ? t("rxSheet.acceptAmount", { amount: money(payNumber, currency) })
                  : t("aQps.takePayment")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
