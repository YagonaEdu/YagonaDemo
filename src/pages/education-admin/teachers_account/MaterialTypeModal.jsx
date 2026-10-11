import { createPortal } from "react-dom";
import { CloseButton } from "@/components/ui";
import { t } from "@/i18n";
import { TYPE_OPTIONS } from "./materialHelpers";
import { MaterialKindIcon, materialTone } from "./materialIcons";

export default function MaterialTypeModal({ open, onClose, onSelect }) {
  if (!open) return null;

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <div className="tm-modal" role="dialog" aria-modal="true" aria-label={t("tDialogs.addMaterial")} onClick={(e) => e.stopPropagation()}>
        <header className="tm-modal-head">
          <div>
            <h2>{t("tDialogs.whatToAdd")}</h2>
            <p className="tg-muted">{t("tDialogs.pickType")}</p>
          </div>
          <CloseButton onClick={onClose} />
        </header>
        <div className="tm-type-grid">
          {TYPE_OPTIONS.map((item) => (
            <button key={item.id} type="button" className="tm-type-tile" onClick={() => onSelect(item.id)}>
              <span className={`tm-type-icon is-${materialTone(item.id)}`} aria-hidden="true">
                <MaterialKindIcon kind={item.id} />
              </span>
              <strong>{item.label}</strong>
              <span className="tg-muted">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
