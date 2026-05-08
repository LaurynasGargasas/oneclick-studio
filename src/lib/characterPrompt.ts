// Character Creator — option schema + deterministic prompt assembler.
//
// Each selection contributes a phrase to a fixed slot in the prompt.  Slots
// are concatenated in a defined order that reads naturally:
//
//   "<age> <ethnicity> <gender>, <body>, <hair color> <hair style>,
//    <accessories + facial hair>, <clothes>, professional <profession> portrait,
//    photorealistic, neutral background, studio lighting, head and shoulders"
//
// "Other" values for clothes/profession carry free-text overrides.

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
  /** Phrase template when "other" is picked: `${0}` is replaced with user text. */
  otherTemplate?: (text: string) => string;
}

export interface MultiSelectGroup {
  kind: "multi";
  group: string;
  label: string;
  options: OptionDef[];
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
    options: [
      { id: "short", label: "Short", phrase: "short hair" },
      { id: "long", label: "Long", phrase: "long hair" },
      { id: "professional", label: "Professional", phrase: "neat professional haircut" },
      { id: "laidback", label: "Laid Back", phrase: "casually styled hair" },
      { id: "bald", label: "Bald", phrase: "bald" },
    ],
  },
  {
    kind: "multi",
    group: "accessories",
    label: "Accessories",
    options: [
      { id: "glasses", label: "Glasses", phrase: "wearing glasses" },
      { id: "freckles", label: "Freckles", phrase: "with freckles" },
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
    otherTemplate: (t) => `professional ${t.trim()} portrait`,
    options: [
      { id: "chef", label: "Chef", phrase: "professional chef portrait" },
      { id: "doctor", label: "Doctor", phrase: "professional doctor portrait" },
      { id: "ugc", label: "UGC", phrase: "UGC creator selfie portrait" },
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

  // multi-select groups: groupId → array of optionIds
  accessories: string[];

  // free-text "other" inputs
  clothesOther?: string;
  professionOther?: string;

  // age slider — undefined = "no age specified"
  age?: number;
}

export const EMPTY_SELECTIONS: CharacterSelections = {
  accessories: [],
};

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function findOption(group: string, id?: string): OptionDef | undefined {
  if (!id) return undefined;
  const g = GROUPS.find((x) => x.group === group);
  return g?.options.find((o) => o.id === id);
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
  const eth = findOption("ethnicity", s.ethnicity);
  if (eth) subjectBits.push(eth.phrase);
  const gen = findOption("gender", s.gender);
  if (gen) subjectBits.push(gen.phrase);
  if (subjectBits.length > 0) parts.push(subjectBits.join(" "));

  // Body
  const body = findOption("bodyType", s.bodyType);
  if (body) parts.push(body.phrase);

  // Hair clause: "<color> <style>"  e.g. "blonde short hair", "blonde bald"
  // Bald overrides color so we don't say "blonde bald".
  if (s.hairStyle === "bald") {
    parts.push("bald");
  } else {
    const hairBits: string[] = [];
    const hc = findOption("hairColor", s.hairColor);
    const hs = findOption("hairStyle", s.hairStyle);
    if (hc) hairBits.push(hc.phrase);
    if (hs) hairBits.push(hs.phrase);
    if (hairBits.length > 0) parts.push(hairBits.join(" "));
  }

  // Face features (accessories + facial hair)
  const faceBits: string[] = [];
  for (const a of s.accessories) {
    const opt = findOption("accessories", a);
    if (opt) faceBits.push(opt.phrase);
  }
  const fh = findOption("facialHair", s.facialHair);
  if (fh) faceBits.push(fh.phrase);
  if (faceBits.length > 0) parts.push(faceBits.join(", "));

  // Clothes
  if (s.clothes === "other" && s.clothesOther && s.clothesOther.trim()) {
    parts.push(`wearing ${s.clothesOther.trim()}`);
  } else {
    const c = findOption("clothes", s.clothes);
    if (c) parts.push(c.phrase);
  }

  // Profession
  if (s.profession === "other" && s.professionOther && s.professionOther.trim()) {
    parts.push(`professional ${s.professionOther.trim()} portrait`);
  } else {
    const p = findOption("profession", s.profession);
    if (p) parts.push(p.phrase);
  }

  // Style suffix — always added so output is consistent for character work.
  const styleSuffix =
    "photorealistic, head and shoulders studio portrait, neutral background, soft studio lighting, sharp focus, high detail";

  if (parts.length === 0) return styleSuffix;
  return `${parts.join(", ")}, ${styleSuffix}`;
}

/** Whether the user has picked enough to make a meaningful generation. */
export function hasMinimumSelection(s: CharacterSelections): boolean {
  // Need at least gender — otherwise prompt is generic and unhelpful.
  return Boolean(s.gender);
}
