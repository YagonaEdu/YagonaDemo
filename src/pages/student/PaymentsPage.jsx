import { useMemo, useState } from "react";
import { useAsync } from "@/hooks/useAsync";
import { listInvoices, listPayments, listPlans, listSubscriptions } from "@/services/student";
import { formatDate, isPositiveAmount, moneyExact, sumDecimal } from "@/utils/format";
import { IconBook, IconWallet } from "./icons";
import {
  INVOICE_LABELS,
  LoadError,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  SUBSCRIPTION_LABELS,
  UNPAID_STATUSES,
  useCabinetHeader,
} from "./parts";
import { Badge, CardSkeleton, FxEmpty } from "./fx";

const MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const INVOICE_TONE = { paid: "teal", issued: "amber", partially_paid: "amber", overdue: "red", draft: "grey", void: "grey" };
const PAYMENT_TONE = { succeeded: "teal", pending: "amber", failed: "red", refunded: "blue", reversed: "grey" };
const SUB_TONE = { active: "teal", expired: "grey", cancelled: "red" };

function splitMoney(text) {
  const match = String(text).match(/^(.*) (\S+)$/);
  return match ? [match[1], match[2]] : [text, ""];
}

function toNumber(value) {
  // Display-only chart heights; exact values are always shown as text.
  return Number(value) || 0;
}

/* Balance card (Figma 37:249). */
function BalanceCard({ invoices }) {
  const unpaid = invoices
    .filter((item) => UNPAID_STATUSES.includes(item.status) && isPositiveAmount(item.balance))
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  const currency = unpaid[0]?.currency || invoices[0]?.currency || "UZS";
  const total = sumDecimal(unpaid.map((item) => item.balance));
  const [amount, unit] = splitMoney(moneyExact(total, currency));
  const overdue = unpaid.some((item) => item.status === "overdue");

  return (
    <section className="fp-balance">
      <div className="fp-balance-top">
        <span>Баланс счёта</span>
        <img src="/student/logo-mark.svg" alt="" width="32" height="32" />
      </div>
      <p className="fp-balance-amount">
        {unpaid.length ? "−" : ""}
        {amount} <small>{unit}</small>
      </p>
      <p className={`fp-balance-note${overdue ? " is-overdue" : ""}`}>
        {unpaid.length
          ? `${overdue ? "Есть просроченный счёт · " : ""}К оплате до ${formatDate(unpaid[0].due_at)}`
          : "Задолженностей нет"}
      </p>
      {unpaid.length ? (
        <ul className="fp-balance-list">
          {unpaid.slice(0, 3).map((item) => (
            <li key={item.id}>
              <span>{item.description || `Счёт № ${item.number}`}</span>
              <b>{moneyExact(item.balance, item.currency)}</b>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="fp-balance-hint">Оплатить можно в кассе центра — платёж появится в истории автоматически.</p>
    </section>
  );
}

function SubscriptionsCard({ subs }) {
  if (subs.loading) return <CardSkeleton lines={4} />;
  if (subs.error) return <LoadError error={subs.error} onRetry={subs.reload} />;
  const [subscriptions, plans] = subs.data;
  const planOf = (id) => plans.find((item) => String(item.id) === String(id));
  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Абонементы</h2>
      </div>
      {subscriptions.length ? (
        <ul className="fp-subs">
          {subscriptions.slice(0, 4).map((sub) => {
            const plan = planOf(sub.plan);
            const byLessons = sub.total_lessons != null;
            const left = sub.remaining_lessons ?? 0;
            return (
              <li key={sub.id} className={`fp-sub${sub.status === "active" ? " is-active" : ""}`}>
                <span className="fp-sub-icon">
                  <IconBook size={18} />
                </span>
                <span className="sx-row-copy">
                  <strong>{plan?.name || "Абонемент"}</strong>
                  <span>
                    {byLessons ? `Осталось ${left} из ${sub.total_lessons} уроков` : "Месячный"} · до {formatDate(sub.ends_on)}
                  </span>
                </span>
                <Badge tone={SUB_TONE[sub.status] || "grey"}>{SUBSCRIPTION_LABELS[sub.status] || sub.status}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <FxEmpty icon={IconBook} title="Абонементов нет" body="Абонемент оформляет администратор центра." />
      )}
    </section>
  );
}

/* Monthly spend bars (Figma 37:396) — single series, exact sums on hover. */
function SpendChart({ payments, currency }) {
  const [hover, setHover] = useState(null);
  const year = new Date().getFullYear();
  const months = useMemo(() => {
    const sums = Array.from({ length: 12 }, () => []);
    for (const payment of payments) {
      if (payment.status !== "succeeded") continue;
      const d = new Date(payment.paid_at);
      if (d.getFullYear() === year) sums[d.getMonth()].push(payment.amount);
    }
    return sums.map((values) => sumDecimal(values));
  }, [payments, year]);
  const max = Math.max(...months.map(toNumber), 1);
  const lastMonth = new Date().getMonth();
  const visible = months.slice(0, lastMonth + 1);

  return (
    <section className="sx-card">
      <div className="sx-card-head">
        <h2>Расходы на обучение</h2>
        <span className="sx-muted">{year}</span>
      </div>
      {visible.some((value) => toNumber(value) > 0) ? (
        <div className="fp-bars" role="list" aria-label={`Оплаты по месяцам ${year}`} onMouseLeave={() => setHover(null)}>
          {visible.map((value, index) => {
            const amount = toNumber(value);
            return (
              <div
                key={index}
                role="listitem"
                className="fp-bar-col"
                tabIndex={0}
                onMouseEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
                aria-label={`${MONTHS[index]}: ${moneyExact(value, currency)}`}
              >
                <div className="fp-bar-track">
                  <span className={`fp-bar${amount ? "" : " is-zero"}`} style={{ height: `${Math.max((amount / max) * 100, amount ? 6 : 2)}%` }} />
                  {hover === index ? <span className="fp-bar-tip">{moneyExact(value, currency)}</span> : null}
                </div>
                <span className="fp-bar-label">{MONTHS[index]}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <FxEmpty icon={IconWallet} title="Оплат в этом году пока нет" />
      )}
    </section>
  );
}

export default function StudentPaymentsPage() {
  const billing = useAsync(() => Promise.all([listInvoices(), listPayments()]));
  const subs = useAsync(() => Promise.all([listSubscriptions(), listPlans()]));
  useCabinetHeader("Оплаты", "Баланс и история платежей");

  if (billing.loading) {
    return (
      <div className="sx-page">
        <div className="fp-top">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
        <CardSkeleton lines={5} />
      </div>
    );
  }
  if (billing.error) return <LoadError error={billing.error} onRetry={billing.reload} />;

  const [invoices, payments] = billing.data;
  const invoiceOf = (id) => invoices.find((item) => String(item.id) === String(id));
  const currency = invoices[0]?.currency || "UZS";
  const history = [...payments].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at));
  const openInvoices = invoices.filter((item) => item.status !== "draft");

  return (
    <div className="sx-page">
      <div className="fp-top">
        <BalanceCard invoices={invoices} />
        <SubscriptionsCard subs={subs} />
        <SpendChart payments={payments} currency={currency} />
      </div>

      <section className="sx-card sx-table-card">
        <div className="sx-card-head">
          <h2>История платежей</h2>
        </div>
        {history.length ? (
          <div className="sx-table-wrap">
            <table className="sx-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Назначение</th>
                  <th>Способ</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {history.map((payment) => {
                  const invoice = invoiceOf(payment.invoice);
                  return (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.paid_at)}</td>
                      <td>
                        <strong>{invoice?.description || (invoice ? `Счёт № ${invoice.number}` : "Оплата обучения")}</strong>
                      </td>
                      <td>{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</td>
                      <td>
                        <strong>{moneyExact(payment.amount, invoice?.currency || currency)}</strong>
                      </td>
                      <td>
                        <Badge tone={PAYMENT_TONE[payment.status] || "grey"}>
                          {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <FxEmpty icon={IconWallet} title="Платежей пока нет" />
        )}
      </section>

      <section className="sx-card sx-table-card">
        <div className="sx-card-head">
          <h2>Счета</h2>
        </div>
        {openInvoices.length ? (
          <div className="sx-table-wrap">
            <table className="sx-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Назначение</th>
                  <th>Срок</th>
                  <th>Сумма</th>
                  <th>Остаток</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {openInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>№ {invoice.number}</td>
                    <td>{invoice.description || "Оплата обучения"}</td>
                    <td>{formatDate(invoice.due_at)}</td>
                    <td>{moneyExact(invoice.amount, invoice.currency)}</td>
                    <td>
                      <strong>{isPositiveAmount(invoice.balance) ? moneyExact(invoice.balance, invoice.currency) : "—"}</strong>
                    </td>
                    <td>
                      <Badge tone={INVOICE_TONE[invoice.status] || "grey"}>{INVOICE_LABELS[invoice.status] || invoice.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <FxEmpty icon={IconWallet} title="Счетов нет" />
        )}
      </section>
    </div>
  );
}
