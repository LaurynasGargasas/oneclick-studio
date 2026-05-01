import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./tauri";

export interface ContentItem {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface ResolvedPrompt {
  /** Content array ready to pass to the Seedance API */
  content: ContentItem[];
  /** Tag names that were resolved (for DB linkage) */
  resolvedTags: string[];
  /** Tag names that appeared in the prompt but had no matching element */
  missingTags: string[];
}

/**
 * Resolve @tagname references in a prompt string.
 *
 * Each @tag becomes one or more image_url content items (one per element
 * image), capped at 9 total images (Seedance API limit).  The final text
 * prompt—with @mentions stripped—is appended as the last content item.
 *
 * @param rawPrompt  The user's raw prompt, e.g. "A @hero walks through @city"
 * @param elements   The current elements store items
 */
export async function resolvePrompt(
  rawPrompt: string,
  elements: Array<{
    tag: string;
    id: string;
    images: Array<{ file_path: string }>;
  }>,
): Promise<ResolvedPrompt> {
  const tagPattern = /@([\w-]+)/g;
  const tagMap = new Map(elements.map((e) => [e.tag.toLowerCase(), e]));

  const mentionedTags = [...rawPrompt.matchAll(tagPattern)].map((m) =>
    m[1].toLowerCase(),
  );
  const uniqueTags = [...new Set(mentionedTags)];

  const resolvedTags: string[] = [];
  const missingTags: string[] = [];
  const imageItems: ContentItem[] = [];

  for (const tag of uniqueTags) {
    const element = tagMap.get(tag);
    if (!element || element.images.length === 0) {
      missingTags.push(tag);
      continue;
    }
    resolvedTags.push(element.tag);
    for (const img of element.images) {
      if (imageItems.length >= 9) break;
      const dataUri = await loadImageAsDataUri(img.file_path);
      if (dataUri) {
        imageItems.push({ type: "image_url", image_url: { url: dataUri } });
      }
    }
    if (imageItems.length >= 9) break;
  }

  // Strip @tags from the text (keep the rest of the prompt)
  const cleanedText = rawPrompt.replace(/@[\w-]+/g, "").replace(/\s+/g, " ").trim();
  const textItem: ContentItem = { type: "text", text: cleanedText || rawPrompt };

  return {
    content: [...imageItems, textItem],
    resolvedTags,
    missingTags,
  };
}

async function loadImageAsDataUri(filePath: string): Promise<string | null> {
  if (!isTauri) return null;
  try {
    return await invoke<string>("read_image_as_data_uri", { path: filePath });
  } catch (e) {
    console.warn("Failed to read image for @tag:", filePath, e);
    return null;
  }
}
