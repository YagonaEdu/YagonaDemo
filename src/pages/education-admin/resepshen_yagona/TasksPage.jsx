import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { Banner, PageHeader } from "@/components/ui";
import { initialsOf } from "@/components/layout/FigmaChrome";
import { api } from "@/services/api/client";
import { getList } from "@/services/api/paginate";
import { educationSegmentPath } from "@/utils/routes";
import { formatUzPhone, formatWhen } from "@/utils/format";
import { t as tr } from "@/i18n";
import { IconPhone } from "./rxIcons";

/* «Задачи»: CRM follow-ups the front desk has to make — one list, three tabs. */
export default function ReceptionTasksPage() {
  const { tenantSlug = "" } = useParams();
  const outlet = useOutletContext();
  const [leads, setLeads] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setError("");
    try {
      const data = await getList("/leads?page_size=500&ordering=next_follow_up_at");
      setLeads(data.filter((l) => !l.converted_student && l.next_follow_up_at));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const out = { overdue: [], today: [], upcoming: [] };
    leads.forEach((lead) => {
      const d = new Date(lead.next_follow_up_at);
      if (d < start) out.overdue.push(lead);
      else if (d <= end) out.today.push(lead);
      else out.upcoming.push(lead);
    });
    out.upcoming = out.upcoming.slice(0, 30);
    return out;
  }, [leads]);

  // Open the most urgent tab first.
  const active = tab || (groups.overdue.length ? "overdue" : groups.today.length ? "today" : "upcoming");
  const items = groups[active];

  async function act(lead, kind) {
    setBusyId(lead.id);
    setError("");
    try {
      if (kind === "done") {
        await api.post(`/leads/${lead.id}/activities`, {
          kind: "call",
          content: "Задача выполнена",
          occurred_at: new Date().toISOString(),
        });
        await api.patch(`/leads/${lead.id}`, { next_follow_up_at: null });
        setInfo(tr("aTasks.done", { full_name: lead.full_name }));
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        await api.patch(`/leads/${lead.id}`, { next_follow_up_at: tomorrow.toISOString() });
        setInfo(tr("rxTasks.moved", { full_name: lead.full_name }));
      }
      await load();
      outlet?.refreshCounts?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const tabs = [
    ["overdue", tr("aTasks.overdue")],
    ["today", tr("aTasks.today")],
    ["upcoming", tr("aTasks.upcoming")],
  ];

  return (
    <div className="reception-page rx-page">
      <PageHeader title={tr("aTasks.tasks")} subtitle={tr("rxTasks.subtitle")} />
      {error ? <Banner>{error}</Banner> : null}
      {info ? <Banner tone="ok">{info}</Banner> : null}

      <section className="rx-card">
        <div className="rx-seg rx-tabs" role="tablist" aria-label={tr("aTasks.tasks")}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              className={active === id ? "is-active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
              <span className={`rx-count${id === "overdue" && groups.overdue.length ? " is-red" : ""}`}>
                {groups[id].length}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <p className="rx-empty">{tr("rxTasks.loading")}</p>
        ) : !items.length ? (
          <p className="rx-empty">{tr(`rxTasks.empty_${active}`)}</p>
        ) : (
          <ul className="rx-contacts rx-task-list">
            {items.map((lead) => (
              <li key={lead.id}>
                <span className="rx-av is-soft">{initialsOf(lead.full_name)}</span>
                <span className="rx-hit-copy">
                  <strong>{lead.full_name}</strong>
                  <small className={active === "overdue" ? "is-red" : ""}>
                    {formatWhen(lead.next_follow_up_at)}
                    {lead.source_details ? ` · ${lead.source_details}` : ""}
                  </small>
                  <small>{lead.phone ? formatUzPhone(lead.phone) : "—"}</small>
                </span>
                <div className="rx-task-actions">
                  {lead.phone ? (
                    <a className="rx-icon-btn is-teal" href={`tel:${lead.phone}`} aria-label={tr("aTasks.call")} title={tr("aTasks.call")}>
                      <IconPhone size={18} />
                    </a>
                  ) : null}
                  <button type="button" className="rx-btn is-outline is-sm" disabled={busyId === lead.id} onClick={() => act(lead, "tomorrow")}>
                    {tr("rxTasks.tomorrow")}
                  </button>
                  <button type="button" className="rx-btn is-teal is-sm" disabled={busyId === lead.id} onClick={() => act(lead, "done")}>
                    {tr("aTasks.done2")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link className="rx-link" to={educationSegmentPath(tenantSlug, "crm")}>
          {tr("rxTasks.openCrm")} →
        </Link>
      </section>
    </div>
  );
}
