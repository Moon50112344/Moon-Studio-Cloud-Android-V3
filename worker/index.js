
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function cleanHeaders(source) {
  const headers = new Headers(source);

  for (const name of [
    "host",
    "content-length",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade"
  ]) {
    headers.delete(name);
  }

  return headers;
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);

    // Let the frontend assets be served normally.
    if (!incoming.pathname.startsWith("/api/")) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return new Response("Not Found", { status: 404 });
    }

    // The real Express backend must be configured separately.
    if (!env.BACKEND_URL) {
      return json({
        error: "BACKEND_NOT_CONFIGURED",
        message:
          "Configure BACKEND_URL to the public HTTPS origin of the Moon Studio Express backend."
      }, 503);
    }

    let target;

    try {
      target = new URL(env.BACKEND_URL);

      if (target.protocol !== "https:") {
        return json({
          error: "INVALID_BACKEND_URL",
          message: "BACKEND_URL must use HTTPS."
        }, 500);
      }

      target.pathname = incoming.pathname;
      target.search = incoming.search;
      target.hash = "";

      const options = {
        method: request.method,
        headers: cleanHeaders(request.headers),
        redirect: "manual"
      };

      if (
        request.method !== "GET" &&
        request.method !== "HEAD"
      ) {
        options.body = request.body;
      }

      const upstreamRequest = new Request(
        target.toString(),
        options
      );

      // Forward the actual request to Express; do not fabricate VM data.
      return await fetch(upstreamRequest);
    } catch (error) {
      return json({
        error: "BACKEND_CONNECTION_FAILED",
        message: "Could not reach the Express backend."
      }, 502);
    }
  }
};
