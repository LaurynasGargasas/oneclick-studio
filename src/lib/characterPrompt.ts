// Character Creator — option schema + deterministic prompt assembler.
//
// Each selection contributes a phrase to a fixed slot in the prompt.  Slots
// are concatenated in a defined order that reads naturally:
//
//   "<age> <ethnicity> <gender>, <body>, <hair color> <hair style>,
//    <accessories + facial hair>, wearing <clothes>, <profession context>,
//    in <environment>, <organic style suffix>"
//
// The style suffix is intentionally anti-"studio" so output looks like a
// real candid photo rather than a retouched commercial portrait.

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export type OptionId = string;

export interface OptionDef {
  id: OptionId;
  label: string;
  /** What gets inserted into the prompt when selected. */
  phrase: string;
}

export interface SingleSelectGroup {
  kind: "single";
  group: string;
  label: string;
  options: OptionDef[];
  /** If true, an extra "Other…" chip is rendered with a free-text input. */
  allowOther?: boolean;
  /** Phrase template when "other" is picked: receives raw user text. */
  otherTemplate?: (text: string) => string;
}

export interface MultiSelectGroup {
  kind: "multi";
  group: string;
  label: string;
  options: OptionDef[];
  /** If true, an "Other accessories…" free-text field appears below chips. */
  allowOther?: boolean;
}

export type OptionGroup = SingleSelectGroup | MultiSelectGroup;

// ---------------------------------------------------------------------------
// The schema
// ---------------------------------------------------------------------------

export const GROUPS: OptionGroup[] = [
  {
    kind: "single",
    group: "gender",
    label: "Gender",
    options: [
      { id: "male", label: "Male", phrase: "male" },
      { id: "female", label: "Female", phrase: "female" },
    ],
  },
  {
    kind: "single",
    group: "ethnicity",
    label: "Ethnicity",
    allowOther: true,
    otherTemplate: (t) => t.trim(),
    options: [
      { id: "black", label: "Black", phrase: "Black" },
      { id: "white", label: "White", phrase: "white" },
      { id: "japanese", label: "Japanese", phrase: "Japanese" },
      { id: "mexican", label: "Mexican", phrase: "Mexican" },
    ],
  },
  {
    kind: "single",
    group: "bodyType",
    label: "Body Type",
    allowOther: true,
    otherTemplate: (t) => `${t.trim()} build`,
    options: [
      { id: "slim", label: "Slim", phrase: "slim build" },
      { id: "athletic", label: "Athletic", phrase: "athletic build" },
      { id: "bulky", label: "Bulky", phrase: "bulky muscular build" },
      { id: "fat", label: "Fat", phrase: "heavyset build" },
    ],
  },
  {
    kind: "single",
    group: "hairColor",
    label: "Hair Color",
    allowOther: true,
    otherTemplate: (t) => t.trim(),
    options: [
      { id: "blonde", label: "Blonde", phrase: "blonde" },
      { id: "brown", label: "Brown", phrase: "brown" },
      { id: "gray", label: "Gray", phrase: "gray" },
      { id: "black", label: "Black", phrase: "black" },
      { id: "ginger", label: "Ginger", phrase: "ginger" },
    ],
  },
  {
    kind: "single",
    group: "hairStyle",
    label: "Hair Style",
    allowOther: true,
    otherTemplate: (t) => t.trim(),
    options: [
      { id: "short", label: "Short", phrase: "short hair" },
      { id: "long", label: "Long", phrase: "long hair" },
      { id: "professional", label: "Professional", phrase: "neatly styled hair" },
      { id: "laidback", label: "Laid Back", phrase: "casually styled hair" },
      { id: "bald", label: "Bald", phrase: "bald" },
      { id: "buzz", label: "Buzz Cut", phrase: "buzz cut" },
      { id: "curly", label: "Curly", phrase: "curly hair" },
      { id: "wavy", label: "Wavy", phrase: "wavy hair" },
      { id: "straight", label: "Straight", phrase: "straight hair" },
      { id: "ponytail", label: "Ponytail", phrase: "hair tied in a ponytail" },
      { id: "bun", label: "Bun", phrase: "hair tied in a bun" },
      { id: "braids", label: "Braids", phrase: "braided hair" },
      { id: "afro", label: "Afro", phrase: "afro" },
    ],
  },
  {
    kind: "multi",
    group: "accessories",
    label: "Accessories",
    allowOther: true,
    options: [
      { id: "glasses", label: "Glasses", phrase: "wearing glasses" },
      { id: "sunglasses", label: "Sunglasses", phrase: "wearing sunglasses" },
      { id: "freckles", label: "Freckles", phrase: "with freckles" },
      { id: "chefhat", label: "Chef Hat", phrase: "wearing a chef hat" },
      { id: "hat", label: "Hat", phrase: "wearing a hat" },
    ],
  },
  {
    kind: "single",
    group: "facialHair",
    label: "Facial Hair",
    options: [
      { id: "clean", label: "Clean Shaved", phrase: "clean shaven" },
      { id: "stubble", label: "Stubble", phrase: "with light stubble" },
      { id: "beard", label: "Beard", phrase: "with a full beard" },
      { id: "mustache", label: "Mustache", phrase: "with a mustache" },
    ],
  },
  {
    kind: "single",
    group: "clothes",
    label: "Clothes",
    allowOther: true,
    otherTemplate: (t) => `wearing ${t.trim()}`,
    options: [
      { id: "chef", label: "Chef Outfit", phrase: "wearing a chef outfit" },
      { id: "labcoat", label: "Lab Coat", phrase: "wearing a lab coat" },
      { id: "casual", label: "Casual", phrase: "wearing casual clothes" },
    ],
  },
  {
    kind: "single",
    group: "profession",
    label: "Profession",
    allowOther: true,
    otherTemplate: (t) => `working as a ${t.trim()}`,
    options: [
      { id: "chef", label: "Chef", phrase: "working as a chef" },
      { id: "doctor", label: "Doctor", phrase: "working as a doctor" },
      { id: "ugc", label: "UGC", phrase: "filming UGC content" },
    ],
  },
  {
    kind: "single",
    group: "environment",
    label: "Environment",
    allowOther: true,
    otherTemplate: (t) => `in ${t.trim()}`,
    options: [
      { id: "office", label: "Office", phrase: "in a modern office" },
      { id: "prokitchen", label: "Professional Kitchen", phrase: "in a professional kitchen" },
      { id: "homekitchen", label: "Home Kitchen", phrase: "in a home kitchen" },
      { id: "home", label: "Home", phrase: "at home in a living room" },
      { id: "prostudio", label: "Professional Studio", phrase: "in a professional photo studio" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Selection state shape
// ---------------------------------------------------------------------------

export interface CharacterSelections {
  // single-select groups: groupId → optionId | "other"
  gender?: string;
  ethnicity?: string;
  bodyType?: string;
  hairColor?: string;
  hairStyle?: string;
  facialHair?: string;
  clothes?: string;
  profession?: string;
  environment?: string;

  // multi-select groups
  accessories: string[];

  // free-text "other" inputs
  ethnicityOther?: string;
  bodyTypeOther?: string;
  hairColorOther?: string;
  hairStyleOther?: string;
  clothesOther?: string;
  professionOther?: string;
  environmentOther?: string;
  accessoriesOther?: string;

  // age slider — undefined = "no age specified"
  age?: number;
}

export const EMPTY_SELECTIONS: CharacterSelections = {
  accessories: [],
};

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function findGroup(group: string): OptionGroup | undefined {
  return GROUPS.find((g) => g.group === group);
}

function findOption(group: string, id?: string): OptionDef | undefined {
  if (!id) return undefined;
  return findGroup(group)?.options.find((o) => o.id === id);
}

/**
 * Resolve a single-select field to its prompt phrase, handling "Other…".
 * Returns undefined when nothing is selected (or "other" with no text).
 */
function resolveSingle(
  group: string,
  value: string | undefined,
  otherText: string | undefined,
): string | undefined {
  if (!value) return undefined;
  if (value === "other") {
    const g = findGroup(group);
    const text = otherText?.trim();
    if (!text) return undefined;
    if (g && "otherTemplate" in g && g.otherTemplate) return g.otherTemplate(text);
    return text;
  }
  return findOption(group, value)?.phrase;
}

/**
 * Build the structured prompt from a selection state.  Empty selections are
 * skipped silently — the prompt only mentions what the user actually picked.
 */
export function buildPrompt(s: CharacterSelections): string {
  const parts: string[] = [];

  // Subject clause: "<age>-year-old <ethnicity> <gender>"
  const subjectBits: string[] = [];
  if (typeof s.age === "number") subjectBits.push(`${s.age}-year-old`);
  const eth = resolveSingle("ethnicity", s.ethnicity, s.ethnicityOther);
  if (eth) subjectBits.push(eth);
  const gen = findOption("gender", s.gender);
  if (gen) subjectBits.push(gen.phrase);
  if (subjectBits.length > 0) parts.push(subjectBits.join(" "));

  // Body
  const body = resolveSingle("bodyType", s.bodyType, s.bodyTypeOther);
  if (body) parts.push(body);

  // Hair clause: "<color> <style>"  — bald overrides color
  if (s.hairStyle === "bald") {
    parts.push("bald");
  } else {
    const hairBits: string[] = [];
    const hc = resolveSingle("hairColor", s.hairColor, s.hairColorOther);
    const hs = resolveSingle("hairStyle", s.hairStyle, s.hairStyleOther);
    if (hc) hairBits.push(hc);
    if (hs) hairBits.push(hs);
    if (hairBits.length > 0) parts.push(hairBits.join(" "));
  }

  // Face features (accessories + facial hair)
  const faceBits: string[] = [];
  for (const a of s.accessories) {
    const opt = findOption("accessories", a);
    if (opt) faceBits.push(opt.phrase);
  }
  if (s.accessoriesOther && s.accessoriesOther.trim()) {
    faceBits.push(`wearing ${s.accessoriesOther.trim()}`);
  }
  const fh = findOption("facialHair", s.facialHair);
  if (fh) faceBits.push(fh.phrase);
  if (faceBits.length > 0) parts.push(faceBits.join(", "));

  // Clothes
  const clothes = resolveSingle("clothes", s.clothes, s.clothesOther);
  if (clothes) parts.push(clothes);

  // Profession
  const prof = resolveSingle("profession", s.profession, s.professionOther);
  if (prof) parts.push(prof);

  // Environment
  const env = resolveSingle("environment", s.environment, s.environmentOther);
  if (env) parts.push(env);

  // Style suffix — explicitly anti-"studio" / anti-"filtered" so the output
  // reads as a real candid photo rather than a retouched commercial portrait.
  const styleSuffix =
    "candid unposed photo, natural ambient light, unfiltered, no retouching, " +
    "no professional makeup, ordinary documentary moment, slight imperfections, " +
    "real and grounded, looks like a real photograph, organic and authentic";

  if (parts.length === 0) return styleSuffix;
  return `${parts.join(", ")}, ${styleSuffix}`;
}

/** Whether the user has picked enough to make a meaningful generation. */
export function hasMinimumSelection(s: CharacterSelections): boolean {
  return Boolean(s.gender);
}
