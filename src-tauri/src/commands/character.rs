// Character Creator — Higgsfield Soul V2 Standard integration
//
// Upgraded from the original `/v1/text2image/soul` endpoint (Soul 1.0) to
// Soul V2 Standard in v0.1.7 for better photorealism on hero shots.
//
// Submission flow (V2):
//   POST https://platform.higgsfield.ai/higgsfield-ai/soul/v2/standard
//     headers: hf-api-key, hf-secret, content-type: application/json
//     body:    { prompt, batch_size, resolution, aspect_ratio, enhance_prompt }
//     returns: { status, request_id, status_url, cancel_url }
//
// Polling flow (V2):
//   GET  https://platform.higgsfield.ai/requests/{request_id}/status
//     returns: shape TBD — captured defensively via serde_json::Value so we
//     log the actual payload and extract the result URL from any of the
//     common field shapes Higgsfield might use.
//
// Architectural note:
//   The JS layer (charactersStore.ts) was written against the V1 shape:
//   `{ id, jobs: [{ id, status, results.raw.url }] }`.  Rather than rewrite
//   the entire polling pool to deal with V2's flat `request_id` model, we
//   synthesize a V1-shaped `JobSet` inside Rust — `request_id` becomes both
//   the JobSet id AND the single Job id (they're functionally the same in
//   V2 since each submit returns exactly one request).
//
// Schema notes:
//   - V1 took a single `width_and_height: "WIDTHxHEIGHT"` string; V2 splits
//     this into a closed-enum `aspect_ratio` ("9:16" | "16:9" | "4:3" | "3:4"
//     | "1:1" | "2:3" | "3:2") plus a separate `resolution` ("720p"|"1080p").
//   - V2's `enhance_prompt` boolean re-runs the prompt through Higgsfield's
//     auto-rewriter.  We pin it to `false` because characterPrompt.ts is
//     already a heavily-tuned 500-line builder — letting Higgsfield rewrite
//     it would fight our anti-plastic-skin, clothing-bias, and prop-attention
//     primitives.  If we ever want to A/B test, expose it via a settings
//     toggle rather than the per-call API.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

const HF_BASE_URL: &str = "https://platform.higgsfield.ai";
const SOUL_V2_PATH: &str = "/higgsfield-ai/soul/v2/standard";
/// V2's per-request status endpoint.  `{}` is the `request_id` returned by
/// the submit call.  The /requests/ prefix replaces V1's /v1/job-sets/.
const REQUEST_STATUS_PATH_TMPL: &str = "/requests/{}/status";

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

/// Soul V2 request body.  Flat — no `params` wrapper like V1 had.
/// `enhance_prompt` is intentionally always `false`; see file header.
#[derive(Debug, Serialize)]
struct SoulV2Request<'a> {
    prompt: &'a str,
    batch_size: u32,
    resolution: &'a str,
    aspect_ratio: &'a str,
    enhance_prompt: bool,
}

/// Shape of V2's submit-time response.  Each submit returns one request,
/// not a job-set (V1's plural model is gone).  `status_url` / `cancel_url`
/// are convenience full-URLs returned by the API; we don't use them
/// because we construct the status URL from `request_id` for robustness
/// against host changes.
#[derive(Debug, Deserialize)]
struct SubmitV2Response {
    status: String,
    request_id: String,
    // status_url + cancel_url present in payload, ignored — we rebuild
    // them from request_id when needed.
}

/// Shape of V2's status endpoint is not yet documented anywhere we can
/// see.  We capture every field via serde_json::Value and pull the result
/// URL out manually, trying the field names Higgsfield is likely to have
/// used.  When all extraction attempts fail we log the body so the user
/// (or we) can spot the actual field name and tighten this code later.
#[derive(Debug, Deserialize)]
struct StatusV2Response {
    status: String,
    #[serde(default)]
    request_id: Option<String>,
    #[serde(flatten)]
    extra: serde_json::Map<String, serde_json::Value>,
}

/// Walk a status response and try to extract the rendered image URL.
/// Returns `None` if the request is still queued / in-progress (no URL
/// in the body yet) OR if no URL-shaped string exists in the payload at
/// all.
///
/// Strategy:
///   1. Try the known shorthand field names first (result.url, results[0]
///      .url, image.url, image_url, data.url, output.url, output[0].url).
///      These are the patterns most APIs use — if Higgsfield uses one of
///      them we hit it cheaply.
///   2. If none match, fall back to a depth-first walk over the whole
///      response, returning the first string that looks like a usable
///      image URL.  Defensive against schema changes — Higgsfield can
///      rename `result` to `final_image` or move it inside `data.payload`
///      and we still find it.
///
/// "Looks like a usable image URL" = starts with http(s):// AND ends in a
/// common image extension OR contains a known Higgsfield CDN host token.
/// Bias toward false-negatives (skip URLs we're not sure about) rather
/// than false-positives (returning a status webhook URL by mistake).
fn extract_result_url(extra: &serde_json::Map<String, serde_json::Value>) -> Option<String> {
    let pluck_url_from_object = |v: &serde_json::Value| -> Option<String> {
        v.as_object()
            .and_then(|o| o.get("url"))
            .and_then(|u| u.as_str())
            .map(|s| s.to_owned())
    };
    let pluck_url_from_array = |v: &serde_json::Value| -> Option<String> {
        v.as_array()
            .and_then(|a| a.first())
            .and_then(pluck_url_from_object)
    };
    if let Some(v) = extra.get("result") {
        if let Some(u) = pluck_url_from_object(v) {
            return Some(u);
        }
    }
    if let Some(v) = extra.get("results") {
        if let Some(u) = pluck_url_from_array(v) {
            return Some(u);
        }
    }
    if let Some(v) = extra.get("image") {
        if let Some(u) = pluck_url_from_object(v) {
            return Some(u);
        }
    }
    if let Some(u) = extra.get("image_url").and_then(|v| v.as_str()) {
        return Some(u.to_owned());
    }
    if let Some(v) = extra.get("data") {
        if let Some(u) = pluck_url_from_object(v) {
            return Some(u);
        }
        if let Some(u) = pluck_url_from_array(v) {
            return Some(u);
        }
    }
    if let Some(v) = extra.get("output") {
        if let Some(u) = pluck_url_from_object(v) {
            return Some(u);
        }
        if let Some(u) = pluck_url_from_array(v) {
            return Some(u);
        }
    }

    // Fallback: depth-first walk over every string in the payload.  Catches
    // anything Higgsfield reorganizes or invents.  See looks_like_image_url
    // for the heuristic — we explicitly REJECT URLs that look like
    // webhooks ("/status", "/cancel") to avoid returning the polling URL
    // by mistake.
    for (_, v) in extra.iter() {
        if let Some(u) = walk_for_image_url(v) {
            return Some(u);
        }
    }
    None
}

/// Depth-first search for the first URL-shaped string in a serde_json
/// value that passes the image-URL heuristic.  Walks objects + arrays
/// recursively; skips primitives.
fn walk_for_image_url(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => {
            if looks_like_image_url(s) {
                Some(s.clone())
            } else {
                None
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr {
                if let Some(u) = walk_for_image_url(item) {
                    return Some(u);
                }
            }
            None
        }
        serde_json::Value::Object(map) => {
            for (_, item) in map.iter() {
                if let Some(u) = walk_for_image_url(item) {
                    return Some(u);
                }
            }
            None
        }
        _ => None,
    }
}

/// Heuristic: is this string a rendered-image URL we should display?
/// Conservative: must be http(s) AND (image extension OR known CDN host)
/// AND NOT look like a webhook / status / cancel URL.
fn looks_like_image_url(s: &str) -> bool {
    if !s.starts_with("http://") && !s.starts_with("https://") {
        return false;
    }
    let lower = s.to_lowercase();
    // Reject obvious non-image endpoints — these are returned in the
    // submit response (status_url, cancel_url) and would mislead the UI
    // into rendering an HTML page as an <img>.
    if lower.contains("/status")
        || lower.contains("/cancel")
        || lower.ends_with("/poll")
        || lower.contains("webhook")
    {
        return false;
    }
    // Strip query string before checking the extension.
    let path = lower.split('?').next().unwrap_or(&lower);
    let image_exts = [
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".heic", ".bmp",
    ];
    if image_exts.iter().any(|ext| path.ends_with(ext)) {
        return true;
    }
    // Common CDN hosts Higgsfield is known to use — covers query-string-
    // suffixed URLs that don't end in an obvious extension.
    let cdn_hosts = [
        "higgsfield.ai",
        "higgsfield-prod",
        "s3.amazonaws.com",
        "cloudfront.net",
        "r2.cloudflarestorage.com",
        "googleusercontent.com",
        "fal.media",
    ];
    cdn_hosts.iter().any(|host| lower.contains(host))
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct JobResult {
    pub url: String,
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct JobResults {
    pub raw: Option<JobResult>,
    #[serde(default)]
    pub min: Option<JobResult>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Job {
    pub id: String,
    pub status: String,
    #[serde(default)]
    pub results: Option<JobResults>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct JobSet {
    pub id: String,
    pub jobs: Vec<Job>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|e| format!("HTTP client init: {e}"))
}

async fn parse_error(resp: reqwest::Response) -> String {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if body.is_empty() {
        format!("Higgsfield {status}")
    } else {
        format!("Higgsfield {status}: {body}")
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Submit a Soul V2 Standard text-to-image batch. Returns the JobSet
/// immediately — poll separately to track progress.
///
/// `aspect_ratio` must be one of Higgsfield's accepted enum values:
///   "9:16" (default) | "16:9" | "4:3" | "3:4" | "1:1" | "2:3" | "3:2"
/// Anything else will surface as a 400 from the API; we don't pre-validate
/// here so adding new ratios on Higgsfield's side doesn't require a Rust
/// release.  Resolution is fixed to 1080p (the highest quality tier we ship
/// — V2's other option is 720p, exposed only if we later want a "draft"
/// mode).
#[tauri::command]
pub async fn submit_character_batch(
    api_key: String,
    api_secret: String,
    prompt: String,
    aspect_ratio: Option<String>,
    batch_size: Option<u32>,
) -> Result<JobSet, String> {
    if api_key.trim().is_empty() || api_secret.trim().is_empty() {
        return Err("Higgsfield credentials missing — set them in Settings.".into());
    }

    let aspect = aspect_ratio.unwrap_or_else(|| "9:16".to_owned()); // hero-shot default
    let batch = batch_size.unwrap_or(1);

    let body = SoulV2Request {
        prompt: &prompt,
        batch_size: batch,
        resolution: "1080p",
        aspect_ratio: &aspect,
        enhance_prompt: false,
    };

    let client = http_client()?;
    let resp = client
        .post(format!("{HF_BASE_URL}{SOUL_V2_PATH}"))
        .header("hf-api-key", &api_key)
        .header("hf-secret", &api_secret)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Submit request: {e}"))?;

    if !resp.status().is_success() {
        return Err(parse_error(resp).await);
    }

    // Read as text first so deserialization errors can include a body
    // preview.  Cheap insurance against future schema drift on Higgsfield's
    // end — when this code last broke, a useless "error decoding response
    // body" error cost real money before we could diagnose.
    let raw = resp
        .text()
        .await
        .map_err(|e| format!("Read response body: {e}"))?;
    let parsed: SubmitV2Response = serde_json::from_str(&raw).map_err(|e| {
        let preview: String = raw.chars().take(500).collect();
        format!("Parse submit response: {e}.  Body preview: {preview}")
    })?;

    // Translate V2's `{status, request_id, ...}` to V1's `JobSet { id,
    // jobs: [Job { id, status, results }] }`.  See file header for why we
    // keep the JS layer on the V1 contract.
    Ok(JobSet {
        id: parsed.request_id.clone(),
        jobs: vec![Job {
            id: parsed.request_id,
            status: parsed.status,
            results: None, // not available until polling reports completed
        }],
    })
}

/// Poll a Soul V2 request.  `job_set_id` is the V1 name retained for JS
/// compatibility — in V2 it carries the `request_id` value returned at
/// submit time.  Translates V2's status response into the V1 JobSet
/// shape so the JS polling pool needs no changes.
#[tauri::command]
pub async fn poll_character_batch(
    api_key: String,
    api_secret: String,
    job_set_id: String,
) -> Result<JobSet, String> {
    if api_key.trim().is_empty() || api_secret.trim().is_empty() {
        return Err("Higgsfield credentials missing.".into());
    }

    let path = REQUEST_STATUS_PATH_TMPL.replace("{}", &job_set_id);
    let client = http_client()?;
    let resp = client
        .get(format!("{HF_BASE_URL}{path}"))
        .header("hf-api-key", &api_key)
        .header("hf-secret", &api_secret)
        .send()
        .await
        .map_err(|e| format!("Poll request: {e}"))?;

    if !resp.status().is_success() {
        return Err(parse_error(resp).await);
    }

    let raw = resp
        .text()
        .await
        .map_err(|e| format!("Read poll body: {e}"))?;
    // Log every poll response in dev builds — useful for diagnosing
    // schema drift on Higgsfield's side or extract_result_url misses.
    // Gated to `debug_assertions` so release users don't see the spam:
    // this fires on every poll tick (every few seconds) per in-flight image.
    #[cfg(debug_assertions)]
    eprintln!("[soul-v2-poll] {raw}");

    let parsed: StatusV2Response = serde_json::from_str(&raw).map_err(|e| {
        let preview: String = raw.chars().take(500).collect();
        format!("Parse poll response: {e}.  Body preview: {preview}")
    })?;

    let result_url = extract_result_url(&parsed.extra);
    // Synthesize the V1-shaped JobSet.  Status terms ("queued",
    // "in_progress", "completed", "failed", "nsfw") are passed through —
    // mapStatus on the JS side handles the enum normalization.  If V2
    // uses a status we haven't seen, mapStatus's default branch sends it
    // to "in_progress" (safe — just keeps polling).
    Ok(JobSet {
        id: parsed.request_id.clone().unwrap_or_else(|| job_set_id.clone()),
        jobs: vec![Job {
            id: parsed.request_id.unwrap_or(job_set_id),
            status: parsed.status,
            results: result_url.map(|url| JobResults {
                raw: Some(JobResult {
                    url,
                    kind: None,
                }),
                min: None,
            }),
        }],
    })
}

/// Download an image from a URL and write it to `dest_path`. Used by "Save Image".
#[tauri::command]
pub async fn download_image_to_path(url: String, dest_path: String) -> Result<String, String> {
    let client = http_client()?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Read body: {e}"))?;

    let path = PathBuf::from(&dest_path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent).map_err(|e| format!("Create dir: {e}"))?;
        }
    }
    std::fs::write(&path, &bytes).map_err(|e| format!("Write file: {e}"))?;
    Ok(dest_path)
}

/// Fetch raw image bytes for a URL — used by "Copy Image" so the JS side can
/// hand them to the clipboard plugin without a CORS / redirect dance.
#[tauri::command]
pub async fn fetch_image_bytes(url: String) -> Result<Vec<u8>, String> {
    let client = http_client()?;
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Fetch: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("Fetch failed: HTTP {}", resp.status()));
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Read body: {e}"))?;
    Ok(bytes.to_vec())
}
