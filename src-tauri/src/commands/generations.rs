use std::path::PathBuf;

use anyhow::Context;
use base64::{engine::general_purpose, Engine};
use serde::{Deserialize, Serialize};
use tauri::Manager;

// ---------------------------------------------------------------------------
// Shared wire types (match BytePlus ModelArk multimodal schema)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentItem {
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    /// Used when sending reference images to the API
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image_url: Option<UrlWrapper>,
    /// Returned by the API for completed video output items
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_url: Option<UrlWrapper>,
    /// Role of this content item (e.g. "reference" for input images)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UrlWrapper {
    pub url: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GenerationParameters {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub watermark: Option<bool>,
    /// Whether to generate native audio. Maps to generate_audio in the API.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generate_audio: Option<bool>,
    /// Aspect ratio sent to the API, e.g. "9:16", "16:9", "1:1".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ratio: Option<String>,
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/// BytePlus Seedance 2.0 uses a **flat** request body — all parameters are
/// top-level fields, NOT nested inside a "parameters" object.
#[derive(Debug, Serialize)]
struct SubmitRequest {
    model: String,
    content: Vec<ContentItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    duration: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ratio: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    resolution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    seed: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    watermark: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generate_audio: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct SubmitResponse {
    id: Option<String>,
    task_id: Option<String>,
    status: Option<String>,
    error: Option<ApiError>,
}

impl SubmitResponse {
    fn task_id(&self) -> Option<&str> {
        self.id.as_deref().or(self.task_id.as_deref())
    }
}

// ---------------------------------------------------------------------------
// Poll
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct TokenUsage {
    total_tokens: Option<i64>,
    completion_tokens: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct PollResponse {
    id: Option<String>,
    task_id: Option<String>,
    status: Option<String>,
    task_status: Option<String>,
    output: Option<PollOutput>,
    error: Option<ApiError>,
    task_result: Option<TaskResult>,
    // Dreamina envelope: { code, data: { status, video_info } }
    data: Option<DreaminaData>,
    // Shape G: Dreamina Seedance 2.0 flat: { content: { video_url } }
    content: Option<ContentVideoUrl>,
    // Token usage returned on completion
    usage: Option<TokenUsage>,
}

#[derive(Debug, Deserialize)]
struct ContentVideoUrl {
    video_url: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PollOutput {
    choices: Option<Vec<Choice>>,
    // Dreamina-Seedance-2.0 flat shapes
    video_url: Option<String>,
    video_urls: Option<Vec<String>>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Option<ChoiceMessage>,
    content: Option<Vec<ContentItem>>,
}

#[derive(Debug, Deserialize)]
struct ChoiceMessage {
    content: Option<Vec<ContentItem>>,
}

#[derive(Debug, Deserialize)]
struct TaskResult {
    videos: Option<Vec<VideoResult>>,
    video_url: Option<String>,
    url: Option<String>,
}

// Dreamina-style: data.video_info.video_url
#[derive(Debug, Deserialize)]
struct VideoInfo {
    video_url: Option<String>,
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DreaminaData {
    video_info: Option<VideoInfo>,
    video_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct VideoResult {
    url: Option<String>,
    video_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    message: Option<String>,
    code: Option<String>,
}

// The simplified status type we return to TS
#[derive(Debug, Serialize, Clone)]
pub struct TaskStatus {
    pub task_id: String,
    /// "pending" | "processing" | "completed" | "failed"
    pub status: String,
    pub video_url: Option<String>,
    pub error: Option<String>,
    pub raw_status: String,
    /// Total tokens consumed (available when status = completed)
    pub total_tokens: Option<i64>,
}

fn normalise_status(raw: &str) -> &str {
    match raw.to_lowercase().as_str() {
        "pending" | "queued" | "created" => "pending",
        "running" | "processing" | "in_progress" => "processing",
        "succeeded" | "success" | "completed" | "done" => "completed",
        "failed" | "error" | "cancelled" | "canceled" => "failed",
        _ => "processing",
    }
}

fn extract_video_url(poll: &PollResponse) -> Option<String> {
    // Shape A: output.choices[0].message.content[].{type:"video_url", image_url:{url}}
    if let Some(output) = &poll.output {
        if let Some(choices) = &output.choices {
            for choice in choices {
                let items = choice
                    .message
                    .as_ref()
                    .and_then(|m| m.content.as_ref())
                    .or(choice.content.as_ref());
                if let Some(items) = items {
                    for item in items {
                        if item.r#type == "video_url" {
                            // Check video_url field first (correct field name for video items)
                            if let Some(w) = &item.video_url {
                                return Some(w.url.clone());
                            }
                            // Fall back to image_url in case some endpoints reuse that field
                            if let Some(w) = &item.image_url {
                                return Some(w.url.clone());
                            }
                        }
                    }
                }
            }
        }
        // Shape B: output.video_url (Dreamina-Seedance-2.0 flat)
        if let Some(url) = &output.video_url {
            return Some(url.clone());
        }
        // Shape C: output.video_urls[0]
        if let Some(urls) = &output.video_urls {
            if let Some(url) = urls.first() {
                return Some(url.clone());
            }
        }
        // Shape D: output.url
        if let Some(url) = &output.url {
            return Some(url.clone());
        }
    }
    // Shape E: task_result.video_url / task_result.videos[0]
    if let Some(tr) = &poll.task_result {
        if let Some(url) = &tr.video_url {
            return Some(url.clone());
        }
        if let Some(url) = &tr.url {
            return Some(url.clone());
        }
        if let Some(videos) = &tr.videos {
            if let Some(v) = videos.first() {
                return v.url.as_ref().or(v.video_url.as_ref()).cloned();
            }
        }
    }
    // Shape F: Dreamina envelope data.video_info.video_url
    if let Some(data) = &poll.data {
        if let Some(vi) = &data.video_info {
            if let Some(url) = &vi.video_url { return Some(url.clone()); }
            if let Some(url) = &vi.url { return Some(url.clone()); }
        }
        if let Some(url) = &data.video_url {
            return Some(url.clone());
        }
    }
    // Shape G: Dreamina Seedance 2.0 — top-level content.video_url
    if let Some(content) = &poll.content {
        if let Some(url) = &content.video_url { return Some(url.clone()); }
        if let Some(url) = &content.url { return Some(url.clone()); }
    }
    None
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Lightweight ping — fetches the models list to verify the key is valid.
#[tauri::command]
pub async fn test_api_connection(
    endpoint: String,
    api_key: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/models", endpoint.trim_end_matches('/'));

    let resp = client
        .get(&url)
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();

    if status.is_success() {
        Ok(format!("OK — {status}"))
    } else {
        Err(format!("HTTP {status}: {body}"))
    }
}

/// Submit a generation task. Returns the remote task_id on success.
#[tauri::command]
pub async fn submit_generation(
    endpoint: String,
    api_key: String,
    model: String,
    content: Vec<ContentItem>,
    parameters: Option<GenerationParameters>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/contents/generations/tasks",
        endpoint.trim_end_matches('/')
    );

    // Flatten GenerationParameters into top-level fields (BytePlus flat format)
    let p = parameters.as_ref();
    let body = SubmitRequest {
        model,
        content,
        duration:       p.and_then(|x| x.duration),
        ratio:          p.and_then(|x| x.ratio.clone()),
        resolution:     p.and_then(|x| x.resolution.clone()),
        seed:           p.and_then(|x| x.seed),
        watermark:      p.and_then(|x| x.watermark),
        generate_audio: p.and_then(|x| x.generate_audio),
    };

    log::info!("submit_generation POST {url}");

    let resp = client
        .post(&url)
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = resp.status();
    let raw = resp.text().await.unwrap_or_default();
    log::info!("submit_generation response {status}: {raw}");

    if !status.is_success() {
        return Err(format!("HTTP {status}: {raw}"));
    }

    let parsed: SubmitResponse =
        serde_json::from_str(&raw).map_err(|e| format!("Parse error: {e}\nBody: {raw}"))?;

    if let Some(err) = &parsed.error {
        return Err(format!(
            "[{}] {}",
            err.code.as_deref().unwrap_or("ERR"),
            err.message.as_deref().unwrap_or("unknown error")
        ));
    }

    parsed
        .task_id()
        .map(str::to_owned)
        .ok_or_else(|| format!("No task_id in response: {raw}"))
}

/// Poll a task for status / completion. Returns a TaskStatus JSON.
#[tauri::command]
pub async fn poll_generation(
    endpoint: String,
    api_key: String,
    task_id: String,
) -> Result<TaskStatus, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}/contents/generations/tasks/{task_id}",
        endpoint.trim_end_matches('/')
    );

    let resp = client
        .get(&url)
        .bearer_auth(&api_key)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status_code = resp.status();
    let raw = resp.text().await.unwrap_or_default();
    log::info!("poll_generation {task_id} → {status_code}: {raw}");

    if !status_code.is_success() {
        return Err(format!("HTTP {status_code}: {raw}"));
    }

    let parsed: PollResponse =
        serde_json::from_str(&raw).map_err(|e| format!("Parse error: {e}\nBody: {raw}"))?;

    let raw_status = parsed
        .status
        .as_deref()
        .or(parsed.task_status.as_deref())
        .unwrap_or("unknown")
        .to_string();

    let norm = normalise_status(&raw_status).to_string();
    let video_url = if norm == "completed" {
        extract_video_url(&parsed)
    } else {
        None
    };
    let error_msg = if norm == "failed" {
        parsed
            .error
            .as_ref()
            .and_then(|e| e.message.clone())
            .or_else(|| Some(format!("Task failed with status: {raw_status}")))
    } else {
        None
    };
    let total_tokens = parsed
        .usage
        .as_ref()
        .and_then(|u| u.total_tokens.or(u.completion_tokens));

    Ok(TaskStatus {
        task_id,
        status: norm,
        video_url,
        error: error_msg,
        raw_status,
        total_tokens,
    })
}

/// Download a remote video URL into app_data_dir/media/generations/{generation_id}/video.mp4.
/// Returns the absolute local path.
#[tauri::command]
pub async fn download_generation_video(
    app: tauri::AppHandle,
    url: String,
    generation_id: String,
) -> Result<String, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;

    let dir: PathBuf = app_data
        .join("media")
        .join("generations")
        .join(&generation_id);

    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| format!("mkdir: {e}"))?;

    let dest = dir.join("video.mp4");

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download error: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download HTTP {}", resp.status()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Read bytes: {e}"))?;

    tokio::fs::write(&dest, &bytes)
        .await
        .map_err(|e| format!("Write file: {e}"))?;

    dest.to_str()
        .map(str::to_owned)
        .ok_or_else(|| "Non-UTF8 path".to_string())
}

/// Save a video (remote URL or local path) to a user-chosen destination path.
/// Called from TS after the save dialog resolves.
#[tauri::command]
pub async fn save_video_to_path(src: String, dest: String) -> Result<(), String> {
    if src.starts_with("http://") || src.starts_with("https://") {
        let client = reqwest::Client::new();
        let resp = client
            .get(&src)
            .send()
            .await
            .map_err(|e| format!("Download error: {e}"))?;
        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }
        let bytes = resp.bytes().await.map_err(|e| format!("Read bytes: {e}"))?;
        tokio::fs::write(&dest, &bytes)
            .await
            .map_err(|e| format!("Write: {e}"))?;
    } else {
        tokio::fs::copy(&src, &dest)
            .await
            .map_err(|e| format!("Copy: {e}"))?;
    }
    Ok(())
}

/// Read a local image file and return it as a base64 data URI.
/// Used by the TS tag resolver to inline images for the API payload.
#[tauri::command]
pub async fn read_image_as_data_uri(path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .with_context(|| format!("read {path}"))
        .map_err(|e| e.to_string())?;

    let mime = if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    };

    let b64 = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}
