// Client-side global error logger + visible overlay so dependency/chunk
// load failures (504s on /node_modules/.vite/deps/*, dynamic import
// rejections, etc.) surface a real message instead of a blank screen.

if (import.meta.env.DEV && typeof window !== "undefined" && !(window as any).__lvErrOverlayInstalled) {
  (window as any).__lvErrOverlayInstalled = true;

  const render = (title: string, detail: string, raw?: unknown) => {
    // Always log the raw error first so devtools keep the full stack.
    // eslint-disable-next-line no-console
    console.error(`[bthrifts] ${title}:`, raw ?? detail);

    const id = "__lv_err_overlay";
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      host.style.cssText =
        "position:fixed;inset:auto 12px 12px 12px;z-index:2147483647;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#fff;background:#1a0a0a;border:1px solid #f43f5e;border-radius:10px;padding:14px 16px;max-height:45vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.5);max-width:min(720px,calc(100vw - 24px));margin-left:auto;margin-right:auto;left:0;right:0;";
      document.body.appendChild(host);
    }
    const time = new Date().toLocaleTimeString();
    host.innerHTML =
      `<div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:6px"><strong style="color:#fda4af">⚠ ${escapeHtml(title)}</strong>` +
      `<button id="__lv_err_close" style="background:transparent;border:1px solid #555;color:#fff;border-radius:6px;padding:2px 8px;cursor:pointer">close</button></div>` +
      `<div style="opacity:.75;font-size:11px;margin-bottom:6px">${time} — check the browser console for full stack</div>` +
      `<pre style="white-space:pre-wrap;word-break:break-word;margin:0">${escapeHtml(detail)}</pre>`;
    document.getElementById("__lv_err_close")?.addEventListener("click", () => host?.remove());
  };

  const describe = (err: unknown): { title: string; detail: string } => {
    if (err instanceof Error) {
      const msg = err.message || String(err);
      if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i.test(msg)) {
        return { title: "Module / chunk failed to load", detail: msg + "\n\nThis usually means a Vite dependency 504’d or a missing npm package. Check the dev server output." };
      }
      if (/504|node_modules\/\.vite\/deps/i.test(msg)) {
        return { title: "Vite dependency 504", detail: msg };
      }
      return { title: err.name || "Error", detail: msg + (err.stack ? `\n\n${err.stack}` : "") };
    }
    try { return { title: "Unhandled error", detail: JSON.stringify(err, null, 2) }; }
    catch { return { title: "Unhandled error", detail: String(err) }; }
  };

  window.addEventListener("error", (event) => {
    // Resource load failures (script/link/img) — event.target is the element.
    const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
    if (target && target !== (window as unknown as HTMLElement) && (target.src || target.href)) {
      const url = target.src || target.href || "";
      render(`Failed to load ${target.tagName.toLowerCase()}`, url, event);
      return;
    }
    const { title, detail } = describe(event.error ?? event.message);
    render(title, detail, event.error);
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const { title, detail } = describe(event.reason);
    render(title, detail, event.reason);
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export {};