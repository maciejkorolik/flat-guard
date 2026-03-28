import { useCallback, useLayoutEffect, useRef } from "react";

type Options = {
  maxHeightPx?: number;
  minHeightPx?: number;
};

export function useAutosizeTextarea(value: string, options?: Options) {
  const { maxHeightPx = 200, minHeightPx = 0 } = options ?? {};
  const ref = useRef<HTMLTextAreaElement>(null);

  const adjust = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    const sh = el.scrollHeight;
    const next = Math.max(minHeightPx, Math.min(sh, maxHeightPx));
    el.style.height = `${next}px`;
    el.style.overflowY = sh > maxHeightPx ? "auto" : "hidden";
  }, [maxHeightPx, minHeightPx]);

  useLayoutEffect(() => {
    adjust();
  }, [value, adjust]);

  return ref;
}
