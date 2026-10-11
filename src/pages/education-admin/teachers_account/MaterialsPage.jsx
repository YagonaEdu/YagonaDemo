import { useCallback, useEffect, useMemo, useState } from "react";
import { Banner, Button, EmptyState, RowActionsMenu, SearchInput } from "@/components/ui";
import { api, invalidateApiCache } from "@/services/api/client";
import { t } from "@/i18n";
import { asList } from "./utils";
import { IconUsers, SUMMARY_ICON_MAP } from "./tgIcons";
import {
  MATERIAL_TABS,
  mergeLibrary,
  statusLabel,
  statusTone,
  tabMatches,
  materialKindLabel,
  formatCreated,
} from "./materialHelpers";
import MaterialTypeModal from "./MaterialTypeModal";
import MaterialFormSheet from "./MaterialFormSheet";
import VocabularyFormSheet from "./VocabularyFormSheet";
import VocabExamSheet from "./VocabExamSheet";
import { listVocabExams, listVocabLists, saveVocabExam, saveVocabList } from "./vocabApi";
import MaterialDetailDrawer from "./MaterialDetailDrawer";
import { MaterialKindIcon, materialTone } from "./materialIcons";

function ListSkeleton() {
  return (
    <div className="tm-skeleton">
      {[1, 2, 3, 4, 5].map((key) => (
        <div key={key} className="tm-skeleton-row" />
      ))}
    </div>
  );
}

export default function TeacherMaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [exams, setExams] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [formType, setFormType] = useState("");
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [vocabFormOpen, setVocabFormOpen] = useState(false);
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [examPreset, setExamPreset] = useState(null);
  const [editMaterial, setEditMaterial] = useState(null);
  const [editVocabulary, setEditVocabulary] = useState(null);
  const [editExam, setEditExam] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        asList("/materials?page_size=300"),
        listVocabLists(),
        listVocabExams(),
        asList("/groups?page_size=100"),
        asList("/courses?page_size=100"),
      ]);
      const [m, v, q, g, c] = results;
      if (m.status === "fulfilled") setMaterials(m.value);
      if (v.status === "fulfilled") setVocabulary(v.value);
      if (q.status === "fulfilled") setExams(q.value);
      if (g.status === "fulfilled") setGroups(g.value);
      if (c.status === "fulfilled") setCourses(c.value);
      const failed = results.find((row) => row.status === "rejected");
      if (failed?.status === "rejected") {
        setError(failed.reason?.message || t("tMat.partialLoad"));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groupMap = useMemo(() => new Map(groups.map((row) => [String(row.id), row.name])), [groups]);
  const courseMap = useMemo(() => new Map(courses.map((row) => [String(row.id), row.name])), [courses]);

  const library = useMemo(
    () => mergeLibrary(materials, vocabulary, exams),
    [materials, vocabulary, exams],
  );

  const filtered = useMemo(() => {
    return library.filter((item) => {
      if (!tabMatches(tab, item)) return false;
      if (query && !item.title.toLowerCase().includes(query.toLowerCase())) return false;
      if (typeFilter && item.kind !== typeFilter) return false;
      if (groupFilter && String(item.group) !== groupFilter) return false;
      if (courseFilter && String(item.course) !== courseFilter) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      return true;
    });
  }, [library, tab, query, typeFilter, groupFilter, courseFilter, statusFilter]);

  const summary = useMemo(() => {
    const published = library.filter((row) => row.status === "published").length;
    const examCount = library.filter((row) => row.kind === "exam").length;
    const vocabCount = library.filter((row) => row.kind === "vocabulary").length;
    return [
      { key: "students", label: t("tMat.statTotal"), value: library.length },
      { key: "reviews", label: t("tMat.statExams"), value: examCount },
      { key: "groups", label: t("tMat.statLists"), value: vocabCount },
      { key: "week", label: t("tMat.statPublished"), value: published },
    ];
  }, [library]);

  const hasFilters = Boolean(query || typeFilter || groupFilter || courseFilter || statusFilter);

  function resetFilters() {
    setQuery("");
    setTypeFilter("");
    setGroupFilter("");
    setCourseFilter("");
    setStatusFilter("");
  }

  function refresh() {
    invalidateApiCache("/materials");
    invalidateApiCache("/vocab-");
    load();
  }

  function openCreateType(type) {
    setTypeModalOpen(false);
    setEditMaterial(null);
    setEditVocabulary(null);
    setEditExam(null);
    setExamPreset(null);
    if (type === "vocabulary") {
      setVocabFormOpen(true);
      return;
    }
    if (type === "exam") {
      setExamFormOpen(true);
      return;
    }
    setFormType(type);
    setMaterialFormOpen(true);
  }

  async function openItem(item) {
    setSelected(item);
    if (item.kind === "vocabulary") {
      setEditVocabulary(item.raw);
    } else if (item.kind === "exam") {
      setEditExam(item.raw);
    } else {
      try {
        const full = await api.get(`/materials/${item.id}`);
        setEditMaterial(full);
      } catch {
        setEditMaterial(item.raw);
      }
    }
  }

  async function handleEdit(item) {
    await openItem(item);
    if (item.kind === "vocabulary") setVocabFormOpen(true);
    else if (item.kind === "exam") {
      setExamPreset(null);
      setExamFormOpen(true);
    }
    else {
      setFormType(item.kind);
      setMaterialFormOpen(true);
    }
  }

  async function handleDuplicate(item) {
    try {
      await api.post(`/materials/${item.id}/duplicate`);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleArchive(item) {
    try {
      // Vocabulary lists and exams have no archive: the action toggles publication.
      const published = item.status === "published";
      if (item.kind === "exam") await saveVocabExam(item.id, { is_published: !published });
      else if (item.kind === "vocabulary") await saveVocabList(item.id, { is_published: !published });
      else await api.post(`/materials/${item.id}/archive`);
      setSelected(null);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function createExamFromList(item) {
    setSelected(null);
    setEditExam(null);
    setExamPreset(item.raw);
    setExamFormOpen(true);
  }

  return (
    <div className="tm-page">
      <header className="tg-header tm-header">
        <div>
          <h1>{t("tMat.title")}</h1>
          <p className="tg-sub">{t("tMat.sub")}</p>
        </div>
        <Button onClick={() => setTypeModalOpen(true)}>{t("tMat.add")}</Button>
      </header>

      {error ? (
        <Banner>
          {t("tMat.loadError")}{" "}
          <Button variant="ghost" onClick={refresh}>{t("common.retry")}</Button>
        </Banner>
      ) : null}

      <div className="tg-summary tg-summary-4">
        {summary.map((item) => {
          const Icon = SUMMARY_ICON_MAP[item.key] || IconUsers;
          return (
            <div key={item.key} className={`tg-summary-item tg-summary-${item.key}`}>
              <span className="tg-summary-icon"><Icon size={16} /></span>
              <div>
                <strong>{loading ? "…" : item.value}</strong>
                <span className="tg-summary-label">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="tm-main">
        <div className="tm-tabs" role="tablist" aria-label={t("tMat.tabsLabel")}>
          {MATERIAL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : ""}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="tm-toolbar">
          <div className="tm-toolbar-row">
            <SearchInput value={query} onChange={setQuery} placeholder={t("tMat.searchPlaceholder")} />
            <button type="button" className="tm-filters-toggle" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
              {t("common.filters")}
            </button>
          </div>
          <div className={`tm-toolbar-filters${filtersOpen ? " is-open" : ""}`}>
            <label className="tm-filter-field">
              <span className="tm-filter-label">{t("tMat.type")}</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">{t("tMat.allTypes")}</option>
                <option value="file">{t("tch.material.kindFile")}</option>
                <option value="pdf">PDF</option>
                <option value="link">{t("tch.material.kindLink")}</option>
                <option value="video">{t("tch.material.kindVideo")}</option>
                <option value="vocabulary">{t("tch.material.kindVocabulary")}</option>
                <option value="exam">{t("tch.material.typeExam")}</option>
                <option value="text">{t("tch.material.kindText")}</option>
              </select>
            </label>
            <label className="tm-filter-field">
              <span className="tm-filter-label">{t("tMat.group")}</span>
              <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="">{t("common.allGroups")}</option>
                {groups.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="tm-filter-field">
              <span className="tm-filter-label">{t("tMat.course")}</span>
              <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                <option value="">{t("common.allCourses")}</option>
                {courses.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label className="tm-filter-field">
              <span className="tm-filter-label">{t("tMat.status")}</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t("common.all")}</option>
                <option value="draft">{t("tch.status.draft")}</option>
                <option value="published">{t("tch.status.published")}</option>
                <option value="archived">{t("tch.status.archived")}</option>
              </select>
            </label>
            {hasFilters ? (
              <button type="button" className="tm-reset-btn" onClick={resetFilters}>{t("common.reset")}</button>
            ) : null}
          </div>
        </div>

        {loading ? <ListSkeleton /> : null}

        {!loading && !library.length ? (
          <EmptyState
            title={t("tMat.emptyTitle")}
            body={t("tMat.emptyBody")}
            action={<Button onClick={() => setTypeModalOpen(true)}>{t("tMat.add")}</Button>}
          />
        ) : null}

        {!loading && library.length && !filtered.length ? (
          <EmptyState
            title={t("tMat.notFoundTitle")}
            body={t("tMat.notFoundBody")}
            action={
              hasFilters ? (
                <Button variant="ghost" onClick={resetFilters}>
                  {t("common.resetFilters")}
                </Button>
              ) : null
            }
          />
        ) : null}

        <div className="tm-list">
          {filtered.map((item) => (
            <article key={`${item.kind}-${item.id}`} className="tm-row">
              <button type="button" className="tm-row-main" onClick={() => openItem(item)}>
                <span className={`tm-kind-icon is-${materialTone(item.kind)}`} aria-hidden="true">
                  <MaterialKindIcon kind={item.kind} size={20} />
                </span>
                <span className="tm-row-content">
                  <span className="tm-row-title">{item.title}</span>
                  <span className="tm-row-sub">
                    {materialKindLabel(item.kind)} · {groupMap.get(String(item.group)) || t("common.noGroup")} · {formatCreated(item.created_at)}
                  </span>
                  <span className="tg-muted">{item.meta}</span>
                </span>
              </button>
              <div className="tm-row-side">
                <span className={`tg-pill tg-pill-${statusTone(item.status)}`}>{statusLabel(item.status)}</span>
                <div className="tm-row-actions">
                  <Button variant="ghost" onClick={() => openItem(item)}>{t("common.open")}</Button>
                  {item.kind === "exam" ? (
                    <Button variant="ghost" onClick={() => { setSelected(item); }}>{t("tMat.results")}</Button>
                  ) : null}
                  {item.kind === "vocabulary" ? (
                    <Button variant="ghost" onClick={() => createExamFromList(item)}>{t("tMat.createExam")}</Button>
                  ) : null}
                  <RowActionsMenu
                    items={
                      item.kind === "exam" || item.kind === "vocabulary"
                        ? [
                            { label: t("common.edit"), onClick: () => handleEdit(item) },
                            {
                              label: t(item.status === "published" ? "common.unpublish" : "common.publish"),
                              onClick: () => handleArchive(item),
                            },
                          ]
                        : [
                            { label: t("common.edit"), onClick: () => handleEdit(item) },
                            { label: t("common.duplicate"), onClick: () => handleDuplicate(item) },
                            { label: t("common.archive"), onClick: () => handleArchive(item), danger: true },
                          ]
                    }
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <MaterialTypeModal open={typeModalOpen} onClose={() => setTypeModalOpen(false)} onSelect={openCreateType} />
      <MaterialFormSheet
        open={materialFormOpen}
        type={formType}
        material={editMaterial}
        groups={groups}
        courses={courses}
        onClose={() => setMaterialFormOpen(false)}
        onSaved={refresh}
      />
      <VocabularyFormSheet
        open={vocabFormOpen}
        vocabulary={editVocabulary}
        groups={groups}
        courses={courses}
        onClose={() => setVocabFormOpen(false)}
        onSaved={refresh}
      />
      <VocabExamSheet
        open={examFormOpen}
        exam={editExam}
        presetList={examPreset}
        lists={vocabulary}
        groups={groups}
        onClose={() => setExamFormOpen(false)}
        onSaved={refresh}
      />
      <MaterialDetailDrawer
        item={selected}
        groupMap={groupMap}
        courseMap={courseMap}
        onClose={() => setSelected(null)}
        onEdit={handleEdit}
        onResults={(item) => setSelected(item)}
        onDuplicate={handleDuplicate}
        onArchive={handleArchive}
        onCreateExam={createExamFromList}
      />
    </div>
  );
}
