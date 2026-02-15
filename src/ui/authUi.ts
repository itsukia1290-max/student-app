import React from "react";

export type NoticeKind = "info" | "success" | "warning" | "error";

export const authTheme = {
  color: {
    bg: "#F5F9FF",
    card: "#FFFFFF",
    text: "#0F172A",
    subText: "#475569",
    border: "#D8E7FF",
    primary: "#2563EB",
    primaryHover: "#1D4ED8",
    focus: "rgba(37, 99, 235, 0.25)",
    disabled: "#93C5FD",
  },
  radius: {
    card: 18,
    input: 12,
    button: 12,
  },
  shadow: {
    card: "0 12px 30px rgba(2, 6, 23, 0.08)",
  },
  space: {
    pagePad: 18,
    cardPad: 22,
    gap: 12,
  },
  font: {
    title: 20,
    base: 14,
    small: 12,
  },
};

export function pageStyle(): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: authTheme.space.pagePad,
    background: `radial-gradient(1200px 700px at 30% 10%, #EAF2FF 0%, ${authTheme.color.bg} 45%, #FFFFFF 100%)`,
    color: authTheme.color.text,
  };
}

export function cardStyle(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 380,
    background: authTheme.color.card,
    border: `1px solid ${authTheme.color.border}`,
    borderRadius: authTheme.radius.card,
    boxShadow: authTheme.shadow.card,
    padding: authTheme.space.cardPad,
  };
}

export function titleStyle(): React.CSSProperties {
  return {
    fontSize: authTheme.font.title,
    fontWeight: 800,
    margin: 0,
    letterSpacing: -0.2,
  };
}

export function subtitleStyle(): React.CSSProperties {
  return {
    margin: "8px 0 0",
    fontSize: authTheme.font.base,
    color: authTheme.color.subText,
    lineHeight: 1.5,
  };
}

export function fieldLabelStyle(): React.CSSProperties {
  return {
    display: "block",
    fontSize: authTheme.font.small,
    fontWeight: 700,
    color: authTheme.color.subText,
    marginBottom: 6,
  };
}

export function inputStyle(opts?: { hasError?: boolean; emphasize?: boolean }): React.CSSProperties {
  const hasError = !!opts?.hasError;
  const emphasize = !!opts?.emphasize;

  return {
    width: "100%",
    borderRadius: authTheme.radius.input,
    border: `1px solid ${hasError ? "#FCA5A5" : authTheme.color.border}`,
    padding: "10px 12px",
    fontSize: authTheme.font.base,
    outline: "none",
    background: emphasize ? "#F8FBFF" : "#FFFFFF",
    boxShadow: emphasize
      ? "0 0 0 4px rgba(37, 99, 235, 0.14)"
      : hasError
      ? "0 0 0 3px rgba(248, 113, 113, 0.18)"
      : "none",
    transition: "box-shadow .15s ease, border-color .15s ease, background .15s ease",
  };
}

export function applyFocusRing(e: React.FocusEvent<HTMLInputElement>, on: boolean, hasError?: boolean) {
  const el = e.currentTarget;
  el.style.boxShadow = on
    ? `0 0 0 4px ${hasError ? "rgba(248, 113, 113, 0.20)" : authTheme.color.focus}`
    : hasError
    ? "0 0 0 3px rgba(248, 113, 113, 0.18)"
    : "none";
  el.style.borderColor = on
    ? hasError
      ? "#F87171"
      : authTheme.color.primary
    : hasError
    ? "#FCA5A5"
    : authTheme.color.border;
}

export function primaryButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: authTheme.radius.button,
    border: "1px solid transparent",
    background: disabled ? authTheme.color.disabled : authTheme.color.primary,
    color: "#FFFFFF",
    padding: "11px 12px",
    fontWeight: 800,
    fontSize: authTheme.font.base,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "transform .05s ease, background .15s ease",
  };
}

export function secondaryButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    borderRadius: authTheme.radius.button,
    border: `1px solid ${authTheme.color.border}`,
    background: "#FFFFFF",
    color: authTheme.color.primary,
    padding: "11px 12px",
    fontWeight: 800,
    fontSize: authTheme.font.base,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export function linkButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    border: "none",
    background: "transparent",
    padding: 0,
    color: disabled ? "#94A3B8" : authTheme.color.primary,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };
}

export function dividerStyle(): React.CSSProperties {
  return {
    height: 1,
    background: authTheme.color.border,
    margin: "14px 0",
  };
}

export function noticeStyle(kind: NoticeKind): React.CSSProperties {
  const map = {
    info: { bg: "#EFF6FF", bd: "#BFDBFE", tx: "#1E3A8A" },
    success: { bg: "#ECFDF5", bd: "#A7F3D0", tx: "#065F46" },
    warning: { bg: "#FFFBEB", bd: "#FDE68A", tx: "#92400E" },
    error: { bg: "#FEF2F2", bd: "#FECACA", tx: "#991B1B" },
  }[kind];

  return {
    borderRadius: 12,
    border: `1px solid ${map.bd}`,
    background: map.bg,
    color: map.tx,
    padding: "10px 12px",
    fontSize: authTheme.font.base,
    lineHeight: 1.5,
    marginTop: 12,
  };
}

export function helperTextStyle(): React.CSSProperties {
  return {
    fontSize: authTheme.font.small,
    color: authTheme.color.subText,
    marginTop: 6,
    lineHeight: 1.4,
  };
}

export function rowStyle(): React.CSSProperties {
  return { display: "flex", flexDirection: "column", gap: authTheme.space.gap };
}
