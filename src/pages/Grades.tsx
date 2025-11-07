import { useState } from "react";

export default function Grades() {
  // まずは空の器（今は未使用の state だけ用意）
  const [stub] = useState(null);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">成績</h2>

      <div className="rounded-xl border bg-white p-4 text-gray-500">
        ここに「科目一覧」「学期フィルタ」「成績入力フォーム」などを配置していきます。（いまは空）
      </div>
    </div>
  );
}
