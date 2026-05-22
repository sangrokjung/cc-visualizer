use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"))
}

fn project_dir() -> PathBuf {
    home_dir().join("projects/cc-visualizer")
}

#[tauri::command]
pub fn load_system_data() -> Result<serde_json::Value, String> {
    let path = project_dir().join("src/renderer/src/data/system-data.json");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_usage_data() -> Result<serde_json::Value, String> {
    let path = project_dir().join("src/renderer/src/data/usage-stats.json");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_external_systems() -> Result<serde_json::Value, String> {
    let path = project_dir().join("src/renderer/src/data/external-systems.json");
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_file(file_path: String) -> Result<String, String> {
    let path = if file_path.starts_with('~') {
        home_dir().join(&file_path[2..])
    } else {
        PathBuf::from(&file_path)
    };

    if !path.exists() {
        return Err("File not found".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_dir(dir_path: String) -> Result<Vec<String>, String> {
    let path = if dir_path.starts_with('~') {
        home_dir().join(&dir_path[2..])
    } else {
        PathBuf::from(&dir_path)
    };

    if !path.exists() {
        return Err("Dir not found".into());
    }
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let files: Vec<String> = entries
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();
    Ok(files)
}

#[tauri::command]
pub fn get_system_paths() -> HashMap<String, String> {
    let home = home_dir();
    let cwd = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("/"))
        .to_string_lossy()
        .replace('/', "-");

    let mut paths = HashMap::new();
    paths.insert("agents".into(), home.join(".claude/agents").to_string_lossy().to_string());
    paths.insert("settings".into(), home.join(".claude/settings.json").to_string_lossy().to_string());
    paths.insert("rules".into(), home.join("qjc-office/dotclaude/rules").to_string_lossy().to_string());
    paths.insert("memory".into(), home.join(format!(".claude/projects/{}/memory", cwd)).to_string_lossy().to_string());
    paths.insert("agentMemory".into(), home.join(".claude/agent-memory").to_string_lossy().to_string());
    paths.insert("workLog".into(), home.join(".claude/work-log").to_string_lossy().to_string());
    paths.insert("pipeline".into(), home.join("qjc-office/dotclaude/reference/agent-pipeline.md").to_string_lossy().to_string());
    paths
}

#[tauri::command]
pub async fn rescan_system() -> Result<serde_json::Value, String> {
    let project_dir = home_dir().join("projects/cc-visualizer");
    let output = Command::new("npm")
        .args(["run", "scan"])
        .current_dir(&project_dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let data_path = project_dir.join("src/renderer/src/data/system-data.json");
    let content = fs::read_to_string(data_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

/// 프론트엔드 mount 직후 호출하여 최신 세션 JSONL의 백필 이벤트를 받아옵니다.
/// race condition 방어 — start_session_watcher의 자동 백필을 못 받았어도 명시적 재요청.
#[tauri::command]
pub fn backfill_session(app: tauri::AppHandle) -> Result<usize, String> {
    crate::session_watcher::backfill_latest_session(&app)
}

/// ccusage CLI를 호출하여 Claude Code 일자별 토큰/비용 통계 조회.
/// 26K+ JSONL 파일 직접 스캔 대신 검증된 도구(npx ccusage) 위임 → 정확성 + 캐싱.
/// Tauri .app은 GUI라 PATH가 제한적 → npx 위치를 다중 fallback으로 탐색.
#[tauri::command]
pub async fn fetch_ccusage_daily() -> Result<serde_json::Value, String> {
    // Tauri .app은 fnm/nvm shell PATH 미상속 — 후보 절대 경로 순회
    let npx_candidates = [
        "/opt/homebrew/bin/npx",
        "/usr/local/bin/npx",
        "/Users/sangrok/.local/state/fnm_multishells/7497_1779169147482/bin/npx",
        "npx", // 마지막 시도 — PATH 의존
    ];

    let mut last_err = String::from("npx 후보 모두 실패");
    for npx_path in &npx_candidates {
        let result = Command::new(npx_path)
            .args(["ccusage", "daily", "--json"])
            // PATH 환경변수 보강 (npx가 node 찾을 수 있게)
            .env(
                "PATH",
                "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
            )
            .output();

        match result {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
                return serde_json::from_str(&stdout)
                    .map_err(|e| format!("ccusage JSON 파싱 실패: {}", e));
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                last_err = format!("{} 종료 코드 ≠ 0: {}", npx_path, stderr);
            }
            Err(e) => {
                last_err = format!("{} 실행 실패: {}", npx_path, e);
            }
        }
    }

    Err(last_err)
}

#[tauri::command]
pub async fn rescan_usage() -> Result<serde_json::Value, String> {
    let project_dir = home_dir().join("projects/cc-visualizer");
    let output = Command::new("npm")
        .args(["run", "scan:usage"])
        .current_dir(&project_dir)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let data_path = project_dir.join("src/renderer/src/data/usage-stats.json");
    let content = fs::read_to_string(data_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}
