"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FixOpsAppLoader } from "@/components/ui/loading";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/overview");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return <FixOpsAppLoader label="INITIALIZING FIXOPS" subtext="Preparing security operations environment…" />;
}
