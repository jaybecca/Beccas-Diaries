import { onRequest } from "./functions/api/media.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Send media API requests to the existing server-side API.
    if (url.pathname === "/api/media") {
      return onRequest({
        request,
        env,
        params: {},
        data: {},
        functionPath: url.pathname
      });
    }

    // Do not expose unknown API routes as static files.
    if (url.pathname.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "Not found." }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
          }
        }
      );
    }

    // Serve the existing website.
    return env.ASSETS.fetch(request);
  }
};
