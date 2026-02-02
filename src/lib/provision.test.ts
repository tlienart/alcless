import { expect, test, describe } from "bun:test";
import { DEFAULT_TOOLS } from "./provision.ts";

describe("Provisioning logic", () => {
  test("DEFAULT_TOOLS should contain required tools", () => {
    expect(DEFAULT_TOOLS).toContain('git');
    expect(DEFAULT_TOOLS).toContain('gh');
    expect(DEFAULT_TOOLS).toContain('python@3.12');
    expect(DEFAULT_TOOLS).toContain('uv');
  });
});
