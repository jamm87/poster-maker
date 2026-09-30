"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Refresca la página (server components) cada `seconds` mientras está montado. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
