import type { NextRequest } from "next/server";
import { apiFailure } from "../../lib/api/response";
import { revalidateAuthenticatedUser } from "../../lib/auth/authentication";
import { authenticateApiRequest, type ProtectedRouteOptions } from "../../lib/auth/guard";
import { SESSION_ABSOLUTE_SECONDS, SESSION_REVALIDATE_SECONDS } from "../../lib/auth/session";
import type { AuthenticatedPrincipal } from "../../lib/auth/types";
import { subscribe } from "../../lib/realtime/bus";
import type { RealtimeEvent } from "../../lib/realtime/events";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

type Dependencies = {
  auth?: ProtectedRouteOptions;
  revalidate?: (userId: string) => Promise<AuthenticatedPrincipal>;
  now?: () => number;
};

/**
 * GET /api/events — Server-Sent Events: one stream per open tab that says when something the page
 * shows has changed. Authenticated like any API, but it does not roll the session cookie: an open
 * tab must not keep an idle session alive. The account is re-checked every few minutes and the
 * stream ends with the session's absolute lifetime or a disabled account.
 */
export const createEventsHandler = (dependencies: Dependencies = {}) =>
  async function eventsHandler(request: NextRequest) {
    let principal: AuthenticatedPrincipal;
    try {
      ({ principal } = await authenticateApiRequest(request, dependencies.auth));
    } catch (error) {
      return apiFailure(error);
    }

    const now = dependencies.now ?? Date.now;
    const revalidate = dependencies.revalidate ?? revalidateAuthenticatedUser;
    const endsAt = now() + SESSION_ABSOLUTE_SECONDS * 1000;
    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const write = (text: string) => {
          if (!closed) controller.enqueue(encoder.encode(text));
        };
        const send = (event: RealtimeEvent) => write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        const close = () => {
          if (closed) return;
          closed = true;
          cleanup();
          try {
            controller.close();
          } catch {
            // Already closed by the client.
          }
        };

        const unsubscribe = subscribe(principal, send);
        let lastCheck = now();
        const heartbeat = setInterval(() => {
          // A comment line keeps proxies from timing the idle connection out.
          write(": ping\n\n");
          if (now() >= endsAt) return close();
          if (now() - lastCheck < SESSION_REVALIDATE_SECONDS * 1000) return;
          lastCheck = now();
          revalidate(principal.userId).then(
            (current) => {
              principal = current;
            },
            () => {
              send({ type: "session.revoked" });
              close();
            },
          );
        }, HEARTBEAT_MS);

        cleanup = () => {
          clearInterval(heartbeat);
          unsubscribe();
        };
        request.signal.addEventListener("abort", close);
        // Browsers wait this long before reconnecting after a drop.
        write("retry: 5000\n\n");
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        Connection: "keep-alive",
        // Tells nginx-style proxies not to buffer the stream.
        "X-Accel-Buffering": "no",
        Vary: "Cookie",
      },
    });
  };

export const GET = createEventsHandler();
