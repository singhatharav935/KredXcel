const http = require("http");
const { URL } = require("url");
const { siteData } = require("./data");

const PORT = process.env.PORT || 5000;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (_err) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const path = parsed.pathname;

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.method === "GET" && path === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      service: "kredxcel-api",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (req.method === "GET" && path === "/api/site") {
    sendJson(res, 200, siteData);
    return;
  }

  if (req.method === "POST" && path === "/api/contact") {
    try {
      const body = await parseBody(req);
      if (!body.name || !body.email || !body.message) {
        sendJson(res, 400, {
          ok: false,
          error: "name, email, and message are required"
        });
        return;
      }

      sendJson(res, 201, {
        ok: true,
        ticketId: `KX-${Date.now()}`,
        note: "Inquiry received. Team KredXcel will respond soon."
      });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Route not found" });
});

server.listen(PORT, () => {
  console.log(`KredXcel backend running on http://localhost:${PORT}`);
});
