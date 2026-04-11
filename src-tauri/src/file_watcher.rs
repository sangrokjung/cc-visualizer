use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileChangedPayload {
    pub path: String,
    pub r#type: String,
    pub timestamp: u64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

pub fn start_file_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
        let watch_paths = vec![
            home.join(".claude/work-log"),
            home.join(".claude/agent-memory"),
        ];

        let valid_paths: Vec<PathBuf> = watch_paths.into_iter().filter(|p| p.exists()).collect();
        if valid_paths.is_empty() {
            eprintln!("[file-watcher] 감시할 경로가 없습니다");
            return;
        }

        let (tx, rx) = mpsc::channel::<Event>();
        let mut watcher: RecommendedWatcher = match notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                let _ = tx.send(event);
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[file-watcher] 와처 생성 실패: {e}");
                return;
            }
        };

        for path in &valid_paths {
            if let Err(e) = watcher.watch(path, RecursiveMode::Recursive) {
                eprintln!("[file-watcher] 감시 실패 {}: {e}", path.display());
            }
        }

        eprintln!("[file-watcher] 감시 시작: {:?}", valid_paths.iter().map(|p| p.display().to_string()).collect::<Vec<_>>());

        for event in rx {
            let event_type = match event.kind {
                EventKind::Create(_) => "add",
                EventKind::Modify(_) => "change",
                EventKind::Remove(_) => "unlink",
                _ => continue,
            };

            for path in &event.paths {
                let payload = FileChangedPayload {
                    path: path.to_string_lossy().to_string(),
                    r#type: event_type.to_string(),
                    timestamp: now_ms(),
                };
                let _ = app.emit("file-changed", &payload);
            }
        }
    });
}
