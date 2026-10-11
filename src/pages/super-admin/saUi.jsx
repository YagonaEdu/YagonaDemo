/** Presentation helpers shared by Super Admin pages (styles in styles/super-admin.css). */

export function Skeleton() {
  return <span className="sa-skeleton" aria-hidden="true" />;
}

/** Shows a skeleton instead of a value while the first load is in flight. */
export function pending(loading, value) {
  return loading ? <Skeleton /> : value;
}

export function LoadingState({ label = "Загрузка данных…" }) {
  return (
    <div className="empty sa-loading" role="status" aria-live="polite">
      {label}
    </div>
  );
}
