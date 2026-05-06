use base64::{engine::general_purpose, Engine};
use reqwest::multipart;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Recursively walk a JSON value looking for the first `https://` URL in a
/// field whose name looks URL-like.  Returns `None` if none is found.
fn find_https_url(val: &serde_json::Value) -> Option<String> {
    match val {
        serde_json::Value::Object(map) => {
            for key in &["url", "file_url", "cdn_url", "download_url", "public_url", "uri"] {
                if let Some(v) = map.get(*key) {
                    if let Some(s) = v.as_str() {
                        if s.starts_with("https://") || s.starts_with("http://") {
                            return Some(s.to_owned());
                        }
                    }
                }
            }
            for (_, child) in map {
                if let Some(u) = find_https_url(child) {
                    return Some(u);
                }
            }
        }
        serde_json::Value::Array(arr) => {
            for child in arr {
                if let Some(u) = find_https_url(child) {
                    return Some(u);
                }
            }
        }
        _ => {}
    }
    None
}

/// After uploading a file and getting back only a file ID, probe the
/// authenticated content endpoint.  If BytePlus issues a 302 redirect to a
/// CDN URL we can capture that URL — it will be publicly accessible.
async fn probe_cdn_redirect(
    endpoint: &str,
    api_key: &str,
    file_id: &str,
) -> Option<String> {
    let url = format!(
        "{}/files/{}/content",
        endpoint.trim_end_matches('/'),
        file_id
    );

    // Build a client that does NOT follow redirects so we can inspect the
    // Location header ourselves.
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .ok()?;

    let resp = client
        .get(&url)
        .bearer_auth(api_key)
        .send()
        .await
        .ok()?;

    let status = resp.status();
    log::info!("probe_cdn_redirect {file_id} → {status}");

    if status.is_redirection() {
        if let Some(loc) = resp.headers().get("location") {
            if let Ok(cdn_url) = loc.to_str() {
                if cdn_url.starts_with("https://") || cdn_url.starts_with("http://") {
                    log::info!("probe_cdn_redirect: CDN URL via redirect: {cdn_url}");
                    return Some(cdn_url.to_owned());
                }
            }
        }
    }

    None
}

// ---------------------------------------------------------------------------
// Shared BytePlus Files API upload helper
// ---------------------------------------------------------------------------

async fn upload_bytes(
    endpoint: &str,
    api_key: &str,
    bytes: Vec<u8>,
    filename: &str,
    mime: &str,
) -> Result<String, String> {
    let upload_url = format!("{}/files", endpoint.trim_end_matches('/'));

    let part = multipart::Part::bytes(bytes)
        .file_name(filename.to_string())
        .mime_str(mime)
        .map_err(|e| format!("MIME error: {e}"))?;

    let form = multipart::Form::new()
        .part("file", part)
        .text("purpose", "user_data");

    let client = reqwest::Client::new();
    let resp = client
        .post(&upload_url)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    let status = resp.status();
    let raw = resp.text().await.unwrap_or_default();
    log::info!("upload_bytes response {status}: {raw}");

    if !status.is_success() {
        return Err(format!("HTTP {status}: {raw}"));
    }

    let json_val: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("Parse error: {e}\nBody: {raw}"))?;

    // 1. Look for any direct public HTTPS URL in the response (any nesting level)
    if let Some(direct_url) = find_https_url(&json_val) {
        log::info!("upload_bytes: found public URL in response: {direct_url}");
        return Ok(direct_url);
    }

    // 2. Only a file ID was returned — probe for a CDN redirect
    let file_id = json_val
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();

    if !file_id.is_empty() {
        if let Some(cdn_url) = probe_cdn_redirect(endpoint, api_key, &file_id).await {
            return Ok(cdn_url);
        }
    }

    // 3. No public URL obtainable — signal the caller to fall back to base64
    log::warn!(
        "upload_bytes: Files API returned only file ID '{}' with no public URL",
        file_id
    );
    Err(format!(
        "Files API returned no public URL (file ID: {})",
        file_id
    ))
}

// ---------------------------------------------------------------------------
// Tauri commands — BytePlus Files API
// ---------------------------------------------------------------------------

/// Upload a local image file to the BytePlus Files API.
/// Returns a public URL on success; error signals caller to fall back to base64.
#[tauri::command]
pub async fn upload_local_image(
    endpoint: String,
    api_key: String,
    file_path: String,
) -> Result<String, String> {
    let bytes = tokio::fs::read(&file_path)
        .await
        .map_err(|e| format!("Read error: {e}"))?;

    let filename = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image.jpg")
        .to_string();

    let mime = if file_path.ends_with(".png") {
        "image/png"
    } else if file_path.ends_with(".webp") {
        "image/webp"
    } else {
        "image/jpeg"
    };

    upload_bytes(&endpoint, &api_key, bytes, &filename, mime).await
}

/// Upload a base64 data URL to the BytePlus Files API.
/// Returns a public URL on success; error signals caller to fall back.
#[tauri::command]
pub async fn upload_data_url(
    endpoint: String,
    api_key: String,
    data_url: String,
    filename: String,
) -> Result<String, String> {
    let base64_marker = "base64,";
    let marker_pos = data_url
        .find(base64_marker)
        .ok_or("Invalid data URL: missing base64 marker")?;

    let mime = data_url[5..marker_pos - 1].to_string();
    let b64_data = &data_url[marker_pos + base64_marker.len()..];

    let bytes = general_purpose::STANDARD
        .decode(b64_data)
        .map_err(|e| format!("Base64 decode error: {e}"))?;

    upload_bytes(&endpoint, &api_key, bytes, &filename, &mime).await
}

// ---------------------------------------------------------------------------
// Tauri commands — imgbb public image hosting
// ---------------------------------------------------------------------------

/// Upload an image (as base64 data URL or raw base64) to imgbb.
/// Returns a permanent public HTTPS URL.
/// imgbb API: POST https://api.imgbb.com/1/upload?key={key}  body: image=<base64>
#[tauri::command]
pub async fn upload_to_imgbb(
    imgbb_key: String,
    base64_image: String,
) -> Result<String, String> {
    // Strip the data URL prefix if present (data:<mime>;base64,<data>)
    let b64 = if let Some(pos) = base64_image.find("base64,") {
        &base64_image[pos + 7..]
    } else {
        &base64_image
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("https://api.imgbb.com/1/upload?key={imgbb_key}"))
        .form(&[("image", b64)])
        .send()
        .await
        .map_err(|e| format!("imgbb network error: {e}"))?;

    let status = resp.status();
    let raw = resp.text().await.unwrap_or_default();
    log::info!("upload_to_imgbb response {status}: {raw}");

    if !status.is_success() {
        return Err(format!("imgbb HTTP {status}: {raw}"));
    }

    let json: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| format!("imgbb parse error: {e}"))?;

    // imgbb response: { "data": { "url": "...", "display_url": "..." }, "success": true }
    json.get("data")
        .and_then(|d| d.get("url"))
        .and_then(|u| u.as_str())
        .map(str::to_owned)
        .ok_or_else(|| format!("No URL in imgbb response: {raw}"))
}
