"use client";

import { useEffect, useState } from "react";
import { createClient, RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization of Supabase client
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;

  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabase;
}

export function useNoticers() {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    // Generate a unique user ID for this session
    const visitorId = `visitor_${Math.random().toString(36).substring(2, 15)}`;

    // Create a presence channel
    const presenceChannel = client.channel("jps_noticers", {
      config: {
        presence: {
          key: visitorId,
        },
      },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        const userCount = Object.keys(state).length;
        setCount(Math.max(1, userCount));
      })
      .on("presence", { event: "join" }, () => {
        const state = presenceChannel.presenceState();
        const userCount = Object.keys(state).length;
        setCount(Math.max(1, userCount));
      })
      .on("presence", { event: "leave" }, () => {
        const state = presenceChannel.presenceState();
        const userCount = Object.keys(state).length;
        setCount(Math.max(1, userCount));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
          });
        }
      });

    // Cleanup on unmount
    return () => {
      presenceChannel.unsubscribe();
    };
  }, []);

  return count;
}
