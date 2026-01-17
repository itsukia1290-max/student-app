/*
 * src/components/ui/Input.tsx
 * Responsibility: 共通入力コンポーネント (input / textarea)
 */

import React from "react";

const baseStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
};

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{ ...baseStyle, ...(style ?? {}) }}
      className={["form-input", className].filter(Boolean).join(" ")}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, style, ...rest } = props;
  return (
    <textarea
      {...rest}
      style={{ ...baseStyle, ...(style ?? {}) }}
      className={["form-input", className].filter(Boolean).join(" ")}
    />
  );
}

export default Input;
