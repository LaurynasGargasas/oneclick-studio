// Character Creator — option schema + deterministic prompt assembler.
//
// Prompt-engineering notes (learned the hard way):
//
// 1) Diffusion models (Soul 2.0 included) attend more strongly to tokens
//    near the START of the prompt.  We therefore put CLOTHING right after
//    the subject — not buried in the middle — so it doesn't get ignored.
//
// 2) "Bulky muscular build" type tokens pull hard toward shirtless / gym
//    training-data imagery.  We always inject a "fully clothed" affirmation
//    even when no specific garment is chosen, to neutralise that bias.
//
// 3) Vague garments ("lab coat", "chef outfit") leave the model freedom to
//    misinterpret. We use specific descriptors ("buttoned white lab coat
//    over clothes", "chef's white double-breasted jacket") so the actual
//    garment renders correctly.
//
// 4) Style suffix is anti-"studio" — we want documentary / smartphone
//    aesthetic for UGC, with explicit "natural skin texture" to prevent
//    over-smoothed retouched look the model would otherwise default to.
//
// Final assembly order:
//
//   <age> <ethnicity> <gender>,
//   fully clothed [wearing <clothes>],
//   <profession context>,
//   <environment>,
//   <body build>,
//   <hair>,
//   <face details>,
//   <organic style suffix>

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
  allowOther?: boolean;
  otherTemplate?: (text: string) => string;
}

export interface MultiSelectGroup {
  kind: "multi";
  group: string;
  label: string;
  options: OptionDef[];
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
    otherTemplate: (t) => `with a ${t.trim()} build`,
    options: [
      // Phrased so it sits naturally AFTER clothing without implying nudity.
      { id: "slim", label: "Slim", phrase: "with a lean slim build" },
      { id: "athletic", label: "Athletic", phrase: "with an athletic build" },
      { id: "bulky", label: "Bulky", phrase: "with a broad, heavily-built frame" },
      { id: "fat", label: "Fat", phrase: "with a stocky heavyset build" },
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
      { id: "laidback", label: "Laid Back", phrase: "casually messy hair" },
      { id: "bald", label: "Bald", phrase: "bald" },
      { id: "buzz", label: "Buzz Cut", phrase: "very short buzz cut" },
      { id: "curly", label: "Curly", phrase: "curly hair" },
      { id: "wavy", label: "Wavy", phrase: "wavy hair" },
      { id: "straight", label: "Straight", phrase: "straight hair" },
      { id: "ponytail", label: "Ponytail", phrase: "hair tied back in a ponytail" },
      { id: "bun", label: "Bun", phrase: "hair tied up in a bun" },
      { id: "braids", label: "Braids", phrase: "braided hair" },
      { id: "afro", label: "Afro", phrase: "afro hair" },
    ],
  },
  {
    kind: "multi",
    group: "accessories",
    label: "Accessories",
    allowOther: true,
    options: [
      { id: "glasses", label: "Glasses", phrase: "wearing prescription glasses" },
      { id: "sunglasses", label: "Sunglasses", phrase: "wearing dark sunglasses" },
      { id: "freckles", label: "Freckles", phrase: "with freckles across the nose and cheeks" },
      { id: "chefhat", label: "Chef Hat", phrase: "wearing a tall white chef's toque" },
      { id: "hat", label: "Hat", phrase: "wearing a hat" },
    ],
  },
  {
    kind: "single",
    group: "facialHair",
    label: "Facial Hair",
    options: [
      { id: "clean", label: "Clean Shaved", phrase: "clean shaven face" },
      { id: "stubble", label: "Stubble", phrase: "with light stubble" },
      { id: "beard", label: "Beard", phrase: "with a full beard" },
      { id: "mustache", label: "Mustache", phrase: "with a thick mustache" },
    ],
  },
  {
    kind: "single",
    group: "clothes",
    label: "Clothes",
    allowOther: true,
    // Strong directive — model should render the actual garment, not invent one.
    otherTemplate: (t) => `wearing ${t.trim()}`,
    options: [
      {
        id: "chef",
        label: "Chef Outfit",
        phrase: "wearing a chef's white double-breasted jacket and apron",
      },
      {
        id: "labcoat",
        label: "Lab Coat",
        phrase: "wearing a buttoned white lab coat over a shirt",
      },
      {
        id: "casual",
        label: "Casual",
        phrase: "wearing an everyday casual t-shirt and jeans",
      },
    ],
  },
  {
    kind: "single",
    group: "profession",
    label: "Profession",
    allowOther: true,
    otherTemplate: (t) => `${t.trim()} at work`,
    options: [
      { id: "chef", label: "Chef", phrase: "a chef at work" },
      { id: "doctor", label: "Doctor", phrase: "a doctor at work" },
      { id: "ugc", label: "UGC", phrase: "a content creator filming a casual UGC video" },
    ],
  },
  {
    kind: "single",
    group: "environment",
    label: "Environment",
    allowOther: true,
    otherTemplate: (t) => `in ${t.trim()}`,
    options: [
      { id: "office", label: "Office", phrase: "in a modern open-plan office" },
      {
        id: "prokitchen",
        label: "Professional Kitchen",
        phrase:
          "in a busy professional restaurant kitchen with stainless steel surfaces",
      },
      {
        id: "homekitchen",
        label: "Home Kitchen",
        phrase: "in a typical home kitchen with countertops and cabinets",
      },
      { id: "home", label: "Home", phrase: "at home in a casual living room" },
      {
        id: "prostudio",
        label: "Professional Studio",
        phrase: "in a professional photo studio with backdrop and softbox lighting",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Selection state shape
// ---------------------------------------------------------------------------

export interface CharacterSelections {
  gender?: string;
  ethnicity?: string;
  bodyType?: string;
  hairColor?: string;
  hairStyle?: string;
  facialHair?: string;
  clothes?: string;
  profession?: string;
  environment?: string;

  accessories: string[];

  ethnicityOther?: string;
  bodyTypeOther?: string;
  hairColorOther?: string;
  hairStyleOther?: string;
  clothesOther?: string;
  professionOther?: string;
  environmentOther?: string;
  accessoriesOther?: string;

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

  // 1. Subject — first clause, always present if anything is selected.
  const subjectBits: string[] = [];
  if (typeof s.age === "number") subjectBits.push(`${s.age}-year-old`);
  const eth = resolveSingle("ethnicity", s.ethnicity, s.ethnicityOther);
  if (eth) subjectBits.push(eth);
  const gen = findOption("gender", s.gender);
  if (gen) subjectBits.push(gen.phrase);
  const subject = subjectBits.join(" ");
  if (subject) parts.push(subject);

  // 2. Clothing — LEAD position so the model attends to it strongly.
  //    Always emit "fully clothed" even when nothing specific is picked,
  //    to neutralise body-type biases that pull toward shirtless imagery.
  const clothesPhrase = resolveSingle("clothes", s.clothes, s.clothesOther);
  if (clothesPhrase) {
    parts.push(`fully clothed, ${clothesPhrase}`);
  } else {
    parts.push("fully clothed in everyday clothing");
  }

  // 3. Profession context (action / role)
  const prof = resolveSingle("profession", s.profession, s.professionOther);
  if (prof) parts.push(prof);

  // 4. Environment / setting
  const env = resolveSingle("environment", s.environment, s.environmentOther);
  if (env) parts.push(env);

  // 5. Body — placed AFTER clothing so it reads as physique under the outfit
  //    rather than a standalone subject (which can imply nudity).
  const body = resolveSingle("bodyType", s.bodyType, s.bodyTypeOther);
  if (body) parts.push(body);

  // 6. Hair: "<color> <style>" — bald overrides color
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

  // 7. Face features (accessories + facial hair)
  const faceBits: string[] = [];
  for (const a of s.accessories) {
    const opt = findOption("accessories", a);
    if (opt) faceBits.push(opt.phrase);
  }
  if (s.accessoriesOther && s.accessoriesOther.trim()) {
    faceBits.push(`also wearing ${s.accessoriesOther.trim()}`);
  }
  const fh = findOption("facialHair", s.facialHair);
  if (fh) faceBits.push(fh.phrase);
  if (faceBits.length > 0) parts.push(faceBits.join(", "));

  // 8. Style suffix — explicitly anti-studio, anti-retouched, with concrete
  //    cues that push the model toward documentary smartphone aesthetic.
  //    "natural skin texture and pores" prevents the over-smoothed beauty-
  //    filter look the model defaults to without it.
  const styleSuffix =
    "candid unposed everyday photo, natural ambient indoor lighting, " +
    "natural skin texture and pores, unfiltered and unedited, no retouching, " +
    "no professional makeup, ordinary documentary moment, slight everyday " +
    "imperfections, casual smartphone snapshot aesthetic, looks exactly like " +
    "a real photograph, authentic and grounded, vlog-style realism";

  if (parts.length === 0) return styleSuffix;
  return `${parts.join(", ")}, ${styleSuffix}`;
}

/** Whether the user has picked enough to make a meaningful generation. */
export function hasMinimumSelection(s: CharacterSelections): boolean {
  return Boolean(s.gender);
}
