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

async function importPanel(): Promise<typeof import("./panel.js")> {
  return import("./panel.js");
}
