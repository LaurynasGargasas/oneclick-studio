// Character Creator — option schema + Soul V2-tuned prompt assembler.
//
// Rewrite history:
//   - v0.1.4: introduced clothing-first ordering + "fully clothed" guard
//             against bodyType phrases pulling toward shirtless imagery.
//   - v0.1.7: full rewrite for Higgsfield Soul V2.
//
// Soul V2 prompting principles (from Higgsfield blog + selfielab + Chase
// Jarvis tier guides; full sources captured in research notes):
//
// 1) **75-word cap.**  Overlong prompts dilute the Soul tag.  Our template
//    averages 50-80 words assembled; we cap individual option phrases
//    short to keep total under 75 typical.
//
// 2) **Order matters.**  Canonical Soul V2 clause order:
//    subject → hair → skin → face-details → wardrobe → prop → pose →
//    environment → lighting → medium → closer.  We follow this exactly.
//
// 3) **Camera-medium tokens are native.**  Soul V2 adjusts grain, color
//    science, dynamic range automatically when given a medium token like
//    "shot on iPhone, natural film grain" or "Kodak Portra 400."  The
//    old long DEFAULT_SUFFIX was working against this — replaced with
//    tight per-style {lighting, medium, closer} blocks (see STYLE_BLOCKS
//    below).
//
// 4) **High-signal photoreal phrases** (verbatim from Higgsfield/selfielab):
//      - skin:    "clear natural complexion, visible pores, no visible makeup"
//      - eyes:    "bright catchlights in both eyes" (folded into lighting)
//      - hands:   verb-anchored grip ("right hand gripping skillet handle")
//      - pose:    action verb-led ("leaning over counter, mid-stir")
//      - lighting: "soft window-side morning light", "phone flash slightly
//                   overexposed", "soft even studio lighting"
//      - closer:  "no retouching, no professional makeup, no signage"
//
// 5) **Anti-patterns we now AVOID**:
//      - "8k", "hyperrealistic", "masterpiece", "ultra-detailed" — dilutes
//      - "perfect"/"flawless" anything → triggers plastic AI skin
//      - "professional photography" → stock-photo polish, opposite of UGC
//      - long demographic chains ("Caucasian American Midwestern white woman")
//      - stacked meta-instructions ("vlog-style realism + documentary moment
//        + candid unposed" — pick ONE)
//      - "looks exactly like a real photograph" → meta-noise
//      - profession-uniform stacking ("chef coat + apron + toque")
//
// 6) **enhance_prompt: false** (set in character.rs).  Higgsfield's auto-
//    enhancer is known to hallucinate ("transports subjects to unexpected
//    locations") — keeping it off so our carefully-ordered tokens land
//    intact.

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
//
// Phrase conventions for Soul V2:
//   - bodyType:    inline adjective ("athletic build") — placed BEFORE
//                  the gender noun in subject_core so it reads naturally
//   - hairColor:   one word ("blonde") — paired with hairStyle below
//   - hairStyle:   contains the noun ("hair"/"cut"/"bald") so it can
//                  stand alone if the user only picks a style
//   - accessories: prop-style ones keep "wearing"; descriptor ones (freckles)
//                  start with "with" — the joiner reads naturally
//   - facialHair:  starts with "with" (joined like accessories)
//   - clothes:     bare noun phrase — buildPrompt prepends "wearing"
//   - profession:  bare noun — placed as attributive in subject_core
//   - environment: bare noun phrase — buildPrompt prepends "in"
//   - props:       verb-anchored ("holding", "gripping") to keep prop in-hand
//   - pose:        action verb-led
//   - imageStyle:  sentinel — actual lighting + medium + closer resolved
//                  via STYLE_BLOCKS below
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
    // Inline adjective: "athletic 30yo Italian woman".  Drops the v0.1.4
    // "with a ... build" suffix-style phrasing — Soul V2 prefers tighter
    // adjective stacks over verbose participial clauses.
    //
    // v0.1.12 bugfix: was `${t}-build` producing "tall-build" which
    // reads as a hyphenated compound, not an adjective.  Preset
    // options ("slim", "athletic", "broad heavyset") don't carry the
    // "-build" suffix either — Other should match.
    otherTemplate: (t) => t.trim(),
    options: [
      { id: "slim", label: "Slim", phrase: "slim" },
      { id: "athletic", label: "Athletic", phrase: "athletic" },
      { id: "muscular", label: "Extremely Muscular", phrase: "extremely muscular" },
      { id: "bulky", label: "Bulky", phrase: "broad heavyset" },
      { id: "fat", label: "Fat", phrase: "heavyset" },
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
      { id: "brown", label: "Brown", phrase: "dark brown" },
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
    // Behavior-led phrasing where the style supports it ("low messy bun
    // with loose face-framing pieces" reads way better on Soul V2 than
    // bare "bun").  Each option still contains the noun so it can stand
    // alone when no color is picked.
    options: [
      { id: "short", label: "Short", phrase: "short hair" },
      { id: "long", label: "Long", phrase: "long hair" },
      { id: "professional", label: "Professional", phrase: "neatly styled hair" },
      { id: "laidback", label: "Laid Back", phrase: "casually messy hair, slightly tousled" },
      { id: "bald", label: "Bald", phrase: "bald" },
      { id: "buzz", label: "Buzz Cut", phrase: "short buzz cut" },
      { id: "curly", label: "Curly", phrase: "curly hair with natural texture" },
      { id: "wavy", label: "Wavy", phrase: "loose wavy hair" },
      { id: "straight", label: "Straight", phrase: "straight hair" },
      { id: "ponytail", label: "Ponytail", phrase: "hair tied back in a low ponytail" },
      { id: "bun", label: "Bun", phrase: "low messy bun" },
      { id: "braids", label: "Braids", phrase: "braided hair" },
      { id: "afro", label: "Afro", phrase: "afro hair" },
    ],
  },
  {
    kind: "multi",
    group: "accessories",
    label: "Accessories",
    allowOther: true,
    // Mix of "wearing" (for items) and "with" (for descriptors) so the
    // joined sentence reads naturally.
    options: [
      { id: "glasses", label: "Glasses", phrase: "wearing prescription glasses" },
      { id: "sunglasses", label: "Sunglasses", phrase: "wearing dark sunglasses" },
      { id: "freckles", label: "Freckles", phrase: "with light freckles" },
      { id: "chefhat", label: "Chef Hat", phrase: "wearing a white chef's toque" },
      { id: "hat", label: "Hat", phrase: "wearing a cap" },
    ],
  },
  // Props — free-text only in v0.1.7.  The pre-baked cookware list was
  // too narrow for the wider character-creator use case; users now type
  // what the subject is holding via the "Other" field, and buildPrompt
  // wraps it with "holding " so Soul V2 puts it in-hand vs floating loose.
  {
    kind: "multi",
    group: "props",
    label: "Props",
    allowOther: true,
    options: [],
  },
  // Pose — natural-action verbs over "posing for camera" phrasing.
  {
    kind: "single",
    group: "pose",
    label: "Pose",
    allowOther: true,
    otherTemplate: (t) => t.trim(),
    options: [
      // testimonial-first ordering — testimonial is the most useful default
      // for landing-page hero shots (subject facing camera, explaining).
      { id: "testimonial", label: "Testimonial Pose",
        phrase: "facing camera mid-gesture, waist-up" },
      { id: "showcase-product", label: "Showcase to Camera",
        phrase: "presenting the product to the camera, slight three-quarter angle" },
      { id: "cooking-action", label: "Cooking Action",
        phrase: "leaning over counter mid-stir motion" },
      { id: "side-cooking", label: "Side Profile Cooking",
        phrase: "side profile, focused on the cooking, candid moment" },
      { id: "look-camera", label: "Looking at Camera",
        phrase: "soft eye contact with the camera, mid-laugh" },
      { id: "pointing", label: "Pointing at Product",
        phrase: "gesturing at the product with a relaxed smile" },
      { id: "reaction", label: "Reaction Shot",
        phrase: "surprised reaction, eyes wide, mid-laugh" },
    ],
  },
  {
    kind: "single",
    group: "facialHair",
    label: "Facial Hair",
    allowOther: true,
    // Custom facial hair — user supplies the phrase verbatim (e.g.
    // "with a goatee", "with a handlebar mustache").  Bare text is fine
    // for Soul V2; the face-details join handles the comma.
    otherTemplate: (t) => `with ${t.trim()}`,
    options: [
      // "None" replaces v0.1.6's "Clean Shaved" label — clearer that this
      // is the "no facial hair" pick.  Phrase still emits "clean-shaven"
      // so the prompt explicitly states the absence (Soul V2 needs the
      // explicit token; just omitting the clause is weaker).
      { id: "clean", label: "None", phrase: "clean-shaven" },
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
    // Material-led, shorter phrasing.  Avoid the v0.1.4 "chef coat + apron"
    // stacking trap that triggers AI-stock-photo template aesthetic.
    //
    // Free-text input gets wrapped — bare user input like "home chef"
    // pasted raw made Soul V2 render "Home Chef" as a literal brand
    // logo on an apron.  v0.1.11 tried "no brand logos, no text on
    // clothing" — failed because the words "brand"/"logo"/"text" in
    // the prompt triggered the very thing they were trying to negate
    // (don't-think-of-an-elephant problem).  v0.1.12 reframes to
    // positive-only: "plain unmarked" never mentions text/brand/logo.
    otherTemplate: (t) => `plain unmarked outfit inspired by ${t.trim()}`,
    options: [
      {
        id: "chef",
        label: "Chef Outfit",
        phrase: "white chef's jacket over a plain tee",
      },
      {
        id: "homecook",
        label: "Home Cook",
        // Distinct from the pro-kitchen "Chef Outfit" — casual apron-over-
        // tee for home-cooking content.  "Plain unmarked" replaces v0.1.11's
        // "no brand logos, no text on clothing" — positive framing avoids
        // priming Soul V2 to generate text-on-apron in the first place.
        phrase: "plain unmarked linen apron over a solid-color cotton tee",
      },
      {
        id: "labcoat",
        label: "Lab Coat",
        phrase: "buttoned white lab coat",
      },
      {
        id: "casual",
        label: "Casual",
        phrase: "soft cotton tee and faded jeans",
      },
    ],
  },
  {
    kind: "single",
    group: "profession",
    label: "Profession",
    allowOther: true,
    // Bare noun — buildPrompt inserts as attributive ("30yo Italian chef")
    // rather than tacking on "at work" which Soul V2 reads as a separate
    // (vague) directive.
    otherTemplate: (t) => t.trim(),
    options: [
      { id: "chef", label: "Chef", phrase: "chef" },
      { id: "doctor", label: "Doctor", phrase: "doctor" },
      { id: "ugc", label: "UGC", phrase: "content creator" },
    ],
  },
  {
    kind: "single",
    group: "environment",
    label: "Environment",
    allowOther: true,
    // Bare noun phrase — buildPrompt prepends "in".
    otherTemplate: (t) => t.trim(),
    options: [
      { id: "office", label: "Office", phrase: "a modern open-plan office" },
      {
        id: "prokitchen",
        label: "Professional Kitchen",
        phrase: "a busy restaurant kitchen, stainless surfaces",
      },
      {
        id: "homekitchen",
        label: "Home Kitchen",
        phrase: "a sunlit home kitchen",
      },
      { id: "home", label: "Home", phrase: "a casual home living room" },
      {
        id: "prostudio",
        label: "Professional Studio",
        phrase: "a clean photo studio with neutral backdrop",
      },
    ],
  },
  // Image Style is special: each option resolves to a {lighting, medium,
  // closer} triple at prompt-assembly time (see STYLE_BLOCKS below).
  // v0.1.7 redesign: three specific named-camera presets + Other.  Named
  // hardware tokens ("iPhone 17 Pro", "Canon EOS R5") land more
  // consistently on Soul V2 than generic terms ("smartphone",
  // "professional camera") — Higgsfield is camera-medium-aware natively.
  //
  // Legacy IDs (vlog/iphone/editorial/disposable/professional) from
  // pre-0.1.7 characters fall through to DEFAULT_STYLE_BLOCK at render
  // time — non-breaking but those characters lose their original style.
  {
    kind: "single",
    group: "imageStyle",
    label: "Image Style",
    allowOther: true,
    otherTemplate: (t) => t.trim(),
    options: [
      // Default — listed first.  Modern phone-camera aesthetic, 4K video
      // frame look, the cleanest "real person filmed on a phone" baseline.
      { id: "iphone-pro", label: "iPhone 17 Pro 4K Photo", phrase: "__style:iphone-pro" },
      // Pro camera with a SPECIFIC named body + lens — Soul V2 reads the
      // hardware token and adjusts grain/color science accordingly.
      { id: "pro-camera", label: "Professional Camera (Canon EOS R5)", phrase: "__style:pro-camera" },
      // Selfie framing — first-person POV, slight wide-angle distortion
      // characteristic of phone front cameras.
      { id: "iphone-selfie", label: "iPhone 17 Selfie", phrase: "__style:iphone-selfie" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Style blocks — {lighting, medium, closer} triple per Image Style option.
//
// Higgsfield's own guidance: prompt the *medium* (iPhone / disposable /
// film stock), not abstract "photoreal."  Soul V2 adjusts grain, color
// science, and dynamic range to match.  Each block emits exactly three
// short clauses appended at the tail end of the assembled prompt — no
// stacked meta-instructions.
// ---------------------------------------------------------------------------

interface StyleBlock {
  lighting: string;
  medium: string;
  /** Short negative directives — always present, replaces v0.1.4's noisy
   *  "candid unposed everyday photo + slight imperfections + vlog-style
   *  realism + looks exactly like a real photograph" stack. */
  closer: string;
}

// Closer — POSITIVE-ONLY framing.  Lessons-learned:
//
//   v0.1.7  "no subtitles" — kills hallucinated caption text.
//   v0.1.10 broadened to "no text overlays / no watermarks / no app
//     interface" after Soul V2 generated full Instagram story UI.
//   v0.1.11 added brand-specific negatives ("no Instagram", "no
//     TikTok") after v0.1.10 still failed in production.
//   v0.1.12 (this) Brand-specific negatives ALSO failed.  Diffusion
//     models have a "don't think of an elephant" problem — writing
//     "no Instagram UI" puts the Instagram token in the prompt, and
//     the model attends to it more than the "no".  Writing "no text
//     on clothing" similarly triggers text generation.  Switched to
//     positive-only framing: never mention the unwanted concept at
//     all, instead describe what we WANT.  "standalone photograph"
//     replaces "no Instagram"; "plain unmarked garments" replaces
//     "no brand logos or text"; "natural undisturbed skin" replaces
//     "no makeup or retouching".
// Closer (positive only).  "plain unmarked solid-color garments" is
// stronger than just "plain unmarked" — adds another descriptor of
// the SURFACE (solid-color = uniform, no print) without ever mentioning
// the unwanted concepts (text / brand / logo) that would prime the
// model.  See COMMON_NEGATIVE_PROMPT below for the separate-field
// negative guidance that complements this.
const COMMON_CLOSER =
  "standalone photograph, plain unmarked solid-color garments, smooth fabric surface, natural undisturbed skin, soft genuine expression";

/** Negative-prompt directive list — what we WANT THE MODEL TO AVOID.
 *  Sent as a separate `negative_prompt` field on Soul V2 requests
 *  (Higgsfield may or may not honor it; harmless either way).  Kept
 *  separate from the positive prompt so the unwanted tokens don't
 *  prime the model via the "don't think of elephant" effect.  When
 *  Higgsfield ignores it, the positive descriptors in COMMON_CLOSER
 *  carry the load.  When honored, this is the real negative-guidance
 *  signal. */
export const COMMON_NEGATIVE_PROMPT =
  "text on clothing, brand logos, watermarks, captions, usernames, profile pictures, Instagram UI, TikTok UI, Snapchat UI, story interface, app chrome, close button, makeup, retouching, plastic skin, hyperrealistic, ultra-detailed, 8k, masterpiece";

// The word "selfie" co-occurs heavily with social-media imagery in
// Soul V2's training data → easy to drift into "Instagram story
// screenshot" framing (UI chrome, gibberish captions, profile pic).
// "candid photograph" prefixes pull the output back toward a real
// photo and away from a screenshot.  Combined with the broader closer
// negatives above, this kills the Instagram-story drift seen in v0.1.9.
const STYLE_BLOCKS: Record<string, StyleBlock> = {
  // Default + first option.  Named hardware token ("iPhone 17 Pro")
  // gives Soul V2 a strong anchor — 4K mode + computational HDR look,
  // sharp focus on the subject with natural depth-of-field falloff.
  //
  // v0.1.12: Dropped "candid" (Instagram-coded in training data).
  // Lead with "third-person photograph" to immediately disambiguate
  // from the iPhone-selfie style and from Instagram-story framing.
  // The closer's "standalone photograph" reinforces this further.
  "iphone-pro": {
    lighting: "natural ambient lighting, true-to-life dynamic range",
    medium: "third-person photograph captured on iPhone 17 Pro in 4K mode, sharp focus, natural depth of field",
    closer: COMMON_CLOSER,
  },
  // Pro camera with specific body + lens.  Higgsfield's docs explicitly
  // call out named cameras/films as "responds intelligently" — Canon
  // EOS R5 + 50mm f/1.4 + Kodak Portra 400 is a known photoreal
  // sweet spot.  Trimmed of redundant adjectives ("portrait lens",
  // "color science", "shallow depth of field" — the f/1.4 token already
  // signals bokeh) to keep heavy prompts under the 75-word cap.
  "pro-camera": {
    lighting: "soft natural light, bright catchlights",
    medium: "shot on Canon EOS R5, 50mm f/1.4, Kodak Portra 400",
    closer: COMMON_CLOSER,
  },
  // Front-camera selfie — slight wide-angle distortion is the tell that
  // makes it read as a real phone selfie vs a posed portrait.  "candid
  // selfie photograph" lead disambiguates from Instagram story screenshot.
  "iphone-selfie": {
    lighting: "natural ambient lighting, even facial lighting",
    medium: "candid iPhone 17 front-camera selfie photograph, slight wide-angle distortion, natural grain",
    closer: COMMON_CLOSER,
  },
};

const DEFAULT_STYLE_BLOCK: StyleBlock = STYLE_BLOCKS["iphone-pro"];

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
  imageStyle?: string;
  pose?: string;

  accessories: string[];
  props: string[];

  ethnicityOther?: string;
  bodyTypeOther?: string;
  hairColorOther?: string;
  hairStyleOther?: string;
  // BUG FIX v0.1.13: facialHairOther was missing.  The schema had
  // `allowOther: true` and `otherTemplate` set on the facialHair group,
  // but the selection state had no slot to store the user's typed
  // value AND the OtherField type / GROUP_TO_OTHER_FIELD map in
  // CharacterCreator didn't include facialHair — so the OptionChips
  // "Other" input was a controlled component with no onChange wiring,
  // making it appear un-writable to the user.
  facialHairOther?: string;
  clothesOther?: string;
  professionOther?: string;
  environmentOther?: string;
  imageStyleOther?: string;
  poseOther?: string;
  accessoriesOther?: string;
  propsOther?: string;

  age?: number;
}

export const EMPTY_SELECTIONS: CharacterSelections = {
  accessories: [],
  props: [],
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

/** Join verb-anchored prop phrases without the redundant "holding X,
 *  holding Y" double-verb echo.  First prop keeps its full phrase; later
 *  props drop their leading verb if it matches the first one.  This
 *  produces "gripping skillet, also holding knife" instead of "gripping
 *  skillet, holding knife" — small but reads more like real description. */
function joinProps(phrases: string[]): string {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return phrases
    .map((p, i) => (i === 0 ? p : `also ${p}`))
    .join(", ");
}

function resolveStyleBlock(
  imageStyle: string | undefined,
  imageStyleOther: string | undefined,
): StyleBlock {
  if (!imageStyle) return DEFAULT_STYLE_BLOCK;
  if (imageStyle === "other") {
    const text = imageStyleOther?.trim();
    // "Other" is a free-text override: user types the whole tail-end
    // styling themselves.  We surface it as a single medium clause and
    // skip lighting + closer (the user took responsibility).
    return text && text.length > 0
      ? { lighting: "", medium: text, closer: "" }
      : DEFAULT_STYLE_BLOCK;
  }
  return STYLE_BLOCKS[imageStyle] ?? DEFAULT_STYLE_BLOCK;
}

/**
 * Build a Soul V2-tuned prompt from selections.  Follows the canonical
 * Higgsfield clause order: subject → hair → skin → face-details →
 * wardrobe → prop → pose → environment → lighting → medium → closer.
 *
 * Targets ≤75 words assembled (Soul V2's documented optimum).  Empty
 * selections are skipped — the prompt only mentions what the user picked.
 * The skin clause is always emitted; it's the highest-impact photoreal
 * lever and costs only 8 tokens.
 */
export function buildPrompt(s: CharacterSelections): string {
  const clauses: string[] = [];

  // ── 1. Subject core ──────────────────────────────────────────────────
  // Format: "<body> <age>-year-old <ethnicity> <profession|gender>, soft natural smile"
  //
  // Profession (if picked) replaces the bare gender noun as a more
  // specific attributive — "30yo Italian chef" tells Soul V2 more than
  // "30yo Italian woman".  Gender still lands implicitly via name/face
  // training.  Body adjective leads so it stacks naturally onto the
  // noun: "athletic 30yo Italian chef".
  //
  // We append a default expression ("soft natural smile") only when the
  // pose doesn't already encode one — the pose phrase is more specific
  // when present (e.g. "mid-laugh", "surprised reaction").
  const subjectBits: string[] = [];
  const body = resolveSingle("bodyType", s.bodyType, s.bodyTypeOther);
  if (body) subjectBits.push(body);
  if (typeof s.age === "number") subjectBits.push(`${s.age}-year-old`);
  const eth = resolveSingle("ethnicity", s.ethnicity, s.ethnicityOther);
  if (eth) subjectBits.push(eth);
  // BUG FIX: v0.1.7 → v0.1.11 had a misguided optimization that
  // REPLACED gender with profession when both were picked (rationale:
  // "athletic 30yo Italian chef" reads natural).  Result: Soul V2 had
  // to infer gender from the profession noun alone, and defaulted to
  // male regardless of what the user picked.  v0.1.12 always emits
  // both — "athletic 30yo Italian female chef" — gender lands
  // explicitly and the prompt still reads grammatically.
  const gen = findOption("gender", s.gender)?.phrase;
  if (gen) subjectBits.push(gen);
  const prof = resolveSingle("profession", s.profession, s.professionOther);
  if (prof) subjectBits.push(prof);
  let subjectCore = subjectBits.join(" ").trim();
  // Append a baseline expression unless pose carries one.  Cheap +
  // prevents the dead "looking forward into space" default.
  const pose = resolveSingle("pose", s.pose, s.poseOther);
  if (subjectCore && !pose) {
    subjectCore += ", soft natural smile";
  }
  if (subjectCore) clauses.push(subjectCore);

  // ── 2. Hair (color + style, both optional) ───────────────────────────
  if (s.hairStyle === "bald") {
    clauses.push("bald");
  } else {
    const hc = resolveSingle("hairColor", s.hairColor, s.hairColorOther);
    const hs = resolveSingle("hairStyle", s.hairStyle, s.hairStyleOther);
    if (hc && hs) clauses.push(`${hc} ${hs}`);
    else if (hc) clauses.push(`${hc} hair`);          // v0.1.7 bugfix
    else if (hs) clauses.push(hs);
  }

  // ── 3. Skin (always emit — Soul V2's #1 photoreal lever) ─────────────
  // Trimmed in v0.1.11: "no visible makeup" moved to the closer (which
  // now says "no makeup or retouching" globally), saving 3 words for
  // the heavier negatives (Instagram UI, brand logos).  Verbatim from
  // Higgsfield/selfielab guidance — single-handedly responsible for
  // avoiding the plastic-AI-skin look.
  clauses.push("natural complexion with visible pores");

  // ── 4. Face details (accessories + facial hair) ──────────────────────
  // Mixed "wearing"/"with" prefixes per option already; join with commas.
  const faceBits: string[] = [];
  for (const a of s.accessories) {
    const opt = findOption("accessories", a);
    if (opt) faceBits.push(opt.phrase);
  }
  if (s.accessoriesOther && s.accessoriesOther.trim()) {
    faceBits.push(`also ${s.accessoriesOther.trim()}`);
  }
  // v0.1.13: was `findOption(...)` which skipped the "other" branch.
  // resolveSingle honors `s.facialHair === "other"` by feeding the user's
  // typed value through the group's otherTemplate (`with ${t.trim()}`).
  const fh = resolveSingle("facialHair", s.facialHair, s.facialHairOther);
  if (fh) faceBits.push(fh);
  if (faceBits.length > 0) clauses.push(faceBits.join(", "));

  // ── 5. Wardrobe ──────────────────────────────────────────────────────
  // Always emit something AND always lead with "fully clothed".  The
  // body-type adjectives (athletic / muscular / bulky) co-occur with
  // gym/fitness imagery in Soul V2's training data and reliably pull
  // outputs toward shirtless even when a clothing clause exists.  The
  // v0.1.4 "fully clothed" prefix was the original guard against this
  // — got dropped in v0.1.7's rewrite, re-added in response to a
  // real-world failure (athletic male + clothing override → shirtless).
  const clothesPhrase = resolveSingle("clothes", s.clothes, s.clothesOther);
  if (clothesPhrase) {
    clauses.push(`fully clothed, wearing ${clothesPhrase}`);
  } else {
    clauses.push("fully clothed in everyday casual clothing");
  }

  // ── 6. Prop in-hand (verb-anchored) ──────────────────────────────────
  const propsBits: string[] = [];
  for (const p of s.props) {
    const opt = findOption("props", p);
    if (opt) propsBits.push(opt.phrase);
  }
  if (s.propsOther && s.propsOther.trim()) {
    propsBits.push(`holding ${s.propsOther.trim()}`);
  }
  const propsClause = joinProps(propsBits);
  if (propsClause) clauses.push(propsClause);

  // ── 7. Pose (action-verb-led) ────────────────────────────────────────
  if (pose) clauses.push(pose);

  // ── 8. Environment ───────────────────────────────────────────────────
  const env = resolveSingle("environment", s.environment, s.environmentOther);
  if (env) clauses.push(`in ${env}`);

  // ── 9–11. Lighting, medium, closer (from style block) ────────────────
  const sty = resolveStyleBlock(s.imageStyle, s.imageStyleOther);
  if (sty.lighting) clauses.push(sty.lighting);
  if (sty.medium) clauses.push(sty.medium);
  if (sty.closer) clauses.push(sty.closer);

  return clauses.join(", ");
}

/** Whether the user has picked enough to make a meaningful generation. */
export function hasMinimumSelection(s: CharacterSelections): boolean {
  return Boolean(s.gender);
}
