use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::{Duration, Instant};
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

// 감시 경로 종류 구분 — 기존 file-changed 이벤트와 새 claude-system-changed 이벤트를 분리
#[derive(Debug, Clone, Copy, PartialEq)]
enum WatchGroup {
    // work-log, agent-memory → 기존 file-changed 이벤트
    WorkLog,
    // agents, commands, rules, settings.json → claude-system-changed 이벤트
    ClaudeSystem,
}

pub fn start_file_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"));

        // (경로, 감시 그룹) 쌍 목록
        //
        // SSOT 정합성 (CRITICAL):
        // ~/.claude/{agents,commands,rules} 는 ~/qjc-office/dotclaude/* 로 가는 symlink일 수 있다.
        // notify crate(macOS FSEvents 기반)는 symlink target을 자동 추적하지 않으므로
        // 실제 SSOT 경로를 명시적으로 watch한다. 사용자가 symlink를 풀고 실제 디렉토리로 운영하는
        // 경우를 대비해 ~/.claude/* 도 함께 watch — 디바운스 1초가 중복 발사를 흡수한다.
        //
        // pipelines 도 scan-system.ts 가 실제 읽는 경로 명시:
        //   - pipelines : ~/qjc-office/dotclaude/reference/agent-pipeline.md
        // mcpServers 는 settings.json(이미 watch) 의 MCP 필드 + ~/projects/*/.mcp.json 에서 오는데,
        //   projects 하위 전체 watch 는 코드 변경마다 발화하는 noise 라 제외한다.
        //   settings.json watch 로 MCP 주요 변경은 커버된다.
        let watch_specs: Vec<(PathBuf, WatchGroup)> = vec![
            (home.join(".claude/work-log"), WatchGroup::WorkLog),
            (home.join(".claude/agent-memory"), WatchGroup::WorkLog),
            // ~/.claude symlink 경로 (호환성 유지)
            (home.join(".claude/agents"), WatchGroup::ClaudeSystem),
            (home.join(".claude/commands"), WatchGroup::ClaudeSystem),
            (home.join(".claude/rules"), WatchGroup::ClaudeSystem),
            (home.join(".claude/settings.json"), WatchGroup::ClaudeSystem),
            // SSOT 실제 경로 (symlink가 없거나 notify가 target 추적 안 할 때 안전망)
            (home.join("qjc-office/dotclaude/agents"), WatchGroup::ClaudeSystem),
            (home.join("qjc-office/dotclaude/commands"), WatchGroup::ClaudeSystem),
            (home.join("qjc-office/dotclaude/rules"), WatchGroup::ClaudeSystem),
            // 파이프라인 정의 파일 (scanPipelines 가 직접 읽음)
            (
                home.join("qjc-office/dotclaude/reference/agent-pipeline.md"),
                WatchGroup::ClaudeSystem,
            ),
        ];

        let valid_specs: Vec<(PathBuf, WatchGroup)> = watch_specs
            .into_iter()
            .filter(|(p, _)| p.exists())
            .collect();

        if valid_specs.is_empty() {
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

        for (path, _) in &valid_specs {
            let mode = if path.is_dir() {
                RecursiveMode::Recursive
            } else {
                RecursiveMode::NonRecursive
            };
            if let Err(e) = watcher.watch(path, mode) {
                eprintln!("[file-watcher] 감시 실패 {}: {e}", path.display());
            }
        }

        eprintln!(
            "[file-watcher] 감시 시작: {:?}",
            valid_specs.iter().map(|(p, _)| p.display().to_string()).collect::<Vec<_>>()
        );

        // claude-system-changed 디바운스용 마지막 emit 시각
        let debounce = Duration::from_millis(1000);
        let mut last_system_emit: Option<Instant> = None;

        for event in rx {
            let event_type = match event.kind {
                EventKind::Create(_) => "add",
                EventKind::Modify(_) => "change",
                EventKind::Remove(_) => "unlink",
                _ => continue,
            };

            for path in &event.paths {
                // 경로가 어느 감시 그룹에 속하는지 확인
                let group = valid_specs.iter().find_map(|(watch_path, grp)| {
                    if path.starts_with(watch_path) || path == watch_path {
                        Some(*grp)
                    } else {
                        None
                    }
                });

                match group {
                    Some(WatchGroup::WorkLog) => {
                        let payload = FileChangedPayload {
                            path: path.to_string_lossy().to_string(),
                            r#type: event_type.to_string(),
                            timestamp: now_ms(),
                        };
                        let _ = app.emit("file-changed", &payload);
                    }
                    Some(WatchGroup::ClaudeSystem) => {
                        // 디바운스 1초 — burst 변경 시 다발성 rescan 방지
                        let now = Instant::now();
                        let should_emit = match last_system_emit {
                            None => true,
                            Some(last) => now.duration_since(last) >= debounce,
                        };
                        if should_emit {
                            last_system_emit = Some(now);
                            let _ = app.emit("claude-system-changed", ());
                            eprintln!(
                                "[file-watcher] claude-system-changed: {}",
                                path.display()
                            );
                        }
                    }
                    None => {} // 알 수 없는 경로 무시
                }
            }
        }
    });
}
