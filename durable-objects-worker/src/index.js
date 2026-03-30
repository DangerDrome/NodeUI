import { DurableObject } from "cloudflare:workers";

export class CollaborationRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Auto ping/pong without waking the object
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      const stored = ws.deserializeAttachment() || {};

      switch (data.type) {
        case "join":
          stored.userId = data.userId;
          stored.joinTime = Date.now();
          ws.serializeAttachment(stored);

          // Send user list
          const users = [];
          for (const socket of this.ctx.getWebSockets()) {
            const info = socket.deserializeAttachment();
            if (info && info.userId) users.push(info.userId);
          }
          ws.send(JSON.stringify({ type: "users-list", users }));

          // Notify others
          this.broadcast({ type: "user-joined", userId: data.userId }, data.userId);
          break;

        case "operation":
        case "request-state":
        case "state-response":
          this.broadcast(data, data.userId);
          break;
      }
    } catch (err) {
      console.error("Message error:", err);
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    const stored = ws.deserializeAttachment();
    if (stored && stored.userId) {
      this.broadcast({ type: "user-left", userId: stored.userId });
    }
    ws.close(code, reason);
  }

  async webSocketError(ws, error) {
    console.error("WebSocket error:", error);
    ws.close(1011, "Server error");
  }

  broadcast(message, excludeUserId = null) {
    const str = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      const stored = ws.deserializeAttachment();
      if (!excludeUserId || !stored || stored.userId !== excludeUserId) {
        try { ws.send(str); } catch (e) { /* ignore */ }
      }
    }
  }
}

export default {
  async fetch(request, env) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("NodeUI Collaboration Server", { status: 200 });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(p => p && p !== "collab");
    const sessionId = pathParts[pathParts.length - 1] || "default";

    const stub = env.COLLABORATION_ROOMS.getByName(sessionId);
    return stub.fetch(request);
  },
};
