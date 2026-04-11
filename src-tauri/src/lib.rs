mod commands;
mod file_watcher;
mod session_watcher;

use commands::{get_system_paths, list_dir, load_external_systems, load_system_data, load_usage_data, read_file, rescan_system, rescan_usage};
use file_watcher::start_file_watcher;
use session_watcher::start_session_watcher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            list_dir,
            get_system_paths,
            rescan_system,
            rescan_usage,
            load_system_data,
            load_usage_data,
            load_external_systems,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            start_file_watcher(handle.clone());
            start_session_watcher(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
