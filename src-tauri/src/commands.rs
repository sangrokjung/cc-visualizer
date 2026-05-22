use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"))
}

/// 개발 환경 전용 폴백 경로. 빌드된 앱에선 사용 안 함.
fn dev_data_dir() -> PathBuf {
    home_dir()
        .join("projects/cc-visualizer")
        .join("src/renderer/src/data")
}

/// GUI 앱(Tauri `.app`)은 fnm/nvm shell PATH를 상속받지 못한다.
/// `Command::new("npm")` 은 `command not found` 로 조용히 실패 → 오래된 데이터 표시.
/// npm 절대경로 후보를 순회하며 PATH도 보강해서 `npm run <script>` 를 실행한다.
/// (fetch_ccusage_daily 의 npx 절대경로 순회 패턴과 동일한 방어.)
/// 개발 환경에서 소스 트리가 있을 때 rescan 폴백용으로 예약.
#[allow(dead_code)]
fn run_npm_script(script: &str, work_dir: &PathBuf) -> Result<(), String> {
    // /opt/homebrew/bin 에 npm/npx/node 가 함께 있어, PATH 보강 시 npm 내부의
    // npx → tsx → node 연쇄도 같은 디렉토리에서 해결된다.
    let npm_candidates = [
        "/opt/homebrew/bin/npm",
        "/usr/local/bin/npm",
        "npm", // 마지막 시도 — PATH 의존 (개발 셸 환경)
    ];
    let augmented_path = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin";

    let mut last_err = String::from("npm 후보 모두 실패");
    for npm in &npm_candidates {
        let result = Command::new(npm)
            .args(["run", script])
            .current_dir(work_dir)
            .env("PATH", augmented_path)
            .output();

        match result {
            Ok(output) if output.status.success() => return Ok(()),
            Ok(output) => {
                last_err = format!(
                    "{} run {} 종료 코드 ≠ 0: {}",
                    npm,
                    script,
                    String::from_utf8_lossy(&output.stderr)
                );
            }
            Err(e) => {
                last_err = format!("{} 실행 실패: {}", npm, e);
            }
        }
    }
    Err(last_err)
}

/// 번들된 scan 스크립트를 직원 머신에서 `npx tsx`로 실행한다.
/// 출력 JSON은 app_data_dir (사용자 캐시) 에 저장된다.
///
/// 폴백 순서:
///   1. /opt/homebrew/bin/npx  (Apple Silicon Homebrew)
///   2. /usr/local/bin/npx     (Intel Homebrew / nvm global)
///   3. ~/.local/share/fnm/aliases/default/bin/npx  (fnm default symlink)
///   4. npx (PATH 의존 — 개발 셸)
fn run_tsx_script(
    script_path: &PathBuf,
    output_dir: &PathBuf,
    home: &PathBuf,
) -> Result<(), String> {
    let fnm_default = home
        .join(".local/share/fnm/aliases/default/bin/npx")
        .to_string_lossy()
        .to_string();
    let npx_candidates = [
        "/opt/homebrew/bin/npx",
        "/usr/local/bin/npx",
        fnm_default.as_str(),
        "npx",
    ];
    let augmented_path = format!(
        "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:{}",
        home.join(".local/share/fnm/aliases/default/bin")
            .to_string_lossy()
    );

    let output_dir_str = output_dir.to_string_lossy().to_string();
    let script_str = script_path.to_string_lossy().to_string();

    let mut last_err = String::from("npx 후보 모두 실패 (tsx 없음 — node 설치 필요)");
    for npx_path in &npx_candidates {
        let result = Command::new(npx_path)
            .args(["tsx", &script_str])
            .env("PATH", &augmented_path)
            .env("HOME", home.to_string_lossy().as_ref())
            .env("SCAN_OUTPUT_DIR", &output_dir_str)
            .output();

        match result {
            Ok(output) if output.status.success() => return Ok(()),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                last_err = format!("{} tsx 종료 코드 ≠ 0: {}", npx_path, stderr);
            }
            Err(e) => {
                last_err = format!("{} 실행 실패: {}", npx_path, e);
            }
        }
    }
    Err(last_err)
}

/// 3단계 폴백으로 JSON 파일을 읽는다.
///   1순위: 사용자 캐시 (app_data_dir / filename) — rescan 결과
///   2순위: 번들 리소스 스냅샷 (resource_dir / data / filename)
///   3순위: 개발 소스 트리 (~/projects/cc-visualizer/src/renderer/src/data/filename)
fn load_json_with_fallback(
    app: &tauri::AppHandle,
    filename: &str,
) -> Result<serde_json::Value, String> {
    // 1순위: 사용자 캐시
    if let Ok(cache_dir) = app.path().app_data_dir() {
        let cache_path = cache_dir.join(filename);
        if cache_path.exists() {
            if let Ok(content) = fs::read_to_string(&cache_path) {
                if let Ok(v) = serde_json::from_str(&content) {
                    return Ok(v);
                }
            }
        }
    }

    // 2순위: 번들 리소스 스냅샷
    if let Ok(resource_dir) = app.path().resource_dir() {
        let resource_path = resource_dir.join("data").join(filename);
        if resource_path.exists() {
            if let Ok(content) = fs::read_to_string(&resource_path) {
                if let Ok(v) = serde_json::from_str(&content) {
                    return Ok(v);
                }
            }
        }
    }

    // 3순위: 개발 소스 트리 폴백
    let dev_path = dev_data_dir().join(filename);
    let content = fs::read_to_string(&dev_path)
        .map_err(|e| format!("데이터 파일을 찾을 수 없습니다 ({}): {}", filename, e))?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_system_data(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    load_json_with_fallback(&app, "system-data.json")
}

#[tauri::command]
pub fn load_usage_data(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    load_json_with_fallback(&app, "usage-stats.json")
}

#[tauri::command]
pub fn load_external_systems(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    load_json_with_fallback(&app, "external-systems.json")
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
pub async fn rescan_system(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let home = home_dir();
    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir 조회 실패: {}", e))?;

    // 번들 리소스에서 scan 스크립트 경로 확인
    let resource_script = app
        .path()
        .resource_dir()
        .ok()
        .map(|r| r.join("scripts").join("scan-system.ts"));

    // 개발 소스 트리 폴백 경로
    let dev_script = home
        .join("projects/cc-visualizer")
        .join("scripts/scan-system.ts");

    let script_path = resource_script
        .filter(|p| p.exists())
        .or_else(|| if dev_script.exists() { Some(dev_script) } else { None })
        .ok_or_else(|| {
            "scan-system.ts 스크립트를 찾을 수 없습니다 (번들 리소스 또는 소스 트리 필요)".to_string()
        })?;

    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("캐시 디렉토리 생성 실패: {}", e))?;

    // npx tsx로 스크립트 실행. 실패 시 기존 번들 스냅샷으로 폴백.
    match run_tsx_script(&script_path, &cache_dir, &home) {
        Ok(()) => {
            let result_path = cache_dir.join("system-data.json");
            let content = fs::read_to_string(&result_path)
                .map_err(|e| format!("rescan 결과 읽기 실패: {}", e))?;
            serde_json::from_str(&content).map_err(|e| e.to_string())
        }
        Err(tsx_err) => {
            // npx/tsx 없음 → 번들 스냅샷 반환 + 안내 에러는 로그로만
            eprintln!("rescan 실패 (node 필요): {}", tsx_err);
            load_json_with_fallback(&app, "system-data.json")
                .map_err(|_| format!("node/npx가 필요합니다. 설치 후 재시도하세요. (원인: {})", tsx_err))
        }
    }
}

#[tauri::command]
pub async fn rescan_usage(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let home = home_dir();
    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir 조회 실패: {}", e))?;

    let resource_script = app
        .path()
        .resource_dir()
        .ok()
        .map(|r| r.join("scripts").join("scan-usage.ts"));

    let dev_script = home
        .join("projects/cc-visualizer")
        .join("scripts/scan-usage.ts");

    let script_path = resource_script
        .filter(|p| p.exists())
        .or_else(|| if dev_script.exists() { Some(dev_script) } else { None })
        .ok_or_else(|| {
            "scan-usage.ts 스크립트를 찾을 수 없습니다".to_string()
        })?;

    fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("캐시 디렉토리 생성 실패: {}", e))?;

    match run_tsx_script(&script_path, &cache_dir, &home) {
        Ok(()) => {
            let result_path = cache_dir.join("usage-stats.json");
            let content = fs::read_to_string(&result_path)
                .map_err(|e| format!("rescan 결과 읽기 실패: {}", e))?;
            serde_json::from_str(&content).map_err(|e| e.to_string())
        }
        Err(tsx_err) => {
            eprintln!("rescan_usage 실패 (node 필요): {}", tsx_err);
            load_json_with_fallback(&app, "usage-stats.json")
                .map_err(|_| format!("node/npx가 필요합니다. 설치 후 재시도하세요. (원인: {})", tsx_err))
        }
    }
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
    // Tauri .app은 fnm/nvm shell PATH 미상속 — 후보 절대 경로 순회.
    // fnm default symlink는 사용자 무관 안정 경로(직원 배포 시 sangrok 특정 multishell 경로 제거).
    let home = home_dir();
    let fnm_default = home
        .join(".local/share/fnm/aliases/default/bin/npx")
        .to_string_lossy()
        .to_string();
    let npx_candidates = [
        "/opt/homebrew/bin/npx",
        "/usr/local/bin/npx",
        fnm_default.as_str(),
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
