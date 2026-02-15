export type UiNotice =
  | { kind: "none" }
  | {
      kind: "info" | "success" | "warning" | "error";
      title?: string;
      message: string;
      showPasswordRecheck?: boolean;
      showSignupCta?: boolean;
      showResetCta?: boolean;
      showResubmitCta?: boolean;
    };

export function friendlyLoginError(message: string): UiNotice {
  const m = (message || "").toLowerCase();

  if (m.includes("invalid login credentials") || m.includes("invalid")) {
    return {
      kind: "warning",
      title: "ログインできませんでした",
      message:
        "メールアドレスまたはパスワードが違う可能性があります。まだアカウントを作っていない場合は新規登録へ進んでください。",
      showPasswordRecheck: true,
      showSignupCta: true,
      showResetCta: true,
    };
  }

  if (m.includes("email not confirmed")) {
    return {
      kind: "info",
      title: "メール確認が必要です",
      message:
        "登録したメールアドレスに届いた確認メールを開いてから、もう一度ログインしてください。",
      showResetCta: false,
      showSignupCta: false,
      showPasswordRecheck: false,
    };
  }

  if (m.includes("network") || m.includes("fetch") || m.includes("timeout")) {
    return {
      kind: "error",
      title: "通信エラー",
      message: "接続状況を確認して、もう一度お試しください。",
    };
  }

  return {
    kind: "error",
    title: "ログインに失敗しました",
    message: "時間をおいて再度お試しください。",
  };
}

export function friendlyResetError(message: string): UiNotice {
  const m = (message || "").toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) {
    return {
      kind: "warning",
      title: "送信回数が多すぎます",
      message: "少し時間をおいてから、もう一度お試しください。",
    };
  }
  if (m.includes("invalid") || m.includes("email")) {
    return {
      kind: "warning",
      title: "送信できませんでした",
      message: "メールアドレスを確認してください。",
    };
  }
  return {
    kind: "error",
    title: "送信に失敗しました",
    message: "時間をおいて再度お試しください。",
  };
}

export function friendlyUpdatePasswordError(message: string): UiNotice {
  const m = (message || "").toLowerCase();
  if (m.includes("weak") || m.includes("password")) {
    return {
      kind: "warning",
      title: "パスワードが弱い可能性があります",
      message: "もう少し長くして、数字や英字を混ぜてみてください。",
    };
  }
  if (m.includes("expired") || m.includes("invalid")) {
    return {
      kind: "error",
      title: "リンクが無効か期限切れです",
      message: "もう一度「パスワードを忘れた」から再送してください。",
    };
  }
  return {
    kind: "error",
    title: "更新に失敗しました",
    message: "時間をおいて再度お試しください。",
  };
}
