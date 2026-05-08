// Character Creator — Higgsfield Soul 2.0 integration
//
// Submission flow:
//   POST https://platform.higgsfield.ai/v1/text2image/soul
//     headers: hf-api-key, hf-secret, content-type: application/json
//     body:    { "params": { prompt, width_and_height, quality, batch_size } }
//     returns: { id, jobs: [{ id, status, results }] }
//
// Polling flow:
//   GET  https://platform.higgsfield.ai/v1/job-sets/{id}
//     returns the same JobSet shape with refreshed `status` per job and
//     `results.raw.url` once each job completes.
//
// We do NOT block on polling inside the submit call (Tauri commands have
// timeouts; long-running work belongs on the JS side calling poll repeatedly).

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;

const HF_BASE_URL: &str = "https://platform.higgsfield.ai";

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct SoulParams<'a> {
    prompt: &'a str,
    width_and_height: &'a str,
    quality: &'a str,
    batch_size: u32,
}

#[derive(Debug, Serialize)]
struct SoulRequest<'a> {
    params: SoulParams<'a>,
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

/// Submit a Soul 2.0 text-to-image batch. Returns the JobSet immediately —
/// poll separately to track progress.
#[tauri::command]
pub async fn submit_character_batch(
    api_key: String,
    api_secret: String,
    prompt: String,
    width_and_height: Option<String>,
    quality: Option<String>,
    batch_size: Option<u32>,
) -> Result<JobSet, String> {
    if api_key.trim().is_empty() || api_secret.trim().is_empty() {
        return Err("Higgsfield credentials missing — set them in Settings.".into());
    }

    let size = width_and_height.unwrap_or_else(|| "1536x2048".to_owned()); // PORTRAIT default
    let quality = quality.unwrap_or_else(|| "1080p".to_owned());
    let batch = batch_size.unwrap_or(4);

    let body = SoulRequest {
        params: SoulParams {
            prompt: &prompt,
            width_and_height: &size,
            quality: &quality,
            batch_size: batch,
        },
    };

    let client = http_client()?;
    let resp = client
        .post(format!("{HF_BASE_URL}/v1/text2image/soul"))
        .header("hf-api-key", &api_key)
        .header("hf-secret", &api_secret)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Submit request: {e}"))?;

    if !resp.status().is_success() {
        return Err(parse_error(resp).await);
    }

    resp.json::<JobSet>()
        .await
        .map_err(|e| format!("Parse JobSet response: {e}"))
}

/// Poll an existing job-set. Returns the latest JobSet snapshot.
#[tauri::command]
pub async fn poll_character_batch(
    api_key: String,
    api_secret: String,
    job_set_id: String,
) -> Result<JobSet, String> {
    if api_key.trim().is_empty() || api_secret.trim().is_empty() {
        return Err("Higgsfield credentials missing.".into());
    }

    let client = http_client()?;
    let resp = client
        .get(format!("{HF_BASE_URL}/v1/job-sets/{job_set_id}"))
        .header("hf-api-key", &api_key)
        .header("hf-secret", &api_secret)
        .send()
        .await
        .map_err(|e| format!("Poll request: {e}"))?;

    if !resp.status().is_success() {
        return Err(parse_error(resp).await);
    }

    resp.json::<JobSet>()
        .await
        .map_err(|e| format!("Parse JobSet response: {e}"))
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
