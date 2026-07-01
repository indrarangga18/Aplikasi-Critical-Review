"use client";

import { useState } from "react";
import Landing, { type SessionData } from "@/components/Landing";
import Dashboard from "@/components/Dashboard";

export default function Page() {
  const [session, setSession] = useState<SessionData | null>(null);

  return session ? (
    <Dashboard data={session} onReset={() => setSession(null)} />
  ) : (
    <Landing onStart={setSession} />
  );
}
