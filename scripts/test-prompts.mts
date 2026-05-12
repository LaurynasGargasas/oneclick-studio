// Smoke-test the Soul V2-tuned prompt builder.  Run with:
//   node --experimental-strip-types scripts/test-prompts.mts
// (Node 22+ — strips TS types at load time, no compile step needed.)
//
// Verifies:
//   - Common selection patterns produce grammatical prompts
//   - Output stays ≤75 words (Soul V2's documented optimum)
//   - The hair-color-without-style bug stays fixed
//   - Anti-patterns (8k/hyperrealistic/etc.) absent
//   - Required photoreal phrases ("visible pores", "no retouching") present

import {
  buildPrompt,
  EMPTY_SELECTIONS,
  type CharacterSelections,
} from "../src/lib/characterPrompt.ts";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}${detail ? "  — " + detail : ""}`);
  }
}

const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;

interface TestCase {
  name: string;
  sel: CharacterSelections;
}

const cases: TestCase[] = [
  {
    name: "Hero shot — chef holding cast iron",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "female",
      ethnicity: "white",
      age: 32,
      bodyType: "athletic",
      hairColor: "brown",
      hairStyle: "bun",
      clothes: "chef",
      profession: "chef",
      environment: "homekitchen",
      props: ["cast-iron-skillet"],
      pose: "cooking-action",
      imageStyle: "editorial",
    },
  },
  {
    name: "iPhone selfie — casual",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "male",
      ethnicity: "japanese",
      age: 28,
      hairStyle: "short",
      clothes: "casual",
      profession: "ugc",
      environment: "home",
      pose: "look-camera",
      imageStyle: "iphone",
    },
  },
  {
    name: "Hair color but NO style (the v0.1.7 bug)",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "female",
      hairColor: "blonde",
    },
  },
  {
    name: "Bald overrides color",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "male",
      hairColor: "brown",
      hairStyle: "bald",
    },
  },
  {
    name: "Multi-prop join (avoids holding/holding double-verb)",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "female",
      props: ["cast-iron-skillet", "chef-knife", "whisk"],
    },
  },
  {
    name: "Minimum viable — just gender",
    sel: { ...EMPTY_SELECTIONS, gender: "female" },
  },
  {
    name: "Disposable Flash gritty UGC",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "male",
      age: 40,
      bodyType: "bulky",
      hairColor: "black",
      hairStyle: "short",
      facialHair: "beard",
      clothes: "casual",
      pose: "thumbs-up",
      imageStyle: "disposable",
    },
  },
  {
    name: "Professional headshot",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "female",
      ethnicity: "mexican",
      age: 35,
      hairColor: "black",
      hairStyle: "professional",
      accessories: ["glasses"],
      clothes: "labcoat",
      profession: "doctor",
      environment: "prostudio",
      imageStyle: "professional",
    },
  },
  {
    name: "Heavy: every group filled",
    sel: {
      gender: "female",
      ethnicity: "white",
      age: 30,
      bodyType: "slim",
      hairColor: "blonde",
      hairStyle: "long",
      facialHair: "clean",
      clothes: "chef",
      profession: "chef",
      environment: "prokitchen",
      pose: "cooking-action",
      imageStyle: "editorial",
      accessories: ["freckles"],
      props: ["cast-iron-skillet"],
    },
  },
];

const FORBIDDEN: string[] = [
  "8k",
  "hyperrealistic",
  "masterpiece",
  "ultra-detailed",
  "ultra detailed",
  "professional photography",
  "looks exactly like a real photograph",
  "vlog-style realism",
  "candid unposed",
  "documentary moment",
  "flawless",
];

const REQUIRED: string[] = ["no visible makeup", "visible pores", "no retouching"];

for (const c of cases) {
  const prompt = buildPrompt(c.sel);
  const words = wc(prompt);
  console.log(`\n── ${c.name}  (${words} words) ──`);
  console.log("   ", prompt);

  check(`${c.name}: not empty`, prompt.trim().length > 0);
  check(`${c.name}: ≤ 75 words`, words <= 75, `got ${words}`);

  for (const bad of FORBIDDEN) {
    check(
      `${c.name}: no "${bad}"`,
      !prompt.toLowerCase().includes(bad.toLowerCase()),
    );
  }
  for (const must of REQUIRED) {
    check(
      `${c.name}: contains "${must}"`,
      prompt.toLowerCase().includes(must.toLowerCase()),
    );
  }

  if (c.sel.hairColor && !c.sel.hairStyle) {
    const colorMap: Record<string, string> = {
      blonde: "blonde",
      brown: "dark brown",
      black: "black",
      gray: "gray",
      ginger: "ginger",
    };
    const colorPhrase = colorMap[c.sel.hairColor] ?? c.sel.hairColor;
    check(
      `${c.name}: color-only emits "<color> hair"`,
      prompt.includes(`${colorPhrase} hair`),
      `expected "${colorPhrase} hair"`,
    );
  }

  if ((c.sel.props ?? []).length >= 2) {
    check(
      `${c.name}: multi-prop uses "also" for second prop`,
      /\balso\b/.test(prompt),
    );
  }
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
