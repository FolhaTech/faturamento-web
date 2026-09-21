"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function sair() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={sair} disabled={busy} className="text-sm text-neutral-500 hover:text-neutral-800 hover:underline disabled:opacity-50">
      {busy ? "Saindo…" : "Sair"}
    </button>
  );
}
