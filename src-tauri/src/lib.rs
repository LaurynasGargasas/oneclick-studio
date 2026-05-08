mod commands;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "settings_model_id",
            sql: include_str!("../migrations/002_settings_model.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "settings_imgbb_key",
            sql: include_str!("../migrations/003_imgbb_key.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:seedance.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            // elements
            commands::elements::save_new_element_images,
            commands::elements::append_element_image,
            commands::elements::delete_image_file,
            commands::elements::delete_element_dir,
            commands::elements::new_uuid,
            // generations / API
            commands::generations::test_api_connection,
            commands::generations::submit_generation,
            commands::generations::poll_generation,
            commands::generations::download_generation_video,
            commands::generations::save_video_to_path,
            commands::generations::read_image_as_data_uri,
            // file uploads / public hosting
            commands::files::upload_local_image,
            commands::files::upload_data_url,
            commands::files::upload_to_imgbb,
            // system
            commands::system::create_desktop_shortcut,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
