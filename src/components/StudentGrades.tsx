// src/components/StudentGrades.tsx
type Props = {
  userId: string;
  editable?: boolean; // 教師/管理者なら true を推奨
};

export default function StudentGrades({ userId, editable = false }: Props) {
  // TODO: 将来、grades テーブル接続や科目・点数のCRUDを実装
  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-600">
        成績ページ（生徒ID: <code className="font-mono">{userId}</code>）
      </div>
      <div className="p-4 rounded-lg bg-gray-50 border">
        <p className="text-gray-700">
          ここに「科目／点数／提出物／評価メモ」などの成績管理UIを実装します。
        </p>
        {editable ? (
          <ul className="list-disc pl-5 mt-2 text-sm text-gray-600">
            <li>教師は成績の追加・編集・削除ができます（今後追加）。</li>
            <li>表形式や月次・学期別のタブなど拡張可能です。</li>
          </ul>
        ) : (
          <p className="text-sm text-gray-600 mt-2">閲覧専用</p>
        )}
      </div>
    </div>
  );
}
