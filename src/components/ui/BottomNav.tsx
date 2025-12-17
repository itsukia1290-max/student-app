import { useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";

type View = "home" | "mypage" | "chat" | "dm" | "students" | "schoolCalendar";
type Tab = { key: View; label: string };

export default function BottomNav({
  tabs,
  effectiveView,
  setView,
}: {
  tabs: Tab[];
  effectiveView: View;
  setView: (v: View) => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);

  // 空/重複を除外して「表示する分だけ」で割る
  const safeTabs = useMemo(() => {
    const seen = new Set<string>();
    return (tabs ?? [])
      .filter((t) => t && typeof t.key === "string")
      .map((t) => ({ key: t.key, label: String(t.label ?? "").trim() }))
      .filter((t) => t.label.length > 0)
      .filter((t) => {
        if (seen.has(t.key)) return false;
        seen.add(t.key);
        return true;
      });
  }, [tabs]);

  useEffect(() => {
    function applyLayout() {
      if (!navRef.current) return;

      // ✅ 画面下に固定
      navRef.current.style.bottom = "0px";
      navRef.current.style.visibility = "visible";

      // ✅ コンテンツがナビの下に潜らないように body に padding を付与
      try {
        const h = navRef.current.getBoundingClientRect().height;
        document.body.style.paddingBottom = `${h}px`;
      } catch {
        // ignore
      }
    }

    applyLayout();
    window.addEventListener("resize", applyLayout);
    window.addEventListener("orientationchange", applyLayout);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", applyLayout);
      window.visualViewport.addEventListener("scroll", applyLayout);
    }

    return () => {
      window.removeEventListener("resize", applyLayout);
      window.removeEventListener("orientationchange", applyLayout);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", applyLayout);
        window.visualViewport.removeEventListener("scroll", applyLayout);
      }
      document.body.style.paddingBottom = "";
    };
  }, []);

  if (typeof document === "undefined") return null;
  if (safeTabs.length === 0) return null;

  return ReactDOM.createPortal(
    <nav
      ref={(el) => {
        navRef.current = el;
      }}
      className="fixed bottom-0 z-50 border-t shadow-md"
      style={{
        // ✅ ここが重要：body幅ではなく「画面幅」に固定（右の空白問題を潰す）
        left: 0,
        width: "100vw",
        backgroundColor: "#ffffff",
        opacity: 1,
        visibility: "hidden",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        className="w-full"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${safeTabs.length}, minmax(0, 1fr))`,
          height: "56px",
          width: "100%",
          alignItems: "stretch",
        }}
      >
        {safeTabs.map((t) => {
          const active = effectiveView === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "#ffffff", // ✅ ボタン側も白にして「透けて見える」を防ぐ
                border: "none",
                padding: 0,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    color: active ? "#3b82f6" : "#6b7280",
                    fontWeight: active ? 700 : 500,
                    fontSize: "12px",
                    lineHeight: "1",
                    width: "100%",
                    textAlign: "center",
                    paddingLeft: "6px",
                    paddingRight: "6px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {t.label}
                </div>

                <div
                  style={{
                    height: "2px",
                    width: "40px",
                    borderRadius: "9999px",
                    backgroundColor: active ? "#3b82f6" : "transparent",
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </nav>,
    document.body
  );
}
