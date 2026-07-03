import { describe, expect, test } from "vitest";
import {
  EMPTY_SKILL_GROUPS,
  flattenSkillGroups,
  groupsToText,
  normalizeSkillGroups,
  textToGroups,
} from "./skills.js";

describe("skills helpers", () => {
  test("textToGroups splits comma lists", () => {
    expect(
      textToGroups({
        technical: "Python, Django",
        domain: "Agile",
        languages: "Svenska, Engelska",
      })
    ).toEqual({
      technical: ["Python", "Django"],
      domain: ["Agile"],
      languages: ["Svenska", "Engelska"],
    });
  });

  test("flattenSkillGroups dedupes across categories", () => {
    const groups = textToGroups({
      technical: "Python",
      domain: "python",
      languages: "Svenska",
    });
    expect(flattenSkillGroups(groups)).toEqual(["Python", "Svenska"]);
  });

  test("normalizeSkillGroups ignores unknown keys", () => {
    expect(normalizeSkillGroups({ technical: ["Excel"], extra: ["X"] })).toEqual({
      ...EMPTY_SKILL_GROUPS,
      technical: ["Excel"],
    });
  });

  test("groupsToText joins lists", () => {
    expect(
      groupsToText({
        technical: ["Python"],
        domain: [],
        languages: ["Svenska"],
      })
    ).toEqual({
      technical: "Python",
      domain: "",
      languages: "Svenska",
    });
  });
});
