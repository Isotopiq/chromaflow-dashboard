import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createUserClient, supabaseAdmin } from "./client.server";

/**
 * Require a valid Supabase session. Reads the bearer token from the
 * Authorization header (set by the browser client via fetch interceptor)
 * and validates it. Injects { supabase, userId, claims } into context.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const auth = getRequestHeader("authorization") ?? "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";

    if (!token) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const supabase = createUserClient(token);
    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: data.user,
      },
    });
  },
);
