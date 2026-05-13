import { createFileRoute } from "@tanstack/react-router";
import { SUPABASE_PUBLIC_CONFIG } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/config")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          supabaseUrl: SUPABASE_PUBLIC_CONFIG.url,
          supabaseAnonKey: SUPABASE_PUBLIC_CONFIG.anonKey,
        });
      },
    },
  },
});
