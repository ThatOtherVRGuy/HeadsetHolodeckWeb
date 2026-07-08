import { describe, expect, it, vi } from "vitest";

vi.mock("@iwsdk/core", () => ({
  createSystem: () =>
    class {
      cleanupFuncs: Array<() => void> = [];
      queries = {};
    },
  PanelUI: {},
  PanelDocument: { data: { document: {} } },
  eq: () => true,
  UIKit: {}
}));

describe("hasSplatSource", () => {
  it("detects remote SPZ URLs when no local splat cache is present", async () => {
    const { hasSplatSource } = await importPanel();

    expect(
      hasSplatSource({
        spzUrls: {
          full_res: "https://remote.test/world/full_res.spz"
        }
      })
    ).toBe(true);
  });

  it("ignores empty remote SPZ URL values", async () => {
    const { hasSplatSource } = await importPanel();

    expect(
      hasSplatSource({
        spzUrls: {
          full_res: "  "
        }
      })
    ).toBe(false);
  });
});

describe("WorldLabs browser panel helpers", () => {
  it("treats WorldLabs summaries with pano or splat assets as loadable", async () => {
    const { isWorldLabsSummaryLoadable } = await importPanel();

    expect(
      isWorldLabsSummaryLoadable({
        hasPanorama: true,
        hasSplat: false
      })
    ).toBe(true);
    expect(
      isWorldLabsSummaryLoadable({
        hasPanorama: false,
        hasSplat: true
      })
    ).toBe(true);
    expect(
      isWorldLabsSummaryLoadable({
        hasPanorama: false,
        hasSplat: false
      })
    ).toBe(false);
  });

  it("filters hidden deleted ids from browser world pages", async () => {
    const { filterHiddenWorldLabsWorlds } = await importPanel();

    expect(
      filterHiddenWorldLabsWorlds(
        {
          worlds: [
            {
              worldId: "world-123",
              displayName: "Park"
            },
            {
              worldId: "world-456",
              displayName: "Circus"
            }
          ],
          pageSize: 20
        },
        ["world-123"]
      ).worlds
    ).toEqual([
      {
        worldId: "world-456",
        displayName: "Circus"
      }
    ]);
  });
});

async function importPanel(): Promise<typeof import("./panel.js")> {
  return import("./panel.js");
}
