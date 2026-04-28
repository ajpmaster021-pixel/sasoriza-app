"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } else {
      setError("パスワードが違います");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">パスワード</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="パスワードを入力"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:border-purple-500"
          autoFocus
        />
      </div>
      {error && <p className="text-red-400 text-sm">⚠️ {error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white"
      >
        {loading ? "確認中..." : "ログイン"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-5xl">🔮</span>
          <h1 className="text-xl font-bold text-purple-300 mt-3">ユリアの占い台本生成</h1>
          <p className="text-xs text-gray-500 mt-1">パスワードを入力してください</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
