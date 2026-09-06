use serde::Serialize;
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
    // 메시지 텍스트 글자 수 — 전체 텍스트 대신 정수만 emit (메모리 절약 + 토큰 추정용)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub char_count: Option<u32>,
}

/// message.content[] 의 모든 text 블록 글자 수 합산.
/// content가 문자열이면 그대로 길이, 배열이면 text 블록만 합산.
fn count_message_chars(raw: &serde_json::Value) -> u32 {
    let content = match raw.get("message").and_then(|m| m.get("content")) {
        Some(c) => c,
        None => return 0,
    };
    if let Some(s) = content.as_str() {
        return s.chars().count() as u32;
    }
    let mut total: usize = 0;
    if let Some(arr) = content.as_array() {
        for block in arr {
            if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(s) = block.get("text").and_then(|t| t.as_str()) {
                    total += s.chars().count();
                }
            }
        }
    }
    total as u32
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
    let limit = if *last_scan == 0 {
        5
    } else {
        changed_dirs.len()
    };

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

/// UTF-8 safe truncation — multi-byte 문자(한글 등) 중간 절단 panic 방어.
/// byte length max_bytes 이하 + char boundary에 맞춰 자릅니다.
fn truncate_utf8_safe(s: &str, max_bytes: usize) -> String {
    if s.len() <= max_bytes {
        return s.to_string();
    }
    // max_bytes 이하의 가장 큰 char boundary 찾기
    let mut idx = max_bytes;
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    s[..idx].to_string()
}

/// 파일 끝 `max_bytes` 영역에서, 깨진 첫 라인을 버리고 다음 newline 이후 본문을 반환한다.
/// 시작 byte 인덱스를 char boundary로 보정하여 멀티바이트(한글 등) 중간 슬라이싱 panic을 방어한다.
/// (기존 `content[byte_idx..]` 직접 슬라이싱은 byte_idx가 문자 중간이면 panic → 워처 스레드 사망)
fn tail_lines_after_newline(content: &str, max_bytes: u64) -> &str {
    let len = content.len() as u64;
    let start = len.saturating_sub(max_bytes);
    if start == 0 {
        return content;
    }
    let mut byte_idx = start as usize;
    while byte_idx < content.len() && !content.is_char_boundary(byte_idx) {
        byte_idx += 1;
    }
    match content[byte_idx..].find('\n') {
        Some(i) => &content[byte_idx + i + 1..],
        None => "",
    }
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

    let id = raw
        .get("uuid")
        .or_else(|| raw.get("messageId"))
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(uuid_simple);
    let ts = raw
        .get("timestamp")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or_else(now_iso);
    let entry_type = raw.get("type").and_then(|v| v.as_str()).unwrap_or("");

    let mut events = Vec::new();

    match entry_type {
        "assistant" => {
            // message.content[] 순회 — tool_use 블록 추출
            if let Some(content) = raw
                .get("message")
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
                                    agent_id: Some(
                                        block
                                            .get("id")
                                            .and_then(|v| v.as_str())
                                            .unwrap_or("")
                                            .to_string(),
                                    ),
                                    agent_name: Some(agent_name.to_string()),
                                    text: Some(format!(
                                        "{} ({}{})",
                                        desc,
                                        model,
                                        if subagent_type.is_empty() {
                                            String::new()
                                        } else {
                                            format!(", {}", subagent_type)
                                        }
                                    )),
                                    ..Default::default()
                                },
                            });
                        } else if !tool_name.is_empty() {
                            // 일반 도구 사용 이벤트
                            // 토큰 추정용 input 전체 글자 수 (잘리기 전)
                            let input_chars = input
                                .map(|i| i.to_string().chars().count() as u32)
                                .unwrap_or(0);
                            // UTF-8 안전 truncate — 100 bytes 근처에서 char boundary 찾기
                            let tool_input = input.map(|i| truncate_utf8_safe(&i.to_string(), 100));

                            events.push(SessionEvent {
                                id: format!("{}-tool-{}", id, i),
                                timestamp: ts.clone(),
                                r#type: "tool_use".into(),
                                data: SessionEventData {
                                    tool_name: Some(tool_name.to_string()),
                                    tool_input,
                                    char_count: Some(input_chars),
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
                    data: SessionEventData {
                        char_count: Some(count_message_chars(&raw)),
                        ..Default::default()
                    },
                });
            }
        }

        "user" => {
            // tool_result 블록 추출
            if let Some(content) = raw
                .get("message")
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
                                tool_name: block
                                    .get("tool_use_id")
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
                    data: SessionEventData {
                        char_count: Some(count_message_chars(&raw)),
                        ..Default::default()
                    },
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
                    let hook_name = info
                        .get("hookName")
                        .or_else(|| info.get("command"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    if !hook_name.is_empty() {
                        events.push(SessionEvent {
                            id: format!("{}-hook", id),
                            timestamp: ts.clone(),
                            r#type: "hook".into(),
                            data: SessionEventData {
                                hook_event: raw
                                    .get("type")
                                    .and_then(|v| v.as_str())
                                    .map(String::from),
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
    let d = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}-{:x}", d.as_secs(), d.subsec_nanos())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_event_has_char_count() {
        // 실제 Claude Code JSONL 형식의 user 메시지
        let line = r#"{"type":"user","uuid":"u1","timestamp":"2026-05-21T10:00:00Z","message":{"role":"user","content":[{"type":"text","text":"안녕하세요 테스트"}]}}"#;
        let events = parse_line(line);
        assert_eq!(events.len(), 1, "user line should emit 1 event");
        assert_eq!(events[0].r#type, "user");
        // "안녕하세요 테스트" = 5(안녕하세요) + 1(공백) + 3(테스트) = 9자
        assert_eq!(events[0].data.char_count, Some(9));
    }

    #[test]
    fn assistant_text_event_has_char_count() {
        let line = r#"{"type":"assistant","uuid":"a1","timestamp":"2026-05-21T10:00:00Z","message":{"role":"assistant","content":[{"type":"text","text":"Hello world this is a response"}]}}"#;
        let events = parse_line(line);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].r#type, "assistant");
        assert_eq!(events[0].data.char_count, Some(30), "영문 30자");
    }

    #[test]
    fn assistant_with_tool_use_emits_tool_event_with_char_count() {
        // tool_use 블록을 포함한 assistant 메시지
        let line = r#"{"type":"assistant","uuid":"a2","timestamp":"2026-05-21T10:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Bash","input":{"command":"ls -la"}}]}}"#;
        let events = parse_line(line);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].r#type, "tool_use");
        assert_eq!(events[0].data.tool_name.as_deref(), Some("Bash"));
        // input JSON 직렬화 길이
        assert!(events[0].data.char_count.is_some_and(|c| c > 0));
    }

    #[test]
    fn unknown_line_emits_no_event() {
        let line = r#"{"type":"attachment","data":"..."}"#;
        let events = parse_line(line);
        assert_eq!(
            events.len(),
            0,
            "attachment 같은 알 수 없는 타입은 emit 안 함"
        );
    }

    #[test]
    fn truncate_utf8_safe_does_not_panic_on_multibyte() {
        // 한글 한 글자 = 3 bytes. 33자 × 3 = 99 bytes, +1 → 100 byte index가 char 중간
        let korean = "가".repeat(34); // 34 chars × 3 bytes = 102 bytes
        let result = truncate_utf8_safe(&korean, 100);
        // panic 없이 동작 + 결과는 100 bytes 이하 + 유효한 UTF-8
        assert!(result.len() <= 100);
        assert!(result.is_char_boundary(result.len()));
    }

    #[test]
    fn tool_use_with_korean_input_does_not_panic() {
        // 실제 사고 케이스: AskUserQuestion 한글 input이 100 byte 경계에서 잘려 panic
        let line = r#"{"type":"assistant","uuid":"a3","timestamp":"2026-05-21T10:00:00Z","message":{"role":"assistant","content":[{"type":"tool_use","id":"t2","name":"AskUserQuestion","input":{"questions":[{"header":"동기화 방향","multiSelect":false,"options":[{"description":"지금 PC를 정답으로 사용해서 반영"}]}]}}]}}"#;
        let events = parse_line(line);
        // panic 없이 동작해야 함
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].r#type, "tool_use");
    }

    #[test]
    fn malformed_json_returns_empty() {
        let events = parse_line("not json");
        assert!(events.is_empty());
    }

    #[test]
    fn tail_lines_full_content_when_under_max() {
        let content = "a\nb\nc";
        assert_eq!(tail_lines_after_newline(content, 1024), content);
    }

    #[test]
    fn tail_lines_drops_partial_first_line() {
        // 끝 8바이트 영역 → 깨진 첫 라인 버리고 다음 newline 이후부터
        let content = "line1\nline2\nline3\n";
        assert_eq!(tail_lines_after_newline(content, 8), "line3\n");
    }

    #[test]
    fn tail_lines_no_panic_on_multibyte_cut() {
        // start byte가 한글(3바이트) 중간에 떨어지는 케이스 — 기존 직접 슬라이싱은 panic 했다.
        // "가나다라마바사아자차"(30B) + "\n"(1B) + "TAIL_LINE"(9B) = 40B, max 12 → start=28(차 중간)
        let content = "가나다라마바사아자차\nTAIL_LINE";
        assert_eq!(tail_lines_after_newline(content, 12), "TAIL_LINE");
    }
}

/// 가장 최근 JSONL의 마지막 256KB 백필 이벤트 emit.
/// 프론트엔드가 listen 등록 후 명시적으로 호출 가능 → race condition 회피.
pub fn backfill_latest_session(app: &AppHandle) -> Result<usize, String> {
    let mut last_scan: u64 = 0;
    let path = find_latest_jsonl(&mut last_scan).ok_or("no jsonl found")?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;

    // 백필 영역 — 1MB (메모리 부담 작고 수십-수백 이벤트 확보). char boundary 보정 포함.
    const BACKFILL_BYTES: u64 = 1024 * 1024;
    let backfill_content: &str = tail_lines_after_newline(&content, BACKFILL_BYTES);

    let session_id = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();
    let _ = app.emit("session-id", &session_id);

    let mut count = 0;
    for line in backfill_content.lines() {
        if line.trim().is_empty() {
            continue;
        }
        for event in parse_line(line) {
            let _ = app.emit("session-event", &event);
            count += 1;
        }
    }
    eprintln!("[session-watcher] 백필 요청 처리: {} events", count);
    Ok(count)
}

pub fn start_session_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        // race condition 방어 — 프론트 React가 listen 등록할 시간 확보 (1초)
        std::thread::sleep(Duration::from_millis(1000));

        let mut last_scan: u64 = 0;
        let mut current_path: Option<PathBuf> = None;
        let mut offset: u64 = 0;

        loop {
            // 10초마다 새 세션 탐지
            let latest = find_latest_jsonl(&mut last_scan);
            if let Some(ref path) = latest {
                if current_path.as_ref() != Some(path) {
                    current_path = Some(path.clone());

                    let session_id = path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string();

                    let _ = app.emit("session-id", &session_id);
                    eprintln!("[session-watcher] 감시 시작: {}", path.display());

                    // 백필 — 마지막 ~1MB 라인을 즉시 emit해서 UI가 빈 상태로 안 보이게.
                    // 파일이 작으면 전체, 크면 끝에서 1MB만.
                    let file_size = path.metadata().map(|m| m.len()).unwrap_or(0);
                    const BACKFILL_BYTES: u64 = 1024 * 1024;
                    if let Ok(content) = fs::read_to_string(path) {
                        // 끝 1MB만, char boundary 보정으로 한글 중간 슬라이싱 panic 방어
                        let backfill_content = tail_lines_after_newline(&content, BACKFILL_BYTES);
                        let mut count = 0;
                        for line in backfill_content.lines() {
                            if line.trim().is_empty() {
                                continue;
                            }
                            for event in parse_line(line) {
                                let _ = app.emit("session-event", &event);
                                count += 1;
                            }
                        }
                        eprintln!("[session-watcher] 백필 {} events", count);
                    }
                    offset = file_size;
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
