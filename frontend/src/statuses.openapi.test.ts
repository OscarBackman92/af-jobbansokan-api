import { describe, expect, it } from "vitest";

import openapi from "../openapi.json";
import { ALL_STATUS_IDS } from "./statuses.js";

describe("statuses vs OpenAPI", () => {
  it("matches StatusEnum from openapi.json", () => {
    const enumValues = openapi.components.schemas.StatusEnum.enum as string[];
    expect([...ALL_STATUS_IDS].sort()).toEqual([...enumValues].sort());
  });
});
