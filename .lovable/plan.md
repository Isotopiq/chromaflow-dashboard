# Fix Easypanel Docker Compose deployment for good

## Actual problem

The build is now successful and it does create:

```text
dist/server/server.js
```

The remaining crash happens after the container starts:

```text
Error: Could not resolve entry for router entry: router in /app/src
```

This is because the runtime command is still:

```text
vite preview --host 0.0.0.0 --port 5273
```

TanStack Start's Vite preview server re-loads `vite.config.ts` at container startup. During that config load it checks for the router source entry at `src/router.tsx`. The current runtime Docker image only copies `dist`, `package.json`, `vite.config.ts`, and `tsconfig.json`, so `/app/src/router.tsx` is missing even though the built server exists.

## Changes to make

### 1. Dockerfile: restore the required source directory in the runtime image

Add this back to the runtime stage:

```dockerfile
COPY --from=builder /app/src ./src
```

Keep the existing `dist/server/server.js` fix in `vite.config.ts`. The final runtime image should contain both:

```text
/app/dist/server/server.js
/app/src/router.tsx
```

This directly fixes the current container loop.

### 2. Docker Compose: make it Easypanel-safe

Update `docker-compose.yml` so it does not produce noisy unset-variable warnings and so it uses the environment variable names the app actually reads.

The app currently reads these server-side names:

```text
LAB_SUPABASE_URL
LAB_SUPABASE_ANON_KEY
LAB_SUPABASE_SERVICE_ROLE_KEY
```

The Compose file should pass those through, and can also pass the standard aliases for compatibility:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PROJECT_ID
```

Use `${VAR:-}` defaults where interpolation remains, so Easypanel deploy logs do not warn and fail noisily when optional variables are absent.

### 3. Optional compatibility guard in server config

Update the server-side Supabase config to accept both naming styles:

```text
LAB_SUPABASE_URL or SUPABASE_URL
LAB_SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY
LAB_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
```

This prevents future deployment failures caused only by using the standard Supabase variable names in Easypanel.

## Expected result

After redeploying, the container should start and stay running:

```text
vite preview --host 0.0.0.0 --port 5273
Local:   http://localhost:5273/
Network: http://...:5273/
```

It should no longer crash with either:

```text
Cannot find module '/app/dist/server/server.js'
```

or:

```text
Could not resolve entry for router entry: router in /app/src
```

## Easypanel environment variables to set

Set at least these in Easypanel:

```text
LAB_SUPABASE_URL=https://your-supabase-url
LAB_SUPABASE_ANON_KEY=your-anon-or-publishable-key
LAB_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

If you prefer the standard names, the compatibility guard will also support:

```text
SUPABASE_URL=https://your-supabase-url
SUPABASE_PUBLISHABLE_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=selfhosted
```
