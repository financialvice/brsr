import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

function measureContentBox(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const cs = window.getComputedStyle(el);

  const px = (v: string) => {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const pl = px(cs.paddingLeft);
  const pr = px(cs.paddingRight);
  const pt = px(cs.paddingTop);
  const pb = px(cs.paddingBottom);

  const bl = px(cs.borderLeftWidth);
  const br = px(cs.borderRightWidth);
  const bt = px(cs.borderTopWidth);
  const bb = px(cs.borderBottomWidth);

  const x = rect.left + bl + pl;
  const y = rect.top + bt + pt;
  const width = rect.width - (bl + br + pl + pr);
  const height = rect.height - (bt + bb + pt + pb);

  return {
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height)),
  };
}

type WebviewSlotProps = {
  label: string;
  url: string;
  visible?: boolean;
  className?: string;
  "data-testid"?: string;
};

// as of 2025-09-13
// as far as we can tell
// native webviews in the context of Tauri on MacOS have a hardcoded
// minimum height of 485px. we work around this by keeping the webview at 485px
// when the container wants to be smaller
const WEBVIEW_MIN_HEIGHT = 485;

export function WebviewSlot({
  label,
  url,
  visible = true,
  className,
  ...rest
}: WebviewSlotProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const createdRef = useRef(false);
  const lastRectRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const lastVisibleRef = useRef<boolean>(visible);

  useEffect(() => {
    const ensureCreated = async () => {
      if (!ref.current || createdRef.current) {
        return;
      }

      const { x, y, width, height } = measureContentBox(ref.current);
      if (width < 2 || height < 2) {
        return;
      }

      await invoke("create_browser_webview", {
        label,
        url,
        x,
        y,
        width,
        height,
      });
      createdRef.current = true;
      lastRectRef.current = { x, y, width, height };

      if (visible) {
        await invoke("show_webview", { label });
        lastVisibleRef.current = true;
      } else {
        await invoke("hide_webview", { label });
        lastVisibleRef.current = false;
      }
    };

    const raf = () => {
      requestAnimationFrame(() => {
        ensureCreated();
      });
    };

    raf();

    return () => {
      if (createdRef.current) {
        invoke("close_webview", { label }).catch(console.error);
      }
      createdRef.current = false;
      lastRectRef.current = null;
    };
  }, [label, url, visible]);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    let frame = 0;

    const update = async () => {
      if (!(ref.current && createdRef.current)) {
        return;
      }

      const rect = measureContentBox(ref.current);

      // handle the 485px minimum height constraint
      // the webview won't shrink below 485px, but we keep it at that size
      // overflow:hidden DOES NOT clip the webview; this is an important detail we need to consider when designing the UI
      let effectiveHeight = rect.height;

      if (rect.height < WEBVIEW_MIN_HEIGHT) {
        effectiveHeight = WEBVIEW_MIN_HEIGHT;
      }

      const prev = lastRectRef.current;
      const changed =
        !prev ||
        rect.x !== prev.x ||
        rect.y !== prev.y ||
        rect.width !== prev.width ||
        effectiveHeight !== prev.height;

      if (changed) {
        await invoke("update_webview_bounds", {
          label,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: effectiveHeight,
        });
        lastRectRef.current = { ...rect, height: effectiveHeight };
      }
    };

    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        update();
      });
    };

    const ro = new ResizeObserver(() => schedule());
    ro.observe(ref.current);

    const onWindow = () => schedule();
    window.addEventListener("resize", onWindow);

    const mo = new MutationObserver(schedule);
    mo.observe(ref.current, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });

    schedule();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onWindow);
      ro.disconnect();
      mo.disconnect();
    };
  }, [label]);

  useEffect(() => {
    const flip = async () => {
      if (!createdRef.current) {
        return;
      }
      if (visible && !lastVisibleRef.current) {
        await invoke("show_webview", { label });
        lastVisibleRef.current = true;
      } else if (!visible && lastVisibleRef.current) {
        await invoke("hide_webview", { label });
        lastVisibleRef.current = false;
      }
    };
    flip();
  }, [visible, label]);

  return (
    <div
      className={cn(
        "no-drag relative h-full w-full overflow-hidden",
        className
      )}
      ref={ref}
      {...rest}
    />
  );
}
