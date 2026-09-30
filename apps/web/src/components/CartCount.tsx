"use client";

import { useEffect, useState } from "react";

export function CartCount({ initial }: { initial: number }) {
  const [count, setCount] = useState(initial);
  useEffect(() => {
    const refresh = async () => {
      const res = await fetch("/api/cart");
      if (res.ok) setCount(((await res.json()) as { count: number }).count);
    };
    window.addEventListener("cart:changed", refresh);
    return () => window.removeEventListener("cart:changed", refresh);
  }, []);
  return count > 0 ? <span className="ml-1 rounded-full bg-stone-900 px-1.5 text-[11px] text-white">{count}</span> : null;
}
