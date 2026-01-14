/*
 * src/pages/SchoolCalendar.tsx
 * Responsibility:
 * - 塾全体の予定（scope = school）をカレンダー表示
 * - teacher / admin は編集可
 * - 生徒は閲覧不可（ルーティング or 権限で制御）
 */

import { useAuth } from "../contexts/AuthContext";
import CalendarBoard from "../components/CalendarBoard";

export default function SchoolCalendar() {
  const { user } = useAuth();

  // 念のため（未ログイン時の白画面防止）
  if (!user) {
    return (
      <div style={{ padding: "16px" }}>
        <p className="text-sm text-gray-500">ログイン情報を取得中です。</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", paddingBottom: "80px" }}>
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 900,
          marginBottom: "12px",
          color: "#0f172a",
        }}
      >
        塾カレンダー
      </h1>

      <CalendarBoard
        ownerUserId={user.id} // school予定では実質参照されない
        permissions={{
          viewPersonal: false, // ❌ 個人予定は表示しない
          editPersonal: false,
          viewSchool: true,    // ✅ 塾予定は表示
          editSchool: true,    // ✅ 塾予定は編集可
        }}
      />
    </div>
  );
}
