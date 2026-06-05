import { describe, expect, it } from "vitest";
import { buildScenarioInstructions, getScenario, scenarios } from "@/lib/scenarios";

describe("scenario engine", () => {
  it("provides the required MVP scenarios", () => {
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "interview",
      "restaurant",
      "meeting",
    ]);
  });

  it("builds realtime instructions with post-session correction timing", () => {
    const scenario = getScenario("meeting");
    const instructions = buildScenarioInstructions(scenario, "advanced");

    expect(instructions).toContain("Team Meeting");
    expect(instructions).toContain("save corrections for the post-session report");
    expect(instructions).toContain(scenario.openingLine);
  });
});
