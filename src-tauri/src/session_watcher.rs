use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvent {
    pub id: String,
    pub timestamp: String,
    pub r#type: String,
    pub data: SessionEventData,
}

#[derive(Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SessionEventData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_input: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hook_event: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hook_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

#[derive(Deserialize)]
struct JsonlEntry {
    uuid: Option<String>,
    timestamp: Option<String>,
    r#type: Option<String>,
    data: Option<serde_json::Value>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn find_latest_jsonl(last_scan: &mut u64) -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let projects_dir = home.join(".claude/projects");
    if !projects_dir.exists() {
        return None;
    }

    let mut latest_file: Option<PathBuf> = None;
    let mut latest_mtime: u64 = 0;

    let dirs = fs::read_dir(&projects_dir).ok()?;
    let mut changed_dirs: Vec<(PathBuf, u64)> = Vec::new();

    for entry in dirs.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let mtime = path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        if *last_scan > 0 && mtime <= *last_scan {
            continue;
        }
        changed_dirs.push((path, mtime));
    }

    changed_dirs.sort_by(|a, b| b.1.cmp(&a.1));
    let limit = if *last_scan == 0 { 5 } else { changed_dirs.len() };

    for (dir_path, _) in changed_dirs.iter().take(limit) {
        if let Ok(files) = fs::read_dir(dir_path) {
            for file in files.flatten() {
                let fpath = file.path();
                if fpath.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                    continue;
                }
                let mtime = fpath
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                if mtime > latest_mtime {
                    latest_mtime = mtime;
                    latest_file = Some(fpath);
                }
            }
        }
    }

    *last_scan = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    latest_file
}

fn extract_tool_uses(data: &serde_json::Value) -> Vec<(String, Option<String>)> {
    let mut results = Vec::new();
    let message = data.get("message").unwrap_or(data);
    if let Some(content) = message.get("content").and_then(|c| c.as_array()) {
        for block in content {
            if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                if let Some(name) = block.get("name").and_then(|n| n.as_str()) {
                    let input = block
                        .get("input")
                        .map(|i| {
                            let s = i.to_string();
                            if s.len() > 100 { s[..100].to_string() } else { s }
                        });
                    results.push((name.to_string(), input));
                }
            }
        }
    }
    results
}

fn parse_line(line: &str) -> Vec<SessionEvent> {
    // 실제 Claude Code JSONL 구조:
    // - type: "assistant" → message.content[] 에 tool_use 블록 포함
    //   - name === "Agent" → agent_spawn
    //   - name !== "Agent" → tool_use
    // - type: "user" → message.content[] 에 tool_result 블록 포함
    // - type: "system" → system 이벤트
    // - hook 이벤트는 hookCount/hookInfos 필드로 기록됨

    let raw: serde_json::Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let id = raw.get("uuid")
        .or_else(|| raw.get("messageId"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(uuid_simple);
    let ts = raw.get("timestamp")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(now_iso);
    let entry_type = raw.get("type").and_then(|v| v.as_str()).unwrap_or("");

    let mut events = Vec::new();

    match entry_type {
        "assistant" => {
            // message.content[] 순회 — tool_use 블록 추출
            if let Some(content) = raw.get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
            {
                for (i, block) in content.iter().enumerate() {
                    let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                    if block_type == "tool_use" {
                        let tool_name = block.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let input = block.get("input");

                        if tool_name == "Agent" {
                            // 에이전트 스폰 이벤트
                            let desc = input
                                .and_then(|i| i.get("description"))
                                .and_then(|d| d.as_str())
                                .unwrap_or("");
                            let agent_name = input
                                .and_then(|i| i.get("name"))
                                .and_then(|n| n.as_str())
                                .unwrap_or(desc);
                            let model = input
                                .and_then(|i| i.get("model"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("");
                            let subagent_type = input
                                .and_then(|i| i.get("subagent_type"))
                                .and_then(|s| s.as_str())
                                .unwrap_or("");

                            events.push(SessionEvent {
                                id: format!("{}-agent-{}", id, i),
                                timestamp: ts.clone(),
                                r#type: "agent_spawn".into(),
                                data: SessionEventData {
                                    agent_id: Some(block.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string()),
                                    agent_name: Some(agent_name.to_string()),
                                    text: Some(format!("{} ({}{})", desc, model,
                                        if subagent_type.is_empty() { String::new() } else { format!(", {}", subagent_type) }
                                    )),
                                    ..Default::default()
                                },
                            });
                        } else if !tool_name.is_empty() {
                            // 일반 도구 사용 이벤트
                            let tool_input = input.map(|i| {
                                let s = i.to_string();
                                if s.len() > 100 { s[..100].to_string() } else { s }
                            });

                            events.push(SessionEvent {
                                id: format!("{}-tool-{}", id, i),
                                timestamp: ts.clone(),
                                r#type: "tool_use".into(),
                                data: SessionEventData {
                                    tool_name: Some(tool_name.to_string()),
                                    tool_input,
                                    ..Default::default()
                                },
                            });
                        }
                    }
                }
            }

            // tool_use가 없는 assistant 메시지 (순수 텍스트 응답)
            if events.is_empty() {
                events.push(SessionEvent {
                    id,
                    timestamp: ts,
                    r#type: "assistant".into(),
                    data: Default::default(),
                });
            }
        }

        "user" => {
            // tool_result 블록 추출
            if let Some(content) = raw.get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
            {
                for block in content {
                    if block.get("type").and_then(|t| t.as_str()) == Some("tool_result") {
                        events.push(SessionEvent {
                            id: format!("{}-result", id),
                            timestamp: ts.clone(),
                            r#type: "tool_result".into(),
                            data: SessionEventData {
                                tool_name: block.get("tool_use_id")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.chars().take(20).collect()),
                                ..Default::default()
                            },
                        });
                        break; // 첫 tool_result만
                    }
                }
            }

            if events.is_empty() {
                events.push(SessionEvent {
                    id,
                    timestamp: ts,
                    r#type: "user".into(),
                    data: Default::default(),
                });
            }
        }

        "system" => {
            events.push(SessionEvent {
                id,
                timestamp: ts,
                r#type: "system".into(),
                data: Default::default(),
            });
        }

        // hook 이벤트 — hookInfos 필드가 있는 라인
        _ => {
            if let Some(hook_infos) = raw.get("hookInfos").and_then(|h| h.as_array()) {
                for info in hook_infos {
                    let hook_name = info.get("hookName")
                        .or_else(|| info.get("command"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if !hook_name.is_empty() {
                        events.push(SessionEvent {
                            id: format!("{}-hook", id),
                            timestamp: ts.clone(),
                            r#type: "hook".into(),
                            data: SessionEventData {
                                hook_event: raw.get("type").and_then(|v| v.as_str()).map(String::from),
                                hook_name: Some(hook_name.to_string()),
                                ..Default::default()
                            },
                        });
                        break; // 첫 훅 정보만
                    }
                }
            }
        }
    }

    events
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let d = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{:x}-{:x}", d.as_secs(), d.subsec_nanos())
}

pub fn start_session_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last_scan: u64 = 0;
        let mut current_path: Option<PathBuf> = None;
        let mut offset: u64 = 0;

        loop {
            // 10초마다 새 세션 탐지
            let latest = find_latest_jsonl(&mut last_scan);
            if let Some(ref path) = latest {
                if current_path.as_ref() != Some(path) {
                    current_path = Some(path.clone());
                    offset = path.metadata().map(|m| m.len()).unwrap_or(0);

                    let session_id = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let _ = app.emit("session-id", &session_id);
                    eprintln!("[session-watcher] 감시 시작: {}", path.display());
                }
            }

            // 현재 세션 파일에서 새 줄 읽기 (2초 × 5회 = 10초)
            for _ in 0..5 {
                if let Some(ref path) = current_path {
                    if let Ok(mut file) = fs::File::open(path) {
                        let current_size = file.metadata().map(|m| m.len()).unwrap_or(0);
                        if current_size > offset {
                            if file.seek(SeekFrom::Start(offset)).is_ok() {
                                let mut buf = vec![0u8; (current_size - offset) as usize];
                                if file.read_exact(&mut buf).is_ok() {
                                    offset = current_size;
                                    let content = String::from_utf8_lossy(&buf);
                                    for line in content.lines() {
                                        if line.trim().is_empty() {
                                            continue;
                                        }
                                        for event in parse_line(line) {
                                            let _ = app.emit("session-event", &event);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                std::thread::sleep(Duration::from_secs(2));
            }
        }
    });
}
