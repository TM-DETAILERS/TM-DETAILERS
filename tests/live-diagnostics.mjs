// Read-only HTTP checks: never create, modify or delete bookings, accounts or settings.
const sites = [
  "https://tmdetailers.ca",
  "https://tm-detailers.pages.dev",
  "https://repair-restore-complete-site.tm-detailers.pages.dev"
];
const pages = ["/api/health", "/api/site", "/api/calendar", "/api/availability?date=2026-10-21", "/api/session", "/version.txt", "/", "/studio/", "/checkout/", "/business/", "/track/"];
for (const site of sites) {
  console.log("\nSITE", site);
  for (const path of pages) {
    try {
      const response = await fetch(site + path, {
        headers: { "User-Agent": "TM-Detailers-ReadOnly-Diagnostic/1.0", "Accept": "application/json,text/html,text/plain" },
        redirect: "follow",
        signal: AbortSignal.timeout(12000)
      });
      const text = await response.text();
      const out = {
        path, status: response.status, final: new URL(response.url).pathname,
        mime: response.headers.get("content-type")?.split(";")[0] || ""
      };
      if (path.startsWith("/api/")) {
        try {
          const data = JSON.parse(text);
          out.ok = data.ok;
          out.version = data.version;
          out.database = data.database;
          out.security = data.security;
          out.schema = data.schema;
          out.code = data.code;
          out.error = typeof data.error === "string" ? data.error.slice(0,180) : undefined;
          out.timeSlots = Array.isArray(data.site?.booking?.timeSlots) ? data.site.booking.timeSlots.length : undefined;
        } catch {
          out.nonJSON = text.slice(0,120).replace(/\s+/g, " ");
        }
      } else if (path === "/version.txt") {
        out.version = text.trim().slice(0,120);
      } else {
        out.title = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g, "").trim().slice(0,110) || null;
        out.html = /<html[\s>]/i.test(text);
        out.bytes = text.length;
      }
      console.log(JSON.stringify(out));
    } catch (e) {
      console.log(JSON.stringify({path, error: e?.cause?.code || e?.name || "request failed", message: e?.message?.slice(0,120)}));
    }
  }
}
