import { useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import type { ReactElement } from "react";

type View = "home" | "mypage" | "chat" | "dm" | "students" | "schoolCalendar";
type Tab = { key: View; label: string };

const icons: Record<View, ReactElement> = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-10.5z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  chat: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  dm: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h16v16H4z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 4l8 7 8-7" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  mypage: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 21c1.5-4 14.5-4 16 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  students: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 21c1-3 10-3 12 0M13 21c.5-2 6-2 7 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  schoolCalendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
};

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

  const safeTabs = useMemo(() => {
    const seen = new Set<string>();
    return tabs.filter(t => {
      if (seen.has(t.key)) return false;
      seen.add(t.key);
      return true;
    });
  }, [tabs]);

  useEffect(() => {
    if (!navRef.current) return;
    const h = navRef.current.getBoundingClientRect().height;
    document.body.style.paddingBottom = `${h}px`;
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, []);

  return ReactDOM.createPortal(
    <nav
      ref={el => { navRef.current = el; }}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100vw",
        background: "#ffffff",
        boxShadow: "0 -1px 6px rgba(0,0,0,0.06)", // ← 上枠線の代替
        zIndex: 50,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${safeTabs.length}, 1fr)`,
          height: "56px",
        }}
      >
        {safeTabs.map(t => {
          const active = effectiveView === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                color: active ? "#3b82f6" : "#9ca3af",
                fontWeight: active ? 600 : 500,
              }}
            >
              {icons[t.key]}
              <span style={{ fontSize: "11px" }}>{t.label}</span>
              <div
                style={{
                  width: "28px",
                  height: "2px",
                  borderRadius: "9999px",
                  background: active ? "#3b82f6" : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
    </nav>,
    document.body
  );
}
