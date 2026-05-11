"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Drop-in replacement for the old Socket.IO singleton: preserves
// getAtsSocket() / disconnectAtsSocket() so existing call sites keep working,
// but the transport is now Supabase Realtime (postgres_changes on applications).
// RLS scopes the stream to the current org's rows — no manual room-join needed.

const listeners = new Map<string, Set<() => void>>();
let channel: RealtimeChannel | null = null;

function ensureChannel(): void {
  if (channel) return;
  const supabase = createSupabaseBrowserClient();
  channel = supabase
    .channel("ats-applications")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "applications" },
      () => {
        listeners.get("candidate_scored")?.forEach((fn) => fn());
      },
    )
    .subscribe();
}

type FakeSocket = {
  emit: (event: string, payload?: unknown) => void;
  on: (event: string, listener: () => void) => void;
  off: (event: string, listener: () => void) => void;
};

export function getAtsSocket(): FakeSocket {
  ensureChannel();
  return {
    emit(_event, _payload) {
      // No-op — RLS scopes the subscription to the caller's org, so there's
      // no "join_org_room" equivalent needed.
    },
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
  };
}

export function disconnectAtsSocket(): void {
  if (channel) {
    const supabase = createSupabaseBrowserClient();
    void supabase.removeChannel(channel);
    channel = null;
  }
  listeners.clear();
}
