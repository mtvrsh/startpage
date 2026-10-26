// Cloudflare Workers entry point. All routing and handling lives in
// `router.ts`, which is structured so it also typechecks outside the Workers
// runtime (the frontend test suite imports it).
import { handleRequest } from './router';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
