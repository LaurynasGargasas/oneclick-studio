use tauri::Manager;

/// Create a shortcut/alias on the user's Desktop pointing to this app.
/// On Windows: creates a .lnk via WScript.Shell.
/// On macOS:   creates a symlink to the .app bundle.
#[tauri::command]
pub async fn create_desktop_shortcut(app: tauri::AppHandle) -> Result<String, String> {
    let desktop = app
        .path()
        .desktop_dir()
        .map_err(|e| format!("Desktop dir: {e}"))?;

    #[cfg(target_os = "windows")]
    {
        let exe = std::env::current_exe().map_err(|e| format!("Exe path: {e}"))?;
        let exe_str = exe.to_string_lossy().replace('\'', "''");
        let shortcut = desktop.join("Seedance Studio.lnk");
        let shortcut_str = shortcut.to_string_lossy().replace('\'', "''");

        let script = format!(
            "$ws = New-Object -ComObject WScript.Shell; \
             $sc = $ws.CreateShortcut('{shortcut_str}'); \
             $sc.TargetPath = '{exe_str}'; \
             $sc.Description = 'Seedance Studio'; \
             $sc.Save()"
        );

        let status = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .status()
            .map_err(|e| format!("PowerShell: {e}"))?;

        if status.success() {
            Ok(shortcut.to_string_lossy().into_owned())
        } else {
            Err(format!("PowerShell exited with code {:?}", status.code()))
        }
    }

    #[cfg(target_os = "macos")]
    {
        // The binary lives at <AppName>.app/Contents/MacOS/<binary>.
        // Walk up three levels to get the .app bundle root.
        let exe = std::env::current_exe().map_err(|e| format!("Exe path: {e}"))?;
        let app_bundle = exe
            .parent() // …/MacOS
            .and_then(|p| p.parent()) // …/Contents
            .and_then(|p| p.parent()) // …/Seedance Studio.app
            .ok_or_else(|| "Could not locate .app bundle".to_string())?;

        let symlink = desktop.join("Seedance Studio.app");
        // Remove stale symlink if present
        let _ = std::fs::remove_file(&symlink);

        std::os::unix::fs::symlink(app_bundle, &symlink)
            .map_err(|e| format!("Symlink: {e}"))?;

        Ok(symlink.to_string_lossy().into_owned())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Desktop shortcuts are not supported on this platform.".to_string())
    }
}
