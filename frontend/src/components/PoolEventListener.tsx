"use client";

import { usePoolEvents } from "@/hooks/usePoolEvents";

export function PoolEventListener() {
  usePoolEvents();
  return null;
}
