import { describe, expect, it } from "vitest";

import { AtpService } from "./atp.service.js";

describe("AtpService ship week heuristic", () => {
  it("exposes promise API shape via instance methods", () => {
    const service = new AtpService();
    expect(typeof service.promise).toBe("function");
    expect(typeof service.summary).toBe("function");
  });
});
