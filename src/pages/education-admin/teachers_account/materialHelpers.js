import { t, translated } from "@/i18n";
import { formatDate } from "@/utils/format";

export const MATERIAL_TABS = [
  { id: "all", label: "t:tch.material.tabAll" },
  { id: "files", label: "t:tch.material.tabFiles" },
  { id: "vocabulary", label: "t:tch.material.tabVocabulary" },
  { id: "exam", label: "t:tch.material.tabExams" },
  { id: "links", label: "t:tch.material.tabLinks" },
  { id: "drafts", label: "t:tch.material.tabDrafts" },
].map(translated);

export const TYPE_OPTIONS = [
  { id: "file", label: "t:tch.material.typeFile", hint: "t:tch.material.typeFileHint" },
  { id: "pdf", label: "t:tch.material.typePdf", hint: "t:tch.material.typePdfHint" },
  { id: "link", label: "t:tch.material.typeLink", hint: "t:tch.material.typeLinkHint" },
  { id: "video", label: "t:tch.material.typeVideo", hint: "t:tch.material.typeVideoHint" },
  { id: "vocabulary", label: "t:tch.material.typeVocabulary", hint: "t:tch.material.typeVocabularyHint" },
  { id: "exam", label: "t:tch.material.typeExam", hint: "t:tch.material.typeExamHint" },
  { id: "text", label: "t:tch.material.typeText", hint: "t:tch.material.typeTextHint" },
].map(translated);

export function formatBytes(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function materialKindLabel(kind) {
  const keys = {
    file: "kindFile",
    pdf: "kindPdf",
    link: "kindLink",
    video: "kindVideo",
    text: "kindText",
    vocabulary: "kindVocabulary",
    exam: "kindExam",
  };
  return keys[kind] ? t(`tch.material.${keys[kind]}`) : kind;
}

export function statusLabel(status) {
  if (status === "published") return t("tch.status.published");
  if (status === "archived") return t("tch.status.archived");
  return t("tch.status.draft");
}

export function statusTone(status) {
  if (status === "published") return "green";
  if (status === "archived") return "gray";
  return "amber";
}

export function normalizeLibraryItem(row) {
  if (row.contentKind === "vocabulary") {
    return {
      id: row.id,
      kind: "vocabulary",
      title: row.title,
      description: row.description,
      group: row.group,
      course: row.course,
      status: row.is_published ? "published" : "draft",
      meta: `${t("plural.words", { count: row.word_count || 0 })}${row.level ? ` · ${row.level}` : ""}`,
      created_at: row.created_at,
      raw: row,
    };
  }
  if (row.contentKind === "exam") {
    return {
      id: row.id,
      kind: "exam",
      title: row.title,
      description: row.list_title,
      group: row.group,
      course: null,
      status: row.is_published ? "published" : "draft",
      meta: t("tch.material.examMeta", {
        questions: t("plural.questions", { count: row.questions_count || 0 }),
        minutes: Math.round(row.time_limit_sec / 60),
        list: row.list_title,
      }),
      created_at: row.created_at,
      raw: row,
    };
  }
  const type = row.material_type || "file";
  let meta = materialKindLabel(type);
  if (row.file_size) meta += ` · ${formatBytes(row.file_size)}`;
  if (type === "link" || type === "video") meta = materialKindLabel(type);
  return {
    id: row.id,
    kind: type,
    title: row.title,
    description: row.description,
    group: row.group,
    course: row.course,
    status: row.status || (row.is_published ? "published" : "draft"),
    meta,
    link: row.link,
    file: row.file,
    created_at: row.created_at,
    raw: row,
  };
}

export function mergeLibrary(materials = [], vocabulary = [], exams = []) {
  const rows = [
    ...materials.map((row) => normalizeLibraryItem(row)),
    ...vocabulary.map((row) => normalizeLibraryItem({ ...row, contentKind: "vocabulary" })),
    ...exams.map((row) => normalizeLibraryItem({ ...row, contentKind: "exam" })),
  ];
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function tabMatches(tab, item) {
  if (tab === "all") return item.status !== "archived";
  if (tab === "drafts") return item.status === "draft";
  if (tab === "files") return ["file", "pdf", "text"].includes(item.kind);
  if (tab === "vocabulary") return item.kind === "vocabulary";
  if (tab === "exam") return item.kind === "exam";
  if (tab === "links") return ["link", "video"].includes(item.kind);
  return true;
}

export function formatCreated(iso) {
  if (!iso) return "—";
  return formatDate(iso);
}
