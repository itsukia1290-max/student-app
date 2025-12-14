/*
 * src/components/ui/Button.tsx
 * Responsibility: 共通ボタンコンポーネント
 * - `variant` によるスタイル切替（'primary' | 'ghost'）を持つ
 */

import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

// Make the default variant `ghost` so most buttons are visually subtle by default
export default function Button({ variant = "ghost", className, children, ...rest }: Props) {
  const base = variant === "ghost" ? "btn-ghost" : "btn";
  return (
    <button {...rest} className={[base, className].filter(Boolean).join(" ")}>
      {children}
    </button>
  );
}
