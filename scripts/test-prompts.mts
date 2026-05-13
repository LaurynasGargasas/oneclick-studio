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
    name: "Hero shot — pro camera, free-text prop",
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
      propsOther: "a cast iron skillet",
      pose: "cooking-action",
      imageStyle: "pro-camera",
    },
  },
  {
    name: "iPhone selfie",
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
      imageStyle: "iphone-selfie",
    },
  },
  {
    name: "iPhone 17 Pro (default style)",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "female",
      age: 28,
      bodyType: "athletic",
      hairColor: "blonde",
      hairStyle: "long",
      imageStyle: "iphone-pro",
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
    name: "Minimum viable — just gender",
    sel: { ...EMPTY_SELECTIONS, gender: "female" },
  },
  {
    name: "Extremely muscular body type",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "male",
      age: 30,
      bodyType: "muscular",
      hairStyle: "buzz",
      clothes: "casual",
      imageStyle: "pro-camera",
    },
  },
  {
    name: "Facial hair Other (free text)",
    sel: {
      ...EMPTY_SELECTIONS,
      gender: "male",
      facialHair: "other",
      facialHairOther: "a neatly trimmed goatee",
    } as CharacterSelections,
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
      pose: "testimonial",
      imageStyle: "pro-camera",
      accessories: ["freckles"],
      props: [],
      propsOther: "a cast iron skillet",
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

const REQUIRED: string[] = [
  // Photoreal lever (skin clause).
  "visible pores",
  // v0.1.12 — positive-only closer phrases.  We REMOVED v0.1.11's
  // negative directives ("no makeup or retouching", "no Instagram UI",
  // etc.) because they trigger the very things they negate in diffusion
  // models (the "don't think of an elephant" problem).  Positive
  // descriptors describe what we WANT.
  "standalone photograph",
  "plain unmarked garments",
  "natural undisturbed skin",
  // Shirtless guard from v0.1.11 — body-type adjectives (athletic,
  // muscular, bulky) reliably pull toward shirtless gym imagery
  // without it.  Positive directive, safe to keep.
  "fully clothed",
];

// Words that previously appeared in our negative directives but should
// now be ABSENT from the prompt entirely.  Mentioning them at all —
// even with "no" in front — primes Soul V2 to generate them.
const MUST_NOT_APPEAR: string[] = [
  "Instagram",
  "TikTok",
  "screenshot",     // "not a screenshot" included this token — drop
  "brand logos",    // triggers logo generation
  "no text",        // triggers text generation
];

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
  for (const tabu of MUST_NOT_APPEAR) {
    check(
      `${c.name}: does NOT contain "${tabu}"`,
      !prompt.toLowerCase().includes(tabu.toLowerCase()),
      "trigger word leaked into the prompt",
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

  // Free-text prop check — when propsOther is set, prompt must include
  // it wrapped with "holding" so Soul V2 puts it in-hand.
  if (c.sel.propsOther && c.sel.propsOther.trim()) {
    check(
      `${c.name}: propsOther emits "holding <text>"`,
      prompt.toLowerCase().includes(`holding ${c.sel.propsOther.toLowerCase()}`),
    );
  }

  // Extremely-muscular body type should land as an inline adjective.
  if (c.sel.bodyType === "muscular") {
    check(
      `${c.name}: muscular body emits "extremely muscular"`,
      prompt.toLowerCase().includes("extremely muscular"),
    );
  }
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
