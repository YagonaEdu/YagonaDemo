import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import BrandSplash from "@/components/BrandSplash";
import { useI18n } from "@/i18n/useI18n";
import "@/styles/login.css";

/* Figma «00 · Вход»: navy brand panel with girih and arches, form on the right. */
const FEATURES = [
  { icon: "/login/ic-layers.svg", title: "login.featureCentersTitle", text: "login.featureCentersText" },
  { icon: "/login/ic-shield.svg", title: "login.featureRolesTitle", text: "login.featureRolesText" },
  { icon: "/login/ic-lock.svg", title: "login.featureSecureTitle", text: "login.featureSecureText" },
];

export default function AuthLayout() {
  const { t } = useI18n();
  const [ready, setReady] = useState(() => {
    try {
      return sessionStorage.getItem("yagona-splash-done") === "1";
    } catch {
      return false;
    }
  });
  /* null = default hero; the centre picker passes its own texts. */
  const [customHero, setHero] = useState(null);
  const hero = customHero || { title: t("login.heroTitle"), lead: t("login.heroLead") };
  const finishSplash = useCallback(() => {
    try {
      sessionStorage.setItem("yagona-splash-done", "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  return (
    <div className={`lg-screen${ready ? " is-ready" : " is-booting"}`}>
      {!ready ? <BrandSplash onDone={finishSplash} /> : null}

      <aside className="lg-brand">
        <img className="lg-pattern" src="/login/girih.svg" alt="" aria-hidden="true" />
        <img className="lg-arch lg-arch-outer" src="/login/arch-outer.svg" width="420" height="560" alt="" aria-hidden="true" />
        <img className="lg-arch lg-arch-inner" src="/login/arch-inner.svg" width="300" height="420" alt="" aria-hidden="true" />

        <div className="lg-brand-inner">
          <div className="lg-logo">
            <img src="/login/logo-mark.svg" width="52" height="52" alt="" />
            <span>
              <strong>Yagona</strong>
              <small>{t("login.tagline")}</small>
            </span>
          </div>

          <div className="lg-hero">
            <h1>{hero.title}</h1>
            <p>{hero.lead}</p>
            <ul className="lg-features">
              {FEATURES.map((item) => (
                <li key={item.icon}>
                  <span className="lg-feature-icon">
                    <img src={item.icon} width="22" height="22" alt="" />
                  </span>
                  <span>
                    <strong>{t(item.title)}</strong>
                    <small>{t(item.text)}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="lg-brand-copy">© {new Date().getFullYear()} Yagona App · yagona.uz</p>
        </div>
      </aside>

      <main className="lg-panel">
        <Outlet context={{ setHero }} />
      </main>
    </div>
  );
}
