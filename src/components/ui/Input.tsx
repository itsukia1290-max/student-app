/*
 * src/components/ui/Input.tsx
 * Responsibility: 共通入力コンポーネント (input / textarea)
 */

import React from "react";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={["form-input", className].filter(Boolean).join(" ")} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={["form-input", className].filter(Boolean).join(" ")} />;
}

export default Input;
