"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        window.alert("Não foi possível sair da conta.");
        return;
      }

      router.push("/login");
      router.refresh();
    } catch {
      window.alert("Não foi possível sair da conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg bg-slate-800 px-5 py-3 hover:bg-slate-700 disabled:opacity-50"
    >
      {loading ? "Saindo..." : "Sair da conta"}
    </button>
  );
}