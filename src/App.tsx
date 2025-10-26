import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import { supabase } from "./lib/supabase";

function Home() {
  const { user } = useAuth();

  async function loadMyProfile() {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) console.error("❌ profiles 読取エラー:", error.message);
    else console.log("✅ profiles 読取OK:", data);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-100">
      <div className="p-8 rounded-2xl shadow bg-white">
        <h1 className="text-2xl font-bold text-green-600">ログイン済み ✅</h1>
        <p className="mt-2 text-gray-600">{user?.email}</p>
        <button onClick={loadMyProfile} className="mt-4 px-4 py-2 rounded bg-black text-white">
          自分のプロフィールを読み込む
        </button>
      </div>
    </div>
  );
}

function Root() {
  const { session } = useAuth();
  return session ? <Home /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
