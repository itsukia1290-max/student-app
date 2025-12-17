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

  // ✅ ここが最重要：空ラベル・重複・nullっぽいデータを全部除去
  const safeTabs = useMemo(() => {
    const seen = new Set<string>();
    return (tabs ?? [])
      .filter((t) => t && typeof t.key === "string")
      .map((t) => ({ key: t.key, label: String(t.label ?? "").trim() }))
      .filter((t) => t.label.length > 0) // ← 空ラベルを落とす
      .filter((t) => {
        if (seen.has(t.key)) return false; // ← 重複keyを落とす
        seen.add(t.key);
        return true;
      });
  }, [tabs]);

  useEffect(() => {
    function setBottom() {
      if (!navRef.current) return;

      navRef.current.style.bottom = "0px";
      navRef.current.style.visibility = "visible";

      try {
        const navHeight = navRef.current.getBoundingClientRect().height;
        document.body.style.paddingBottom = `${navHeight}px`;
      } catch {
        // ignore
      }
    }

    setBottom();
    window.addEventListener("resize", setBottom);
    window.addEventListener("orientationchange", setBottom);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", setBottom);
      window.visualViewport.addEventListener("scroll", setBottom);
    }

    return () => {
      window.removeEventListener("resize", setBottom);
      window.removeEventListener("orientationchange", setBottom);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", setBottom);
        window.visualViewport.removeEventListener("scroll", setBottom);
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
      className="fixed inset-x-0 bottom-0 z-50 border-t"
      style={{
        visibility: "hidden",
        backgroundColor: "#ffffff",
        opacity: 0.98,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${safeTabs.length}, minmax(0, 1fr))`,
          height: "56px",
          alignItems: "stretch",
        }}
      >
        {safeTabs.map((t) => {
          const active = effectiveView === t.key;

          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className="h-full w-full"
              style={{ background: "transparent", border: "none", padding: 0 }}
            >
              <div
                style={{
                  height: "100%",
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
                    fontWeight: active ? 700 : 600,
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
