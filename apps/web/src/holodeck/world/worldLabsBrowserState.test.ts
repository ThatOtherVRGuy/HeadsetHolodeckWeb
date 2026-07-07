import { describe, expect, it } from "vitest";

import type { WorldLabsWorldPage } from "./worldResult.js";
import {
  confirmWorldDelete,
  createWorldLabsBrowserState,
  failWorldLabsBrowser,
  loadWorldLabsPage,
  markWorldDeleted,
  openWorldLabsBrowser,
  selectWorldLabsWorld
} from "./worldLabsBrowserState.js";

function createPage(
  worlds: WorldLabsWorldPage["worlds"],
  overrides: Partial<WorldLabsWorldPage> = {}
): WorldLabsWorldPage {
  return {
    worlds,
    pageSize: overrides.pageSize ?? worlds.length,
    nextPageToken: overrides.nextPageToken,
    pageToken: overrides.pageToken
  };
}

describe("worldLabsBrowserState", () => {
  it("creates closed state and opens into browse mode", () => {
    const state = createWorldLabsBrowserState({ pageSize: 12 });

    expect(state.mode).toBe("closed");
    expect(state.pageSize).toBe(12);
    expect(state.worlds).toEqual([]);
    expect(state.selectedWorld).toBeNull();
    expect(state.canLoadSelectedWorld).toBe(false);

    const opened = openWorldLabsBrowser(state);

    expect(opened.mode).toBe("browse");
    expect(opened.pageSize).toBe(12);
    expect(opened.worlds).toEqual([]);
  });

  it("replaces and appends page results", () => {
    const firstPage = createPage([
      {
        worldId: "world-1",
        displayName: "World One",
        model: "standard",
        status: "ready",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        thumbnailUrl: "/thumb-1.jpg",
        prompt: "one",
        hasPanorama: true,
        hasSplat: false
      }
    ], {
      nextPageToken: "page-2",
      pageToken: ""
    });
    const secondPage = createPage([
      {
        worldId: "world-2",
        displayName: "World Two",
        model: "standard",
        status: "ready",
        createdAt: "2026-01-02T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        thumbnailUrl: "/thumb-2.jpg",
        prompt: "two",
        hasPanorama: false,
        hasSplat: true
      }
    ], {
      nextPageToken: undefined,
      pageToken: "page-2"
    });

    const replaced = loadWorldLabsPage(createWorldLabsBrowserState(), firstPage);
    const appended = loadWorldLabsPage(replaced, secondPage, { append: true });

    expect(replaced.worlds.map((world) => world.worldId)).toEqual(["world-1"]);
    expect(replaced.nextPageToken).toBe("page-2");
    expect(replaced.pageToken).toBe("");
    expect(appended.worlds.map((world) => world.worldId)).toEqual([
      "world-1",
      "world-2"
    ]);
    expect(appended.nextPageToken).toBeNull();
    expect(appended.pageToken).toBe("page-2");
  });

  it("selects a visible world and derives canLoadSelectedWorld", () => {
    const state = loadWorldLabsPage(
      openWorldLabsBrowser(createWorldLabsBrowserState()),
      createPage([
        {
          worldId: "world-1",
          displayName: "World One",
          model: "standard",
          status: "ready",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          thumbnailUrl: "/thumb-1.jpg",
          prompt: "one",
          hasPanorama: false,
          hasSplat: false
        },
        {
          worldId: "world-2",
          displayName: "World Two",
          model: "standard",
          status: "ready",
          createdAt: "2026-01-02T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
          thumbnailUrl: "/thumb-2.jpg",
          prompt: "two",
          hasPanorama: true,
          hasSplat: false
        }
      ])
    );

    const selected = selectWorldLabsWorld(state, "world-2");

    expect(selected.selectedWorldId).toBe("world-2");
    expect(selected.selectedWorld?.worldId).toBe("world-2");
    expect(selected.canLoadSelectedWorld).toBe(true);
    expect(selectWorldLabsWorld(selected, "missing").selectedWorldId).toBe(
      "missing"
    );
    expect(selectWorldLabsWorld(selected, "missing").selectedWorld).toBeNull();
    expect(selectWorldLabsWorld(selected, "missing").canLoadSelectedWorld).toBe(
      false
    );
  });

  it("confirms delete from the selected world by default", () => {
    const state = selectWorldLabsWorld(
      loadWorldLabsPage(
        openWorldLabsBrowser(createWorldLabsBrowserState()),
        createPage([
          {
            worldId: "world-1",
            displayName: "World One",
            model: "standard",
            status: "ready",
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            thumbnailUrl: "/thumb-1.jpg",
            prompt: "one",
            hasPanorama: true,
            hasSplat: false
          }
        ])
      ),
      "world-1"
    );

    const confirming = confirmWorldDelete(state);

    expect(confirming.mode).toBe("confirm-delete");
    expect(confirming.pendingDeleteWorldId).toBe("world-1");
  });

  it("marks deleted worlds hidden and clears matching selection", () => {
    const state = selectWorldLabsWorld(
      confirmWorldDelete(
        loadWorldLabsPage(
          openWorldLabsBrowser(createWorldLabsBrowserState()),
          createPage([
            {
              worldId: "world-1",
              displayName: "World One",
              model: "standard",
              status: "ready",
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
              thumbnailUrl: "/thumb-1.jpg",
              prompt: "one",
              hasPanorama: true,
              hasSplat: false
            },
            {
              worldId: "world-2",
              displayName: "World Two",
              model: "standard",
              status: "ready",
              createdAt: "2026-01-02T00:00:00Z",
              updatedAt: "2026-01-02T00:00:00Z",
              thumbnailUrl: "/thumb-2.jpg",
              prompt: "two",
              hasPanorama: false,
              hasSplat: true
            }
          ])
        ),
        "world-1"
      ),
      "world-2"
    );

    const deleted = markWorldDeleted(state, "world-2");
    const stalePage = createPage([
      {
        worldId: "world-2",
        displayName: "World Two",
        model: "standard",
        status: "ready",
        createdAt: "2026-01-03T00:00:00Z",
        updatedAt: "2026-01-03T00:00:00Z",
        thumbnailUrl: "/thumb-2b.jpg",
        prompt: "two again",
        hasPanorama: false,
        hasSplat: true
      },
      {
        worldId: "world-3",
        displayName: "World Three",
        model: "standard",
        status: "ready",
        createdAt: "2026-01-03T00:00:00Z",
        updatedAt: "2026-01-03T00:00:00Z",
        thumbnailUrl: "/thumb-3.jpg",
        prompt: "three",
        hasPanorama: true,
        hasSplat: false
      }
    ]);
    const reloaded = loadWorldLabsPage(deleted, stalePage, { append: true });

    expect(deleted.mode).toBe("browse");
    expect(deleted.worlds.map((world) => world.worldId)).toEqual(["world-1"]);
    expect(deleted.selectedWorldId).toBeNull();
    expect(deleted.pendingDeleteWorldId).toBe("world-1");
    expect(deleted.hiddenDeletedWorldIds).toContain("world-2");
    expect(reloaded.worlds.map((world) => world.worldId)).toEqual([
      "world-1",
      "world-3"
    ]);
    expect(reloaded.selectedWorldId).toBeNull();
    expect(reloaded.pendingDeleteWorldId).toBe("world-1");
  });

  it("fails without losing loaded worlds", () => {
    const loaded = loadWorldLabsPage(
      openWorldLabsBrowser(createWorldLabsBrowserState()),
      createPage([
        {
          worldId: "world-1",
          displayName: "World One",
          model: "standard",
          status: "ready",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          thumbnailUrl: "/thumb-1.jpg",
          prompt: "one",
          hasPanorama: true,
          hasSplat: false
        }
      ])
    );

    const failed = failWorldLabsBrowser(loaded, "Network timeout");

    expect(failed.worlds).toEqual(loaded.worlds);
    expect(failed.errorMessage).toBe("Network timeout");
    expect(failed.isLoading).toBe(false);
  });
});
