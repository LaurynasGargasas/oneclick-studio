use std::path::PathBuf;

use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedElementImage {
    pub id: String,
    pub element_id: String,
    pub file_path: String,
    pub sort_order: i32,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ElementImageInput {
    pub data_url: String,
    pub original_name: String,
}

fn elements_dir(app: &AppHandle, element_id: &str) -> Result<PathBuf, String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir lookup failed: {e}"))?;
    let dir = app_data.join("media").join("elements").join(element_id);
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir failed: {e}"))?;
    Ok(dir)
}

fn parse_data_url(data_url: &str) -> Result<(String, &str), String> {
    let comma = data_url.find(',').ok_or("Invalid data URL: no comma")?;
    let header = &data_url[..comma];
    let body = &data_url[comma + 1..];
    if !header.starts_with("data:") {
        return Err("Invalid data URL: missing data: prefix".to_string());
    }
    let semicolon = header.find(';').ok_or("Invalid data URL: no semicolon")?;
    let mime = header[5..semicolon].to_string();
    Ok((mime, body))
}

fn ext_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "bin",
    }
}

fn write_image(
    app: &AppHandle,
    element_id: &str,
    image: &ElementImageInput,
    sort_order: i32,
) -> Result<SavedElementImage, String> {
    let dir = elements_dir(app, element_id)?;
    let (mime, b64) = parse_data_url(&image.data_url)?;
    let bytes = general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| format!("base64 decode failed: {e}"))?;
    let ext = ext_for_mime(&mime);
    let file_id = Uuid::new_v4().to_string();
    let filename = format!("{file_id}.{ext}");
    let dest = dir.join(&filename);
    std::fs::write(&dest, &bytes).map_err(|e| format!("file write failed: {e}"))?;

    let now = chrono::Utc::now().timestamp_millis();
    Ok(SavedElementImage {
        id: file_id,
        element_id: element_id.to_string(),
        file_path: dest.to_string_lossy().to_string(),
        sort_order,
        width: None,
        height: None,
        created_at: now,
    })
}

/// Allocate a fresh element ID and write all incoming images to its media folder.
/// Returns the saved image rows so the frontend can persist them via the SQL plugin.
#[tauri::command]
pub async fn save_new_element_images(
    app: AppHandle,
    element_id: Option<String>,
    images: Vec<ElementImageInput>,
) -> Result<Vec<SavedElementImage>, String> {
    let element_id = element_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let mut saved = Vec::with_capacity(images.len());
    for (idx, img) in images.iter().enumerate() {
        saved.push(write_image(&app, &element_id, img, idx as i32)?);
    }
    Ok(saved)
}

/// Append a single image to an existing element (used in detail modal "add more").
#[tauri::command]
pub async fn append_element_image(
    app: AppHandle,
    element_id: String,
    image: ElementImageInput,
    sort_order: i32,
) -> Result<SavedElementImage, String> {
    write_image(&app, &element_id, &image, sort_order)
}

/// Delete one image file by absolute path.
#[tauri::command]
pub async fn delete_image_file(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("delete failed: {e}"))?;
    }
    Ok(())
}

/// Recursively delete an element's entire media directory.
#[tauri::command]
pub async fn delete_element_dir(app: AppHandle, element_id: String) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir lookup failed: {e}"))?;
    let dir = app_data.join("media").join("elements").join(&element_id);
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("rmdir failed: {e}"))?;
    }
    Ok(())
}

/// Allocate a fresh UUID. Frontend calls this before showing the create modal so
/// the image upload can use the final element_id for its directory layout.
#[tauri::command]
pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}
