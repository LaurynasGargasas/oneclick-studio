import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "./tauri";

export interface ContentItem {
  type: "text" | "image_url" | "video_url";
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
  role?: string;
}

/** A directly-uploaded reference (image or video) attached to a generation. */
export interface DirectReference {
  id: string;
  type: "image" | "video";
  /** API role sent with this content item */
  role: "reference_image" | "reference_video" | "first_frame" | "last_frame";
  data_url: string;
  file_name: string;
}

export interface ApiCredentials {
  endpoint: string;
  api_key: string;
  /** Optional imgbb API key for public image hosting (bypasses BytePlus content moderation) */
  imgbb_api_key?: string;
}

// ---------------------------------------------------------------------------
// In-memory cache: filePath/dataUrl → public imgbb URL
// Avoids re-uploading the same image on every generation.
// ---------------------------------------------------------------------------
const imgbbCache = new Map<string, string>();

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
 * Tries to upload images to the BytePlus Files API first (URL reference),
 * falling back to base64 data URIs if the upload fails. URL references
 * bypass BytePlus's inline content moderation on base64 images.
 *
 * @param rawPrompt    The user's raw prompt
 * @param elements     The current elements store items
 * @param directRefs   Optional direct-upload references (images / video clips)
 * @param apiCreds     Optional API credentials for uploading images as URLs
 */
export async function resolvePrompt(
  rawPrompt: string,
  elements: Array<{
    tag: string;
    id: string;
    images: Array<{ file_path: string }>;
  }>,
  directRefs: DirectReference[] = [],
  apiCreds?: ApiCredentials,
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
      const url = await resolveImageUrl(img.file_path, apiCreds);
      if (url) {
        imageItems.push({ type: "image_url", image_url: { url }, role: "reference_image" });
      }
    }
    if (imageItems.length >= 9) break;
  }

  // Direct reference content items — prepended before element refs
  const directItems: ContentItem[] = await Promise.all(
    directRefs.map(async (ref) => {
      if (ref.type === "video") {
        // Try uploading video data URL, fall back to raw data URL
        const url = apiCreds
          ? await tryUploadDataUrl(ref.data_url, ref.file_name, apiCreds)
          : ref.data_url;
        return { type: "video_url" as const, video_url: { url }, role: ref.role };
      }
      // Image: try uploading, fall back to data URL
      const url = apiCreds
        ? await tryUploadDataUrl(ref.data_url, ref.file_name, apiCreds)
        : ref.data_url;
      return { type: "image_url" as const, image_url: { url }, role: ref.role };
    }),
  );

  // Strip @tags from the text (keep the rest of the prompt)
  const cleanedText = rawPrompt.replace(/@[\w-]+/g, "").replace(/\s+/g, " ").trim();
  const textItem: ContentItem = { type: "text", text: cleanedText || rawPrompt };

  return {
    content: [...directItems, ...imageItems, textItem],
    resolvedTags,
    missingTags,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get a public URL for a local image file, trying in order:
 *  1. BytePlus Files API (may return a CDN URL or CDN redirect)
 *  2. imgbb public hosting (if imgbb_api_key is configured)
 *  3. base64 data URI inline (last resort — may trigger BytePlus content moderation)
 */
async function resolveImageUrl(
  filePath: string,
  apiCreds?: ApiCredentials,
): Promise<string | null> {
  if (!isTauri) return null;

  // 1. BytePlus Files API upload
  if (apiCreds?.api_key) {
    try {
      const url = await invoke<string>("upload_local_image", {
        endpoint: apiCreds.endpoint,
        apiKey: apiCreds.api_key,
        filePath,
      });
      if (url) return url;
    } catch (e) {
      console.warn("BytePlus Files upload failed, trying imgbb:", e);
    }
  }

  // 2. imgbb public hosting
  if (apiCreds?.imgbb_api_key) {
    const cached = imgbbCache.get(filePath);
    if (cached) {
      return cached;
    }
    try {
      const dataUri = await loadImageAsDataUri(filePath);
      if (dataUri) {
        const url = await invoke<string>("upload_to_imgbb", {
          imgbbKey: apiCreds.imgbb_api_key,
          base64Image: dataUri,
        });
        if (url) {
          imgbbCache.set(filePath, url);
          return url;
        }
      }
    } catch (e) {
      console.warn("imgbb upload failed, falling back to base64:", e);
    }
  }

  // 3. Fallback: base64 data URI (content moderation may reject real people)
  return loadImageAsDataUri(filePath);
}

/**
 * Try to get a public URL for a base64 data URL (direct reference image/video).
 * Tries BytePlus Files API, then imgbb (images only), then returns the data URL.
 */
async function tryUploadDataUrl(
  dataUrl: string,
  filename: string,
  apiCreds: ApiCredentials,
): Promise<string> {
  if (!isTauri) return dataUrl;

  const isVideo = /\.(mp4|webm|mov|avi)$/i.test(filename);

  // 1. BytePlus Files API upload
  if (apiCreds.api_key) {
    try {
      const url = await invoke<string>("upload_data_url", {
        endpoint: apiCreds.endpoint,
        apiKey: apiCreds.api_key,
        dataUrl,
        filename,
      });
      if (url) return url;
    } catch (e) {
      console.warn("BytePlus Files upload failed:", e);
    }
  }

  // 2. imgbb for images (not videos — imgbb doesn't host video)
  if (!isVideo && apiCreds.imgbb_api_key) {
    const cached = imgbbCache.get(dataUrl.slice(0, 100)); // use prefix as cache key
    if (cached) return cached;
    try {
      const url = await invoke<string>("upload_to_imgbb", {
        imgbbKey: apiCreds.imgbb_api_key,
        base64Image: dataUrl,
      });
      if (url) {
        imgbbCache.set(dataUrl.slice(0, 100), url);
        return url;
      }
    } catch (e) {
      console.warn("imgbb upload failed for direct ref:", e);
    }
  }

  return dataUrl;
}

async function loadImageAsDataUri(filePath: string): Promise<string | null> {
  try {
    return await invoke<string>("read_image_as_data_uri", { path: filePath });
  } catch (e) {
    console.warn("Failed to read image for @tag:", filePath, e);
    return null;
  }
}
