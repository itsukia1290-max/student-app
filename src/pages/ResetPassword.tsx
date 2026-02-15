import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  pageStyle,
  cardStyle,
  titleStyle,
  subtitleStyle,
  rowStyle,
  fieldLabelStyle,
  inputStyle,
  applyFocusRing,
  primaryButtonStyle,
  noticeStyle,
} from "../ui/authUi";
import { friendlyUpdatePasswordError } from "../ui/friendlyAuth";
import type { UiNotice } from "../ui/friendlyAuth";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<UiNotice>({ kind: "none" });

  const canSubmit = useMemo(() => {
    return password.length >= 6 && password === password2 && !loading;
  }, [password, password2, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setNotice({ kind: "none" });

    try {
      if (password !== password2) {
        setNotice({
          kind: "warning",
          title: "一致しません",
          message: "確認用パスワードが一致しているか確認してください。",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setNotice(friendlyUpdatePasswordError(error.message));
        return;
      }

      setNotice({
        kind: "success",
        title: "更新しました",
        message: "パスワードを更新しました。ログイン画面からログインしてください。",
      });
    } catch (e: unknown) {
      setNotice({
        kind: "error",
        title: "更新に失敗しました",
        message: e instanceof Error ? e.message : "不明なエラーが発生しました",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pageStyle()}>
      <form onSubmit={onSubmit} style={cardStyle()}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={titleStyle()}>パスワード再設定</h1>
          <p style={subtitleStyle()}>
            新しいパスワードを入力してください。メールのリンクから開いた場合のみ有効です。
          </p>
        </div>

        {notice.kind !== "none" && (
          <div style={noticeStyle(notice.kind)}>
            {notice.title && (
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                {notice.title}
              </div>
            )}
            <div>{notice.message}</div>
          </div>
        )}

        <div style={{ height: 14 }} />

        <div style={rowStyle()}>
          <div>
            <label style={fieldLabelStyle()}>新しいパスワード</label>
            <input
              style={inputStyle()}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              onFocus={(e) => applyFocusRing(e, true)}
              onBlur={(e) => applyFocusRing(e, false)}
              placeholder="6文字以上推奨"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label style={fieldLabelStyle()}>確認用パスワード</label>
            <input
              style={inputStyle({ emphasize: password2.length > 0 && password !== password2 })}
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
              onFocus={(e) => applyFocusRing(e, true)}
              onBlur={(e) => applyFocusRing(e, false)}
              placeholder="もう一度入力"
              autoComplete="new-password"
            />
          </div>

          <button disabled={!canSubmit} style={primaryButtonStyle(!canSubmit)}>
            {loading ? "更新中..." : "更新する"}
          </button>
        </div>
      </form>
    </div>
  );
}
