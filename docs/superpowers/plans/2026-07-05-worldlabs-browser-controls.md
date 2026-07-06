# WorldLabs Browser Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an LCARS-styled WorldLabs account browser that lists server-stored worlds, shows thumbnails, loads selected worlds through the existing renderer, and deletes worlds after confirmation.

**Architecture:** Extend the local Node server as the only WorldLabs API-key holder, then expose typed web API methods and a testable browser view model. The existing arch panels remain the UI surface: ops owns commands, info owns world cards/details/confirmation, and status owns compact progress/error feedback.

**Tech Stack:** TypeScript, Fastify, Vitest, Vite, IWSDK/UIKitML, Three.js renderer adapters.

---

## File Structure

- Modify `apps/server/src/worldlabs/worldTypes.ts`: add list summary/page/delete types and extend `WorldLabsWorld` for list metadata.
- Modify `apps/server/src/worldlabs/normalizeWorld.ts`: keep render normalization and add world-summary/page normalization.
- Modify `apps/server/src/worldlabs/normalizeWorld.test.ts`: cover summary/page normalization, missing thumbnails, incomplete assets.
- Modify `apps/server/src/worldlabs/worldLabsClient.ts`: add `listWorlds`, `getWorld`, and `deleteWorld`.
- Modify `apps/server/src/worldlabs/worldLabsClient.test.ts`: verify WorldLabs request methods, headers, request bodies, and upstream error messages.
- Create `apps/server/src/routes/worldLabsWorlds.ts`: local server routes for list/get/delete.
- Create `apps/server/src/routes/worldLabsWorlds.test.ts`: route-level tests with mocked client dependencies.
- Modify `apps/server/src/app.ts`: accept/register WorldLabs world browser route dependencies.
- Modify `apps/server/src/server.ts`: wire the existing `WorldLabsClient` into both voice generation and world browser routes.
- Modify `apps/web/src/holodeck/world/worldResult.ts`: add browser-facing summary/page/delete types.
- Modify `apps/web/src/holodeck/api/holodeckApiClient.ts`: add list/get/delete methods.
- Modify `apps/web/src/holodeck/api/holodeckApiClient.test.ts`: verify client URLs, methods, and world normalization.
- Create `apps/web/src/holodeck/world/worldLabsBrowserState.ts`: pure state reducer/view model for paging, selection, delete confirmation, hidden deleted ids, and status.
- Create `apps/web/src/holodeck/world/worldLabsBrowserState.test.ts`: cover loading, empty, paging, selected, loadable, delete-confirm, deleted, stale-hidden, and error states.
- Modify `apps/web/src/holodeck/ui/panelViewModel.ts`: fold browser state into ops/info/status view outputs.
- Modify `apps/web/src/holodeck/ui/panelViewModel.test.ts`: cover browse mode and LCARS command labels.
- Modify `apps/web/src/holodeck/ui/opsPanel.uikitml`: add browse-mode controls.
- Modify `apps/web/src/holodeck/ui/infoPanel.uikitml`: add LCARS world card/detail/confirm regions.
- Modify `apps/web/src/holodeck/ui/statusPanel.uikitml`: add browser status labels if existing ids are insufficient.
- Modify `apps/web/src/panel.ts`: wire panel buttons to browser API calls and existing renderer.
- Modify `apps/web/src/panel.test.ts`: cover helper behavior for browser world renderability and delete-hidden filtering.
- Modify `apps/web/src/index.ts`: pass any new panel controls or API methods needed by `PanelSystem`.

---

### Task 1: Server Types And Normalizers

**Files:**
- Modify: `apps/server/src/worldlabs/worldTypes.ts`
- Modify: `apps/server/src/worldlabs/normalizeWorld.ts`
- Test: `apps/server/src/worldlabs/normalizeWorld.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Add these tests to `apps/server/src/worldlabs/normalizeWorld.test.ts`:

```ts
import {
  normalizeWorld,
  normalizeWorldPage,
  normalizeWorldSummary
} from "./normalizeWorld.js";

it("normalizes a WorldLabs list item into a browser summary", () => {
  expect(
    normalizeWorldSummary({
      world_id: "world-123",
      display_name: "Autumn Park",
      model: "Marble 0.1-plus",
      status: "SUCCEEDED",
      created_at: "2026-07-05T10:00:00Z",
      updated_at: "2026-07-05T10:05:00Z",
      world_prompt: {
        type: "text",
        text_prompt: "a park in autumn"
      },
      assets: {
        thumbnail_url: "https://example.test/thumb.jpg",
        imagery: { pano_url: "https://example.test/pano.jpg" },
        splats: {
          spz_urls: {
            full_res: "https://example.test/full_res.spz"
          }
        }
      }
    })
  ).toEqual({
    worldId: "world-123",
    displayName: "Autumn Park",
    model: "Marble 0.1-plus",
    status: "SUCCEEDED",
    createdAt: "2026-07-05T10:00:00Z",
    updatedAt: "2026-07-05T10:05:00Z",
    thumbnailUrl: "https://example.test/thumb.jpg",
    prompt: "a park in autumn",
    hasPanorama: true,
    hasSplat: true
  });
});

it("normalizes a WorldLabs page and filters invalid world ids", () => {
  expect(
    normalizeWorldPage(
      {
        worlds: [
          { world_id: "world-123", display_name: "Valid World" },
          { display_name: "Missing ID" }
        ],
        next_page_token: "token-2"
      },
      { pageSize: 20, pageToken: "token-1" }
    )
  ).toEqual({
    worlds: [
      {
        worldId: "world-123",
        displayName: "Valid World",
        model: "",
        status: "",
        createdAt: "",
        updatedAt: "",
        thumbnailUrl: "",
        prompt: "",
        hasPanorama: false,
        hasSplat: false
      }
    ],
    nextPageToken: "token-2",
    pageSize: 20,
    pageToken: "token-1"
  });
});

it("keeps incomplete worlds visible but not renderable", () => {
  expect(
    normalizeWorldSummary({
      world_id: "world-pending",
      display_name: "Pending World",
      status: "RUNNING",
      assets: {}
    })
  ).toMatchObject({
    worldId: "world-pending",
    hasPanorama: false,
    hasSplat: false
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test --workspace apps/server -- worldlabs/normalizeWorld.test.ts
```

Expected: FAIL because `normalizeWorldPage` and `normalizeWorldSummary` are not exported yet.

- [ ] **Step 3: Add server types**

Update `apps/server/src/worldlabs/worldTypes.ts`:

```ts
export interface WorldLabsWorld {
  world_id?: string;
  display_name?: string;
  model?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  world_prompt?: {
    type?: string;
    text_prompt?: string;
  };
  assets?: {
    thumbnail_url?: string;
    imagery?: {
      pano_url?: string;
    };
    splats?: {
      spz_urls?: Record<string, string>;
    };
    mesh?: {
      collider_mesh_url?: string;
    };
  };
}

export interface WorldLabsListResponse {
  worlds?: WorldLabsWorld[];
  next_page_token?: string | null;
}

export interface WorldLabsWorldSummary {
  worldId: string;
  displayName: string;
  model: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string;
  prompt: string;
  hasPanorama: boolean;
  hasSplat: boolean;
}

export interface WorldLabsWorldPage {
  worlds: WorldLabsWorldSummary[];
  nextPageToken?: string;
  pageSize: number;
  pageToken?: string;
}

export interface WorldLabsDeleteResult {
  worldId: string;
  deleted: boolean;
}
```

- [ ] **Step 4: Implement summary/page normalizers**

Update `apps/server/src/worldlabs/normalizeWorld.ts` with these exports while preserving existing `normalizeWorld` behavior:

```ts
import type {
  WorldLabsListResponse,
  WorldLabsWorld,
  WorldLabsWorldPage,
  WorldLabsWorldSummary,
  WorldResult
} from "./worldTypes.js";

export function normalizeWorldSummary(
  world: WorldLabsWorld
): WorldLabsWorldSummary | null {
  const worldId = readString(world.world_id);
  if (!worldId) {
    return null;
  }

  const spzUrls = world.assets?.splats?.spz_urls ?? {};
  return {
    worldId,
    displayName: readString(world.display_name) || worldId,
    model: readString(world.model),
    status: readString(world.status),
    createdAt: readString(world.created_at),
    updatedAt: readString(world.updated_at),
    thumbnailUrl: readString(world.assets?.thumbnail_url),
    prompt: readString(world.world_prompt?.text_prompt),
    hasPanorama: Boolean(readString(world.assets?.imagery?.pano_url)),
    hasSplat: Object.values(spzUrls).some((url) => readString(url).length > 0)
  };
}

export function normalizeWorldPage(
  response: WorldLabsListResponse,
  request: { pageSize: number; pageToken?: string }
): WorldLabsWorldPage {
  return {
    worlds: (response.worlds ?? [])
      .map((world) => normalizeWorldSummary(world))
      .filter((world): world is WorldLabsWorldSummary => world !== null),
    ...(readString(response.next_page_token)
      ? { nextPageToken: readString(response.next_page_token) }
      : {}),
    pageSize: request.pageSize,
    ...(request.pageToken ? { pageToken: request.pageToken } : {})
  };
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
```

- [ ] **Step 5: Run normalizer tests**

Run:

```bash
npm run test --workspace apps/server -- worldlabs/normalizeWorld.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/worldlabs/worldTypes.ts apps/server/src/worldlabs/normalizeWorld.ts apps/server/src/worldlabs/normalizeWorld.test.ts
git commit -m "feat: normalize worldlabs browser worlds"
```

---

### Task 2: WorldLabs Client Account World Methods

**Files:**
- Modify: `apps/server/src/worldlabs/worldLabsClient.ts`
- Test: `apps/server/src/worldlabs/worldLabsClient.test.ts`

- [ ] **Step 1: Write failing client tests**

Add tests to `apps/server/src/worldlabs/worldLabsClient.test.ts`:

```ts
it("lists account worlds with pagination options", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        worlds: [{ world_id: "world-123", display_name: "Park" }],
        next_page_token: "next-token"
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );
  const client = new WorldLabsClient("worldlabs-key", {
    baseUrl: "https://worldlabs.test",
    fetch
  });

  await expect(
    client.listWorlds({ pageSize: 12, pageToken: "page-token" })
  ).resolves.toMatchObject({
    worlds: [{ worldId: "world-123", displayName: "Park" }],
    nextPageToken: "next-token",
    pageSize: 12,
    pageToken: "page-token"
  });
  expect(fetch).toHaveBeenCalledWith(
    "https://worldlabs.test/marble/v1/worlds:list",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        "Content-Type": "application/json",
        "WLT-Api-Key": "worldlabs-key"
      }),
      body: JSON.stringify({
        page_size: 12,
        page_token: "page-token",
        sort_by: "created_at"
      })
    })
  );
});

it("gets a world by id as a renderable WorldResult", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        world_id: "world-123",
        display_name: "Park",
        world_prompt: { type: "text", text_prompt: "a park" },
        assets: {
          thumbnail_url: "https://example.test/thumb.jpg",
          imagery: { pano_url: "https://example.test/pano.jpg" },
          splats: { spz_urls: { full_res: "https://example.test/full.spz" } }
        }
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );
  const client = new WorldLabsClient("worldlabs-key", {
    baseUrl: "https://worldlabs.test",
    fetch
  });

  await expect(client.getWorld("world-123")).resolves.toMatchObject({
    worldId: "world-123",
    displayName: "Park",
    prompt: "a park",
    transcript: "a park",
    panoUrl: "https://example.test/pano.jpg",
    thumbnailUrl: "https://example.test/thumb.jpg",
    spzUrls: { full_res: "https://example.test/full.spz" }
  });
});

it("deletes a world by id", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify({ deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  const client = new WorldLabsClient("worldlabs-key", {
    baseUrl: "https://worldlabs.test",
    fetch
  });

  await expect(client.deleteWorld("world-123")).resolves.toEqual({
    worldId: "world-123",
    deleted: true
  });
  expect(fetch).toHaveBeenCalledWith(
    "https://worldlabs.test/marble/v1/worlds/world-123",
    expect.objectContaining({
      method: "DELETE",
      headers: expect.objectContaining({
        "WLT-Api-Key": "worldlabs-key"
      })
    })
  );
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
npm run test --workspace apps/server -- worldlabs/worldLabsClient.test.ts
```

Expected: FAIL because the new methods do not exist.

- [ ] **Step 3: Implement client methods**

Update `apps/server/src/worldlabs/worldLabsClient.ts`:

```ts
import {
  normalizeWorld,
  normalizeWorldPage
} from "./normalizeWorld.js";
import type {
  WorldLabsDeleteResult,
  WorldLabsListResponse,
  WorldLabsWorld,
  WorldLabsWorldPage,
  WorldResult
} from "./worldTypes.js";

interface WorldLabsListOptions {
  pageSize?: number;
  pageToken?: string;
  signal?: AbortSignal;
}

async listWorlds(
  options: WorldLabsListOptions = {}
): Promise<WorldLabsWorldPage> {
  const pageSize = clampPageSize(options.pageSize ?? 20);
  const body = {
    page_size: pageSize,
    ...(options.pageToken ? { page_token: options.pageToken } : {}),
    sort_by: "created_at"
  };
  const response = await this.fetch(`${this.baseUrl}/marble/v1/worlds:list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "WLT-Api-Key": this.apiKey
    },
    signal: options.signal,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `World Labs list worlds failed with ${response.status} ${response.statusText}: ${await readResponseMessage(response)}`
    );
  }

  return normalizeWorldPage((await response.json()) as WorldLabsListResponse, {
    pageSize,
    ...(options.pageToken ? { pageToken: options.pageToken } : {})
  });
}

async getWorld(worldId: string, signal?: AbortSignal): Promise<WorldResult> {
  const safeWorldId = encodeURIComponent(requireWorldId(worldId));
  const response = await this.fetch(
    `${this.baseUrl}/marble/v1/worlds/${safeWorldId}`,
    {
      method: "GET",
      headers: { "WLT-Api-Key": this.apiKey },
      signal
    }
  );

  if (!response.ok) {
    throw new Error(
      `World Labs get world ${worldId} failed with ${response.status} ${response.statusText}: ${await readResponseMessage(response)}`
    );
  }

  const world = (await response.json()) as WorldLabsWorld;
  const prompt =
    typeof world.world_prompt?.text_prompt === "string"
      ? world.world_prompt.text_prompt
      : "";
  return normalizeWorld(world, { prompt, transcript: prompt });
}

async deleteWorld(
  worldId: string,
  signal?: AbortSignal
): Promise<WorldLabsDeleteResult> {
  const requiredWorldId = requireWorldId(worldId);
  const response = await this.fetch(
    `${this.baseUrl}/marble/v1/worlds/${encodeURIComponent(requiredWorldId)}`,
    {
      method: "DELETE",
      headers: { "WLT-Api-Key": this.apiKey },
      signal
    }
  );

  if (!response.ok) {
    throw new Error(
      `World Labs delete world ${worldId} failed with ${response.status} ${response.statusText}: ${await readResponseMessage(response)}`
    );
  }

  const payload = (await response.json()) as { deleted?: unknown };
  return {
    worldId: requiredWorldId,
    deleted: payload.deleted === true
  };
}

function clampPageSize(value: number): number {
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function requireWorldId(worldId: string): string {
  const trimmed = worldId.trim();
  if (!trimmed) {
    throw new Error("World id is required");
  }
  return trimmed;
}
```

- [ ] **Step 4: Run client tests**

Run:

```bash
npm run test --workspace apps/server -- worldlabs/worldLabsClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/worldlabs/worldLabsClient.ts apps/server/src/worldlabs/worldLabsClient.test.ts
git commit -m "feat: add worldlabs account world client"
```

---

### Task 3: Server Routes For WorldLabs Browser

**Files:**
- Create: `apps/server/src/routes/worldLabsWorlds.ts`
- Create: `apps/server/src/routes/worldLabsWorlds.test.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/server.ts`

- [ ] **Step 1: Write failing route tests**

Create `apps/server/src/routes/worldLabsWorlds.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { buildServer } from "../app.js";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

describe("WorldLabs world browser routes", () => {
  it("lists worlds through the local server", async () => {
    const listWorlds = vi.fn<WorldLabsClient["listWorlds"]>().mockResolvedValue({
      worlds: [{ worldId: "world-123", displayName: "Park", model: "", status: "", createdAt: "", updatedAt: "", thumbnailUrl: "", prompt: "", hasPanorama: true, hasSplat: true }],
      nextPageToken: "next-token",
      pageSize: 10
    });
    const app = await buildServer({
      worldLabsWorlds: { worldLabsClient: { listWorlds, getWorld: vi.fn(), deleteWorld: vi.fn() } }
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/worldlabs/worlds?pageSize=10&pageToken=token-1"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ nextPageToken: "next-token" });
      expect(listWorlds).toHaveBeenCalledWith({
        pageSize: 10,
        pageToken: "token-1",
        signal: expect.any(AbortSignal)
      });
    } finally {
      await app.close();
    }
  });

  it("gets a selected world", async () => {
    const getWorld = vi.fn<WorldLabsClient["getWorld"]>().mockResolvedValue({
      worldId: "world-123",
      displayName: "Park",
      prompt: "a park",
      transcript: "a park",
      panoUrl: "https://example.test/pano.jpg",
      spzUrls: {},
      raw: { world_id: "world-123" }
    });
    const app = await buildServer({
      worldLabsWorlds: { worldLabsClient: { listWorlds: vi.fn(), getWorld, deleteWorld: vi.fn() } }
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/worldlabs/worlds/world-123"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ worldId: "world-123" });
      expect(getWorld).toHaveBeenCalledWith("world-123", expect.any(AbortSignal));
    } finally {
      await app.close();
    }
  });

  it("deletes a selected world", async () => {
    const deleteWorld = vi.fn<WorldLabsClient["deleteWorld"]>().mockResolvedValue({
      worldId: "world-123",
      deleted: true
    });
    const app = await buildServer({
      worldLabsWorlds: { worldLabsClient: { listWorlds: vi.fn(), getWorld: vi.fn(), deleteWorld } }
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/worldlabs/worlds/world-123"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ worldId: "world-123", deleted: true });
      expect(deleteWorld).toHaveBeenCalledWith("world-123", expect.any(AbortSignal));
    } finally {
      await app.close();
    }
  });

  it("rejects unsafe world ids", async () => {
    const app = await buildServer({
      worldLabsWorlds: { worldLabsClient: { listWorlds: vi.fn(), getWorld: vi.fn(), deleteWorld: vi.fn() } }
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/worldlabs/worlds/..%2Fsecret"
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "Invalid WorldLabs world id" });
    } finally {
      await app.close();
    }
  });
});
```

- [ ] **Step 2: Run failing route tests**

Run:

```bash
npm run test --workspace apps/server -- routes/worldLabsWorlds.test.ts
```

Expected: FAIL because route file and app wiring do not exist.

- [ ] **Step 3: Implement the route module**

Create `apps/server/src/routes/worldLabsWorlds.ts`:

```ts
import type { FastifyInstance } from "fastify";
import type { WorldLabsClient } from "../worldlabs/worldLabsClient.js";

export interface WorldLabsWorldRouteDeps {
  worldLabsClient: Pick<
    WorldLabsClient,
    "listWorlds" | "getWorld" | "deleteWorld"
  >;
}

export async function registerWorldLabsWorldRoutes(
  app: FastifyInstance,
  deps: WorldLabsWorldRouteDeps
) {
  app.get<{
    Querystring: { pageSize?: string; pageToken?: string };
  }>("/api/worldlabs/worlds", async (request, reply) => {
    const abortController = createAbortController(request.raw);

    try {
      return await deps.worldLabsClient.listWorlds({
        pageSize: parsePageSize(request.query.pageSize),
        ...(request.query.pageToken
          ? { pageToken: request.query.pageToken }
          : {}),
        signal: abortController.signal
      });
    } catch (error) {
      request.log.warn({ err: error }, "WorldLabs list worlds failed");
      return reply.code(502).send({ error: "WorldLabs list unavailable" });
    }
  });

  app.get<{ Params: { worldId: string } }>(
    "/api/worldlabs/worlds/:worldId",
    async (request, reply) => {
      if (!isSafeWorldId(request.params.worldId)) {
        return reply.code(400).send({ error: "Invalid WorldLabs world id" });
      }

      const abortController = createAbortController(request.raw);
      try {
        return await deps.worldLabsClient.getWorld(
          request.params.worldId,
          abortController.signal
        );
      } catch (error) {
        request.log.warn({ err: error }, "WorldLabs get world failed");
        return reply.code(502).send({ error: "WorldLabs world unavailable" });
      }
    }
  );

  app.delete<{ Params: { worldId: string } }>(
    "/api/worldlabs/worlds/:worldId",
    async (request, reply) => {
      if (!isSafeWorldId(request.params.worldId)) {
        return reply.code(400).send({ error: "Invalid WorldLabs world id" });
      }

      const abortController = createAbortController(request.raw);
      try {
        return await deps.worldLabsClient.deleteWorld(
          request.params.worldId,
          abortController.signal
        );
      } catch (error) {
        request.log.warn({ err: error }, "WorldLabs delete world failed");
        return reply.code(502).send({ error: "WorldLabs delete failed" });
      }
    }
  );
}

function parsePageSize(value: string | undefined): number {
  if (!value) {
    return 20;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.min(100, Math.max(1, parsed));
}

function isSafeWorldId(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

function createAbortController(raw: { once: Function }) {
  const abortController = new AbortController();
  raw.once("aborted", () => abortController.abort());
  return abortController;
}
```

- [ ] **Step 4: Wire app and server**

Update `apps/server/src/app.ts`:

```ts
import {
  registerWorldLabsWorldRoutes,
  type WorldLabsWorldRouteDeps
} from "./routes/worldLabsWorlds.js";

interface BuildServerOptions {
  voiceToWorld?: VoiceToWorldRouteDeps;
  worldLabsWorlds?: WorldLabsWorldRouteDeps;
  generatedWorldsDir?: string;
}

if (options.worldLabsWorlds) {
  await registerWorldLabsWorldRoutes(app, options.worldLabsWorlds);
}
```

Update `apps/server/src/server.ts` so one client instance is shared:

```ts
const worldLabsClient = new WorldLabsClient(env.worldLabsApiKey);
const app = await buildServer({
  generatedWorldsDir,
  voiceToWorld: {
    transcriptionClient: new OpenAiTranscriptionClient(env.openAiApiKey),
    worldLabsClient,
    splatDownloader: async (world, options) => {
      const downloaded = await downloadSplat(world, {
        outputDir: generatedWorldsDir,
        signal: options.signal
      });
      return {
        ...downloaded,
        publicUrl: `/generated-worlds/${encodeURIComponent(
          world.worldId
        )}/${encodeURIComponent(basename(downloaded.filePath))}`
      };
    }
  },
  worldLabsWorlds: {
    worldLabsClient
  }
});
```

- [ ] **Step 5: Run route tests**

Run:

```bash
npm run test --workspace apps/server -- routes/worldLabsWorlds.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/worldLabsWorlds.ts apps/server/src/routes/worldLabsWorlds.test.ts apps/server/src/app.ts apps/server/src/server.ts
git commit -m "feat: expose worldlabs browser routes"
```

---

### Task 4: Web API Types And Client Methods

**Files:**
- Modify: `apps/web/src/holodeck/world/worldResult.ts`
- Modify: `apps/web/src/holodeck/api/holodeckApiClient.ts`
- Test: `apps/web/src/holodeck/api/holodeckApiClient.test.ts`

- [ ] **Step 1: Write failing web API tests**

Add tests to `apps/web/src/holodeck/api/holodeckApiClient.test.ts`:

```ts
it("lists WorldLabs worlds through the local API", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        worlds: [{ worldId: "world-123", displayName: "Park" }],
        nextPageToken: "next-token",
        pageSize: 10
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );
  const client = new HolodeckApiClient("http://api.test", fetch);

  await expect(
    client.listWorldLabsWorlds({ pageSize: 10, pageToken: "token-1" })
  ).resolves.toMatchObject({ nextPageToken: "next-token" });
  expect(fetch).toHaveBeenCalledWith(
    "http://api.test/api/worldlabs/worlds?pageSize=10&pageToken=token-1"
  );
});

it("gets a WorldLabs world and normalizes local splat URLs", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify({
        worldId: "world-123",
        displayName: "Park",
        prompt: "a park",
        transcript: "a park",
        panoUrl: "https://example.test/pano.jpg",
        spzUrls: {},
        localSplat: {
          sourceUrl: "https://example.test/full.spz",
          filePath: "/tmp/full.spz",
          publicUrl: "/generated-worlds/world-123/full_res.spz",
          resolution: "full_res",
          byteLength: 100
        },
        raw: {}
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    )
  );
  const client = new HolodeckApiClient("http://api.test", fetch);

  await expect(client.getWorldLabsWorld("world-123")).resolves.toMatchObject({
    localSplat: {
      publicUrl: "http://api.test/generated-worlds/world-123/full_res.spz"
    }
  });
});

it("deletes a WorldLabs world through the local API", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify({ worldId: "world-123", deleted: true }), {
      status: 200,
      headers: { "content-type": "application/json" }
    })
  );
  const client = new HolodeckApiClient("http://api.test", fetch);

  await expect(client.deleteWorldLabsWorld("world-123")).resolves.toEqual({
    worldId: "world-123",
    deleted: true
  });
  expect(fetch).toHaveBeenCalledWith(
    "http://api.test/api/worldlabs/worlds/world-123",
    { method: "DELETE" }
  );
});
```

- [ ] **Step 2: Run failing web API tests**

Run:

```bash
npm run test --workspace apps/web -- holodeck/api/holodeckApiClient.test.ts
```

Expected: FAIL because browser world methods do not exist.

- [ ] **Step 3: Add web types**

Update `apps/web/src/holodeck/world/worldResult.ts`:

```ts
export interface WorldLabsWorldSummary {
  worldId: string;
  displayName: string;
  model: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl: string;
  prompt: string;
  hasPanorama: boolean;
  hasSplat: boolean;
}

export interface WorldLabsWorldPage {
  worlds: WorldLabsWorldSummary[];
  nextPageToken?: string;
  pageSize: number;
  pageToken?: string;
}

export interface WorldLabsDeleteResult {
  worldId: string;
  deleted: boolean;
}
```

- [ ] **Step 4: Implement web API methods**

Update `apps/web/src/holodeck/api/holodeckApiClient.ts`:

```ts
import type {
  WorldLabsDeleteResult,
  WorldLabsWorldPage
} from "../world/worldResult";

export interface HolodeckApi {
  voiceToWorld(audio: Blob): Promise<WorldResult>;
  startVoiceToWorldJob?(audio: Blob): Promise<VoiceToWorldJob>;
  getVoiceToWorldJob?(jobId: string): Promise<VoiceToWorldJob>;
  listWorldLabsWorlds?(options?: {
    pageSize?: number;
    pageToken?: string;
  }): Promise<WorldLabsWorldPage>;
  getWorldLabsWorld?(worldId: string): Promise<WorldResult>;
  deleteWorldLabsWorld?(worldId: string): Promise<WorldLabsDeleteResult>;
}

async listWorldLabsWorlds(options: {
  pageSize?: number;
  pageToken?: string;
} = {}): Promise<WorldLabsWorldPage> {
  const url = new URL(`${this.baseUrl}/api/worldlabs/worlds`);
  if (options.pageSize) {
    url.searchParams.set("pageSize", String(options.pageSize));
  }
  if (options.pageToken) {
    url.searchParams.set("pageToken", options.pageToken);
  }

  const response = await this.fetchImpl(url.toString());
  if (!response.ok) {
    throw new Error(
      `WorldLabs worlds list failed: HTTP ${response.status} ${await response.text()}`
    );
  }
  return (await response.json()) as WorldLabsWorldPage;
}

async getWorldLabsWorld(worldId: string): Promise<WorldResult> {
  const response = await this.fetchImpl(
    `${this.baseUrl}/api/worldlabs/worlds/${encodeURIComponent(worldId)}`
  );
  if (!response.ok) {
    throw new Error(
      `WorldLabs world load failed: HTTP ${response.status} ${await response.text()}`
    );
  }
  return this.normalizeWorld((await response.json()) as WorldResult);
}

async deleteWorldLabsWorld(worldId: string): Promise<WorldLabsDeleteResult> {
  const response = await this.fetchImpl(
    `${this.baseUrl}/api/worldlabs/worlds/${encodeURIComponent(worldId)}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(
      `WorldLabs world delete failed: HTTP ${response.status} ${await response.text()}`
    );
  }
  return (await response.json()) as WorldLabsDeleteResult;
}
```

- [ ] **Step 5: Run web API tests**

Run:

```bash
npm run test --workspace apps/web -- holodeck/api/holodeckApiClient.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/holodeck/world/worldResult.ts apps/web/src/holodeck/api/holodeckApiClient.ts apps/web/src/holodeck/api/holodeckApiClient.test.ts
git commit -m "feat: add worldlabs browser api client"
```

---

### Task 5: Browser State View Model

**Files:**
- Create: `apps/web/src/holodeck/world/worldLabsBrowserState.ts`
- Create: `apps/web/src/holodeck/world/worldLabsBrowserState.test.ts`

- [ ] **Step 1: Write failing browser state tests**

Create `apps/web/src/holodeck/world/worldLabsBrowserState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createWorldLabsBrowserState,
  confirmWorldDelete,
  failWorldLabsBrowser,
  loadWorldLabsPage,
  markWorldDeleted,
  selectWorldLabsWorld
} from "./worldLabsBrowserState";

const page = {
  worlds: [
    {
      worldId: "world-123",
      displayName: "Autumn Park",
      model: "Marble 0.1-plus",
      status: "SUCCEEDED",
      createdAt: "2026-07-05T10:00:00Z",
      updatedAt: "2026-07-05T10:05:00Z",
      thumbnailUrl: "https://example.test/thumb.jpg",
      prompt: "a park",
      hasPanorama: true,
      hasSplat: true
    }
  ],
  nextPageToken: "next-token",
  pageSize: 20
};

describe("WorldLabs browser state", () => {
  it("loads a page and selects a renderable world", () => {
    let state = createWorldLabsBrowserState();
    state = loadWorldLabsPage(state, page);
    state = selectWorldLabsWorld(state, "world-123");

    expect(state.selectedWorldId).toBe("world-123");
    expect(state.selectedWorld?.displayName).toBe("Autumn Park");
    expect(state.canLoadSelectedWorld).toBe(true);
    expect(state.statusMessage).toBe("Selected Autumn Park.");
  });

  it("enters and exits delete confirmation", () => {
    let state = loadWorldLabsPage(createWorldLabsBrowserState(), page);
    state = selectWorldLabsWorld(state, "world-123");
    state = confirmWorldDelete(state);

    expect(state.pendingDeleteWorldId).toBe("world-123");
    expect(state.mode).toBe("confirm-delete");
  });

  it("hides deleted worlds from stale remote pages", () => {
    let state = loadWorldLabsPage(createWorldLabsBrowserState(), page);
    state = selectWorldLabsWorld(state, "world-123");
    state = markWorldDeleted(state, "world-123");
    state = loadWorldLabsPage(state, page);

    expect(state.worlds).toEqual([]);
    expect(state.hiddenDeletedWorldIds).toContain("world-123");
  });

  it("keeps the previous page visible after list failure", () => {
    let state = loadWorldLabsPage(createWorldLabsBrowserState(), page);
    state = failWorldLabsBrowser(state, "WorldLabs list unavailable");

    expect(state.worlds).toHaveLength(1);
    expect(state.errorMessage).toBe("WorldLabs list unavailable");
  });
});
```

- [ ] **Step 2: Run failing browser state tests**

Run:

```bash
npm run test --workspace apps/web -- holodeck/world/worldLabsBrowserState.test.ts
```

Expected: FAIL because the browser state module does not exist.

- [ ] **Step 3: Implement browser state**

Create `apps/web/src/holodeck/world/worldLabsBrowserState.ts`:

```ts
import type {
  WorldLabsWorldPage,
  WorldLabsWorldSummary
} from "./worldResult";

export type WorldLabsBrowserMode = "closed" | "browse" | "confirm-delete";

export interface WorldLabsBrowserState {
  mode: WorldLabsBrowserMode;
  worlds: WorldLabsWorldSummary[];
  selectedWorldId: string | null;
  pendingDeleteWorldId: string | null;
  nextPageToken: string | null;
  pageTokenHistory: string[];
  hiddenDeletedWorldIds: string[];
  isLoading: boolean;
  isDeleting: boolean;
  errorMessage: string;
  statusMessage: string;
  selectedWorld: WorldLabsWorldSummary | null;
  canLoadSelectedWorld: boolean;
}

export function createWorldLabsBrowserState(): WorldLabsBrowserState {
  return deriveBrowserState({
    mode: "closed",
    worlds: [],
    selectedWorldId: null,
    pendingDeleteWorldId: null,
    nextPageToken: null,
    pageTokenHistory: [],
    hiddenDeletedWorldIds: [],
    isLoading: false,
    isDeleting: false,
    errorMessage: "",
    statusMessage: "WorldLabs browser standing by."
  });
}

export function openWorldLabsBrowser(
  state: WorldLabsBrowserState
): WorldLabsBrowserState {
  return deriveBrowserState({
    ...state,
    mode: "browse",
    statusMessage: "Browsing WorldLabs worlds."
  });
}

export function loadWorldLabsPage(
  state: WorldLabsBrowserState,
  page: WorldLabsWorldPage
): WorldLabsBrowserState {
  const hidden = new Set(state.hiddenDeletedWorldIds);
  return deriveBrowserState({
    ...state,
    mode: "browse",
    worlds: page.worlds.filter((world) => !hidden.has(world.worldId)),
    nextPageToken: page.nextPageToken ?? null,
    isLoading: false,
    errorMessage: "",
    statusMessage:
      page.worlds.length === 0 ? "No WorldLabs worlds found." : "WorldLabs worlds loaded."
  });
}

export function selectWorldLabsWorld(
  state: WorldLabsBrowserState,
  worldId: string
): WorldLabsBrowserState {
  const world = state.worlds.find((candidate) => candidate.worldId === worldId);
  return deriveBrowserState({
    ...state,
    selectedWorldId: world?.worldId ?? null,
    pendingDeleteWorldId: null,
    mode: "browse",
    statusMessage: world ? `Selected ${world.displayName}.` : "World selection cleared."
  });
}

export function confirmWorldDelete(
  state: WorldLabsBrowserState
): WorldLabsBrowserState {
  return deriveBrowserState({
    ...state,
    mode: state.selectedWorldId ? "confirm-delete" : state.mode,
    pendingDeleteWorldId: state.selectedWorldId,
    statusMessage: state.selectedWorldId
      ? "Confirm WorldLabs delete."
      : "Select a WorldLabs world first."
  });
}

export function markWorldDeleted(
  state: WorldLabsBrowserState,
  worldId: string
): WorldLabsBrowserState {
  const hiddenDeletedWorldIds = Array.from(
    new Set([...state.hiddenDeletedWorldIds, worldId])
  );
  return deriveBrowserState({
    ...state,
    mode: "browse",
    worlds: state.worlds.filter((world) => world.worldId !== worldId),
    selectedWorldId: state.selectedWorldId === worldId ? null : state.selectedWorldId,
    pendingDeleteWorldId: null,
    hiddenDeletedWorldIds,
    isDeleting: false,
    statusMessage: "WorldLabs world deleted."
  });
}

export function failWorldLabsBrowser(
  state: WorldLabsBrowserState,
  message: string
): WorldLabsBrowserState {
  return deriveBrowserState({
    ...state,
    isLoading: false,
    isDeleting: false,
    errorMessage: message,
    statusMessage: message
  });
}

function deriveBrowserState(
  state: Omit<WorldLabsBrowserState, "selectedWorld" | "canLoadSelectedWorld">
): WorldLabsBrowserState {
  const selectedWorld =
    state.worlds.find((world) => world.worldId === state.selectedWorldId) ?? null;
  return {
    ...state,
    selectedWorld,
    canLoadSelectedWorld: Boolean(
      selectedWorld && (selectedWorld.hasPanorama || selectedWorld.hasSplat)
    )
  };
}
```

- [ ] **Step 4: Run browser state tests**

Run:

```bash
npm run test --workspace apps/web -- holodeck/world/worldLabsBrowserState.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/holodeck/world/worldLabsBrowserState.ts apps/web/src/holodeck/world/worldLabsBrowserState.test.ts
git commit -m "feat: model worldlabs browser state"
```

---

### Task 6: LCARS Panel View Model And UIKitML

**Files:**
- Modify: `apps/web/src/holodeck/ui/panelViewModel.ts`
- Modify: `apps/web/src/holodeck/ui/panelViewModel.test.ts`
- Modify: `apps/web/src/holodeck/ui/opsPanel.uikitml`
- Modify: `apps/web/src/holodeck/ui/infoPanel.uikitml`
- Modify: `apps/web/src/holodeck/ui/statusPanel.uikitml`

- [ ] **Step 1: Write failing panel view-model tests**

Add tests to `apps/web/src/holodeck/ui/panelViewModel.test.ts`:

```ts
it("shows LCARS browser controls while browsing WorldLabs worlds", () => {
  const view = buildPanelViewModel({
    state: { current: "Idle", errorMessage: "", statusMessage: "" },
    selectedModelLabel: "Marble 1.1",
    isRecording: false,
    isGenerating: false,
    transcript: "",
    rendererLabel: "None",
    loadedWorld: null,
    worldElapsedMs: null,
    browser: {
      mode: "browse",
      worlds: [],
      selectedWorldId: null,
      pendingDeleteWorldId: null,
      nextPageToken: "next-token",
      pageTokenHistory: [],
      hiddenDeletedWorldIds: [],
      isLoading: false,
      isDeleting: false,
      errorMessage: "",
      statusMessage: "WorldLabs worlds loaded.",
      selectedWorld: null,
      canLoadSelectedWorld: false
    }
  });

  expect(view.ops.primaryAction).toBe("BROWSE");
  expect(view.ops.secondaryAction).toBe("REFRESH");
  expect(view.info.title).toBe("WORLDLABS BROWSER");
  expect(view.status.message).toContain("WorldLabs worlds loaded.");
});

it("shows delete confirmation as an LCARS alert", () => {
  const view = buildPanelViewModel({
    state: { current: "Idle", errorMessage: "", statusMessage: "" },
    selectedModelLabel: "Marble 1.1",
    isRecording: false,
    isGenerating: false,
    transcript: "",
    rendererLabel: "None",
    loadedWorld: null,
    worldElapsedMs: null,
    browser: {
      mode: "confirm-delete",
      worlds: [],
      selectedWorldId: "world-123",
      pendingDeleteWorldId: "world-123",
      nextPageToken: null,
      pageTokenHistory: [],
      hiddenDeletedWorldIds: [],
      isLoading: false,
      isDeleting: false,
      errorMessage: "",
      statusMessage: "Confirm WorldLabs delete.",
      selectedWorld: {
        worldId: "world-123",
        displayName: "Autumn Park",
        model: "Marble 0.1-plus",
        status: "SUCCEEDED",
        createdAt: "",
        updatedAt: "",
        thumbnailUrl: "",
        prompt: "a park",
        hasPanorama: true,
        hasSplat: true
      },
      canLoadSelectedWorld: true
    }
  });

  expect(view.info.title).toBe("CONFIRM DELETE");
  expect(view.info.detail).toContain("Autumn Park");
  expect(view.status.mode).toBe("ALERT");
});
```

- [ ] **Step 2: Run failing panel view-model tests**

Run:

```bash
npm run test --workspace apps/web -- holodeck/ui/panelViewModel.test.ts
```

Expected: FAIL because `browser` input is not supported.

- [ ] **Step 3: Extend panel view model**

Update `PanelViewModelInput` in `apps/web/src/holodeck/ui/panelViewModel.ts`:

```ts
import type { WorldLabsBrowserState } from "../world/worldLabsBrowserState";

export interface PanelViewModelInput {
  state: Pick<HolodeckStateMachine, "current" | "errorMessage" | "statusMessage">;
  selectedModelLabel: string;
  isRecording: boolean;
  isGenerating: boolean;
  transcript: string;
  rendererLabel: string;
  loadedWorld: LoadedWorldPanelInfo | null;
  worldElapsedMs: number | null;
  browser?: WorldLabsBrowserState;
}
```

Inside `buildPanelViewModel`, branch before the existing idle/ready info output:

```ts
if (input.browser?.mode === "browse" || input.browser?.mode === "confirm-delete") {
  return buildBrowserPanelView(input);
}
```

Add:

```ts
function buildBrowserPanelView(input: PanelViewModelInput): PanelViewModel {
  const browser = input.browser!;
  const selected = browser.selectedWorld;

  return {
    ops: {
      primaryAction: "BROWSE",
      secondaryAction: browser.mode === "confirm-delete" ? "CONFIRM" : "REFRESH",
      resetAction: browser.mode === "confirm-delete" ? "CANCEL" : "BACK",
      modeLabel: "MODE BROWSER",
      modelLabel: `Model: ${input.selectedModelLabel}`
    },
    info:
      browser.mode === "confirm-delete"
        ? {
            title: "CONFIRM DELETE",
            source: "WORLDLABS SERVER",
            detail: `${selected?.displayName ?? "Selected world"} will be permanently deleted.`,
            asset: "ACTION DELETE"
          }
        : {
            title: "WORLDLABS BROWSER",
            source: selected ? selected.displayName : "SELECT WORLD",
            detail:
              selected?.prompt ||
              `${browser.worlds.length.toString()} worlds on this page`,
            asset: selected
              ? selected.hasSplat
                ? "ASSET SPZ"
                : selected.hasPanorama
                  ? "ASSET PANO"
                  : "ASSET PENDING"
              : "ASSET NONE"
          },
    status: {
      mode: browser.mode === "confirm-delete" ? "ALERT" : "BROWSE",
      message: browser.errorMessage || browser.statusMessage,
      level: browser.errorMessage ? "error" : browser.mode === "confirm-delete" ? "warning" : "info"
    }
  };
}
```

- [ ] **Step 4: Update UIKitML ids and styling**

Modify UIKitML files while preserving current LCARS colors and arch split:

```xml
<!-- opsPanel.uikitml: add buttons or text nodes with stable ids -->
<button id="browseWorldsButton" class="command-button">BROWSE</button>
<button id="refreshWorldsButton" class="command-button">REFRESH</button>
<button id="prevWorldsButton" class="command-button">PREV</button>
<button id="nextWorldsButton" class="command-button">NEXT</button>
<button id="loadWorldButton" class="command-button">LOAD</button>
<button id="deleteWorldButton" class="command-button danger">DELETE</button>
```

```xml
<!-- infoPanel.uikitml: add fixed card slots with stable ids -->
<div id="worldBrowserList" class="world-browser-list">
  <div id="worldCard0" class="world-card"></div>
  <div id="worldCard1" class="world-card"></div>
  <div id="worldCard2" class="world-card"></div>
  <div id="worldCard3" class="world-card"></div>
</div>
<div id="worldDeleteConfirm" class="delete-confirm">
  <span id="worldDeleteConfirmText">CONFIRM DELETE</span>
</div>
```

Keep all new card styles rectangular, LCARS-colored, and within the existing info panel bounds.

- [ ] **Step 5: Run web tests and UIKitML compile through build**

Run:

```bash
npm run test --workspace apps/web -- holodeck/ui/panelViewModel.test.ts
npm run build --workspace apps/web
```

Expected: tests PASS and build PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/holodeck/ui/panelViewModel.ts apps/web/src/holodeck/ui/panelViewModel.test.ts apps/web/src/holodeck/ui/opsPanel.uikitml apps/web/src/holodeck/ui/infoPanel.uikitml apps/web/src/holodeck/ui/statusPanel.uikitml apps/web/public/ui/holodeck/opsPanel.json apps/web/public/ui/holodeck/infoPanel.json apps/web/public/ui/holodeck/statusPanel.json
git commit -m "feat: add lcars worldlabs browser panels"
```

---

### Task 7: Panel Runtime Wiring And Rendering

**Files:**
- Modify: `apps/web/src/panel.ts`
- Modify: `apps/web/src/panel.test.ts`
- Modify: `apps/web/src/index.ts`

- [ ] **Step 1: Write failing panel helper tests**

Add tests to `apps/web/src/panel.test.ts`:

```ts
describe("WorldLabs browser panel helpers", () => {
  it("treats WorldLabs summaries with pano or splat assets as loadable", async () => {
    const { isWorldLabsSummaryLoadable } = await importPanel();

    expect(
      isWorldLabsSummaryLoadable({
        worldId: "world-123",
        displayName: "Park",
        model: "",
        status: "",
        createdAt: "",
        updatedAt: "",
        thumbnailUrl: "",
        prompt: "",
        hasPanorama: true,
        hasSplat: false
      })
    ).toBe(true);
  });

  it("filters hidden deleted ids from browser world pages", async () => {
    const { filterHiddenWorldLabsWorlds } = await importPanel();

    expect(
      filterHiddenWorldLabsWorlds(
        {
          worlds: [
            { worldId: "world-123", displayName: "Park" },
            { worldId: "world-456", displayName: "Circus" }
          ],
          pageSize: 20
        },
        ["world-123"]
      ).worlds
    ).toEqual([{ worldId: "world-456", displayName: "Circus" }]);
  });
});
```

- [ ] **Step 2: Run failing panel tests**

Run:

```bash
npm run test --workspace apps/web -- src/panel.test.ts
```

Expected: FAIL because helper exports do not exist.

- [ ] **Step 3: Wire browser state into `PanelSystem`**

Update `apps/web/src/panel.ts`:

```ts
import {
  createWorldLabsBrowserState,
  failWorldLabsBrowser,
  loadWorldLabsPage,
  markWorldDeleted,
  openWorldLabsBrowser,
  selectWorldLabsWorld,
  confirmWorldDelete
} from "./holodeck/world/worldLabsBrowserState";
import type {
  WorldLabsWorldPage,
  WorldLabsWorldSummary
} from "./holodeck/world/worldResult";

let browserState = createWorldLabsBrowserState();

export function isWorldLabsSummaryLoadable(
  world: Pick<WorldLabsWorldSummary, "hasPanorama" | "hasSplat">
): boolean {
  return world.hasPanorama || world.hasSplat;
}

export function filterHiddenWorldLabsWorlds<T extends { worldId: string }>(
  page: { worlds: T[]; pageSize: number; nextPageToken?: string; pageToken?: string },
  hiddenWorldIds: string[]
): { worlds: T[]; pageSize: number; nextPageToken?: string; pageToken?: string } {
  const hidden = new Set(hiddenWorldIds);
  return {
    ...page,
    worlds: page.worlds.filter((world) => !hidden.has(world.worldId))
  };
}
```

Update the panel view input builder:

```ts
browser: browserState
```

Add async handlers in `PanelSystem`:

```ts
async function refreshWorldLabsWorlds() {
  if (!controls.api.listWorldLabsWorlds) {
    browserState = failWorldLabsBrowser(browserState, "WorldLabs browser API unavailable.");
    return;
  }
  browserState = openWorldLabsBrowser(browserState);
  refreshPanelViews();
  try {
    const page = await controls.api.listWorldLabsWorlds({ pageSize: 20 });
    browserState = loadWorldLabsPage(browserState, page);
  } catch (error) {
    browserState = failWorldLabsBrowser(
      browserState,
      error instanceof Error ? error.message : "WorldLabs list unavailable"
    );
  }
  refreshPanelViews();
}

async function loadSelectedWorldLabsWorld() {
  if (!browserState.selectedWorldId || !controls.api.getWorldLabsWorld) {
    return;
  }
  const world = await controls.api.getWorldLabsWorld(browserState.selectedWorldId);
  await controls.renderer.load(world);
  controls.renderer.show();
  setLoadedWorldPanelInfo({
    title: world.displayName || world.worldId,
    source: "WORLD LABS",
    detail: world.prompt,
    assetLabel: hasSplatSource(world) ? "SPZ" : "PANO"
  });
}

async function deletePendingWorldLabsWorld() {
  if (!browserState.pendingDeleteWorldId || !controls.api.deleteWorldLabsWorld) {
    return;
  }
  const result = await controls.api.deleteWorldLabsWorld(browserState.pendingDeleteWorldId);
  if (result.deleted) {
    browserState = markWorldDeleted(browserState, result.worldId);
  }
  refreshPanelViews();
}
```

Bind new button ids:

```ts
bindClick(document, "browseWorldsButton", refreshWorldLabsWorlds);
bindClick(document, "refreshWorldsButton", refreshWorldLabsWorlds);
bindClick(document, "loadWorldButton", loadSelectedWorldLabsWorld);
bindClick(document, "deleteWorldButton", () => {
  browserState = confirmWorldDelete(browserState);
  refreshPanelViews();
});
bindClick(document, "confirmDeleteWorldButton", deletePendingWorldLabsWorld);
```

- [ ] **Step 4: Update `HolodeckPanelControls` and `index.ts`**

Update `apps/web/src/panel.ts`:

```ts
import type { HolodeckApi } from "./holodeck/api/holodeckApiClient";

interface HolodeckPanelControls {
  state: HolodeckStateMachine;
  recorder: BrowserVoiceRecorder;
  coordinator: VoiceToWorldCoordinator;
  renderer: WorldRenderer;
  openLocalSplatFilePicker: () => void;
  api: HolodeckApi;
}
```

Update `apps/web/src/index.ts` inside the existing `configureHolodeckPanelControls` call:

```ts
configureHolodeckPanelControls({
  state,
  recorder,
  coordinator,
  renderer: worldRenderer,
  openLocalSplatFilePicker: () => localSplatFileInput.click(),
  api
});
```

- [ ] **Step 5: Run focused panel tests**

Run:

```bash
npm run test --workspace apps/web -- src/panel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/panel.ts apps/web/src/panel.test.ts apps/web/src/index.ts
git commit -m "feat: wire worldlabs browser panel actions"
```

---

### Task 8: Full Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run server tests**

Run:

```bash
npm run test --workspace apps/server
```

Expected: PASS.

- [ ] **Step 2: Run web tests**

Run:

```bash
npm run test --workspace apps/web
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build --workspace apps/web
```

Expected: PASS. The existing large chunk warning may appear.

- [ ] **Step 4: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Manual smoke test**

Run the local servers if they are not already running:

```bash
npm run dev:server
npm run dev:web
```

Open `https://localhost:8081/`.

Expected:

- arch panels render,
- Browse opens the WorldLabs browser mode,
- thumbnails or LCARS fallback tiles appear,
- selecting a world enables Load only when render assets exist,
- Load renders the selected world,
- Delete opens confirmation,
- Cancel leaves the world in the list,
- Confirm Delete removes the world from the list after server success,
- local SPZ loading still works and remains labeled as local/loose.

- [ ] **Step 6: Record verification result**

Run:

```bash
git status --short
```

Expected: no output after all task commits and verification fixes are complete.

---

## Self-Review

- Spec coverage: server list/get/delete, browser API methods, LCARS arch browser UI, thumbnails/fallback tiles, load, delete confirmation, stale-delete hiding, local-vs-WorldLabs separation, and tests are covered.
- Scope check: local storage, local cache browsing, save-as/fork, tag editing, and prompt history remain outside this implementation.
- Type consistency: server and web both use `WorldLabsWorldSummary`, `WorldLabsWorldPage`, and `WorldLabsDeleteResult`; renderable worlds remain `WorldResult`.
- Verification: focused tests are included in each task; full server/web/build checks are included at the end.
