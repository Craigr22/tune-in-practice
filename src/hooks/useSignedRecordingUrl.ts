import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";

const cache = new Map<string, { url: string; exp: number }>();

export function useSignedRecordingUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const cached = cache.get(path);
    if (cached && cached.exp > Date.now()) { setUrl(cached.url); return; }
    let cancelled = false;
    supabase.storage.from("recordings").createSignedUrl(path, 3600).then(({ data }) => {
      if (cancelled || !data?.signedUrl) return;
      cache.set(path, { url: data.signedUrl, exp: Date.now() + 3000_000 });
      setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}
