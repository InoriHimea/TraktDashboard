import { hc } from "hono/client";
import type { AppType } from "@trakt-dashboard/api/app-type";

// Typed Hono RPC client (P1-T12). Available for incremental hook migration off the
// hand-written `api` client in ./api.ts (which remains the primary client for now).
//
// Full end-to-end RPC inference additionally requires the API route files to
// method-chain their handlers; until that incremental refactor lands, this client
// provides the wiring and path-level typing.
export const rpc = hc<AppType>("/");
