use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("/tmp"))
}

/// `~` 또는 `~/...` 를 home_dir 기준으로 확장한다.
/// 기존 `&path[2..]` 인덱싱은 입력이 `"~"`(길이 1)일 때 byte index 범위 초과로 panic 했다.
/// `~user/...` 형식은 미지원 — 리터럴 경로로 그대로 둔다(프론트는 `~/...` 만 전달).
fn expand_tilde(p: &str) -> PathBuf {
    if p == "~" {
        home_dir()
    } else if let Some(rest) = p.strip_prefix("~/") {
        home_dir().join(rest)
    } else {
        PathBuf::from(p)
    }
}

/// 후보 경로 중 실제 존재하는 첫 경로 반환 (symlink 따라감). 모두 없으면 마지막 후보.
/// 표준 `~/.claude/rules`(직원 PC) 우선, QJC SSOT `~/qjc-office/...` 폴백에 사용.
/// sangrok PC에선 `~/.claude/rules`가 qjc-office 로의 symlink라 동일 경로로 귀결(회귀 없음).
fn first_existing(candidates: &[PathBuf]) -> PathBuf {
    for c in candidates {
        if c.exists() {
            return c.clone();
        }
    }
    candidates
        .last()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("/"))
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
    let path = expand_tilde(&file_path);

    if !path.exists() {
        return Err("File not found".into());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_dir(dir_path: String) -> Result<Vec<String>, String> {
    let path = expand_tilde(&dir_path);

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

    // rules/pipeline 은 표준 ~/.claude 위치 우선 → QJC SSOT 폴백 (다른 PC 호환).
    let rules_dir = first_existing(&[
        home.join(".claude/rules"),
        home.join("qjc-office/dotclaude/rules"),
    ]);
    let pipeline_file = first_existing(&[
        home.join(".claude/reference/agent-pipeline.md"),
        home.join("qjc-office/dotclaude/reference/agent-pipeline.md"),
    ]);

    let mut paths = HashMap::new();
    paths.insert(
        "agents".into(),
        home.join(".claude/agents").to_string_lossy().to_string(),
    );
    paths.insert(
        "settings".into(),
        home.join(".claude/settings.json")
            .to_string_lossy()
            .to_string(),
    );
    paths.insert("rules".into(), rules_dir.to_string_lossy().to_string());
    paths.insert(
        "memory".into(),
        home.join(format!(".claude/projects/{}/memory", cwd))
            .to_string_lossy()
            .to_string(),
    );
    paths.insert(
        "agentMemory".into(),
        home.join(".claude/agent-memory")
            .to_string_lossy()
            .to_string(),
    );
    paths.insert(
        "workLog".into(),
        home.join(".claude/work-log").to_string_lossy().to_string(),
    );
    paths.insert(
        "pipeline".into(),
        pipeline_file.to_string_lossy().to_string(),
    );
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
        .or_else(|| {
            if dev_script.exists() {
                Some(dev_script)
            } else {
                None
            }
        })
        .ok_or_else(|| {
            "scan-system.ts 스크립트를 찾을 수 없습니다 (번들 리소스 또는 소스 트리 필요)"
                .to_string()
        })?;

    fs::create_dir_all(&cache_dir).map_err(|e| format!("캐시 디렉토리 생성 실패: {}", e))?;

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
            load_json_with_fallback(&app, "system-data.json").map_err(|_| {
                format!(
                    "node/npx가 필요합니다. 설치 후 재시도하세요. (원인: {})",
                    tsx_err
                )
            })
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
        .or_else(|| {
            if dev_script.exists() {
                Some(dev_script)
            } else {
                None
            }
        })
        .ok_or_else(|| "scan-usage.ts 스크립트를 찾을 수 없습니다".to_string())?;

    fs::create_dir_all(&cache_dir).map_err(|e| format!("캐시 디렉토리 생성 실패: {}", e))?;

    match run_tsx_script(&script_path, &cache_dir, &home) {
        Ok(()) => {
            let result_path = cache_dir.join("usage-stats.json");
            let content = fs::read_to_string(&result_path)
                .map_err(|e| format!("rescan 결과 읽기 실패: {}", e))?;
            serde_json::from_str(&content).map_err(|e| e.to_string())
        }
        Err(tsx_err) => {
            eprintln!("rescan_usage 실패 (node 필요): {}", tsx_err);
            load_json_with_fallback(&app, "usage-stats.json").map_err(|_| {
                format!(
                    "node/npx가 필요합니다. 설치 후 재시도하세요. (원인: {})",
                    tsx_err
                )
            })
        }
    }
}

/// 프론트엔드 mount 직후 호출하여 최신 세션 JSONL의 백필 이벤트를 받아옵니다.
/// race condition 방어 — start_session_watcher의 자동 백필을 못 받았어도 명시적 재요청.
#[tauri::command]
pub fn backfill_session(app: tauri::AppHandle) -> Result<usize, String> {
    crate::session_watcher::backfill_latest_session(&app)
}

/// ccusage CLI를 호출하여 Claude Code 토큰/비용 통계 조회 (subcommand: daily/weekly/monthly).
/// 26K+ JSONL 파일 직접 스캔 대신 검증된 도구(npx ccusage) 위임 → 정확성 + 캐싱.
/// Tauri .app은 GUI라 PATH가 제한적 → npx 위치를 다중 fallback으로 탐색.
fn run_ccusage(subcommand: &str) -> Result<serde_json::Value, String> {
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
            .args(["ccusage", subcommand, "--json"])
            // PATH 환경변수 보강 (npx가 node 찾을 수 있게)
            .env("PATH", "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin")
            .output();

        match result {
            Ok(output) if output.status.success() => {
                let stdout = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
                return serde_json::from_str(&stdout)
                    .map_err(|e| format!("ccusage {} JSON 파싱 실패: {}", subcommand, e));
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                last_err = format!("{} {} 종료 코드 ≠ 0: {}", npx_path, subcommand, stderr);
            }
            Err(e) => {
                last_err = format!("{} 실행 실패: {}", npx_path, e);
            }
        }
    }

    Err(last_err)
}

#[tauri::command]
pub async fn fetch_ccusage_daily() -> Result<serde_json::Value, String> {
    run_ccusage("daily")
}

/// 주간 통계 — 이번 주(period=이번 주 월요일) 정확 집계. `ccusage weekly` CLI와 일치.
#[tauri::command]
pub async fn fetch_ccusage_weekly() -> Result<serde_json::Value, String> {
    run_ccusage("weekly")
}

/// 월간 통계 — 이번 달(period=YYYY-MM) + 전체 누적(totals). `ccusage monthly` CLI와 일치.
#[tauri::command]
pub async fn fetch_ccusage_monthly() -> Result<serde_json::Value, String> {
    run_ccusage("monthly")
}

fn read_json_if_exists(path: &PathBuf) -> Option<serde_json::Value> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn json_f64(value: Option<&serde_json::Value>) -> Option<f64> {
    match value {
        Some(serde_json::Value::Number(n)) => n.as_f64(),
        Some(serde_json::Value::String(s)) => s.parse::<f64>().ok(),
        _ => None,
    }
}

fn json_i64(value: Option<&serde_json::Value>) -> Option<i64> {
    match value {
        Some(serde_json::Value::Number(n)) => n.as_i64().or_else(|| n.as_f64().map(|v| v as i64)),
        Some(serde_json::Value::String(s)) => s.parse::<i64>().ok(),
        _ => None,
    }
}

fn json_u64(value: Option<&serde_json::Value>) -> Option<u64> {
    match value {
        Some(serde_json::Value::Number(n)) => n
            .as_u64()
            .or_else(|| n.as_i64().and_then(|v| u64::try_from(v).ok())),
        Some(serde_json::Value::String(s)) => s.parse::<u64>().ok(),
        _ => None,
    }
}

fn parse_time_ms(value: Option<&serde_json::Value>) -> Option<i64> {
    match value {
        Some(serde_json::Value::Number(_)) => json_i64(value),
        Some(serde_json::Value::String(s)) => chrono::DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.timestamp_millis())
            .or_else(|| s.parse::<i64>().ok()),
        _ => None,
    }
}

fn ms_to_iso(ms: i64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_else(|| "invalid".to_string())
}

fn round1(n: f64) -> f64 {
    (n * 10.0).round() / 10.0
}

fn consider_soonest(soonest: &mut Option<i64>, ms: i64) {
    if ms <= 0 {
        return;
    }
    match soonest {
        Some(current) if ms >= *current => {}
        _ => *soonest = Some(ms),
    }
}

fn compute_teamclaude_retry_after_seconds(
    accounts: &Vec<serde_json::Value>,
    threshold: f64,
    now_ms: i64,
) -> Option<u64> {
    let mut soonest: Option<i64> = None;

    for acct in accounts {
        if acct.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
            continue;
        }
        if acct.get("status").and_then(|v| v.as_str()) == Some("error") {
            continue;
        }

        let mut free_at = 0_i64;
        if let Some(throttle_until) = parse_time_ms(acct.get("rateLimitedUntil")) {
            free_at = free_at.max(throttle_until);
        }

        let q = acct.get("quota").unwrap_or(&serde_json::Value::Null);
        if json_f64(q.get("unified5h")).is_some_and(|v| v >= threshold) {
            if let Some(reset) = parse_time_ms(q.get("unified5hReset")) {
                free_at = free_at.max(reset);
            }
        }
        if json_f64(q.get("unified7d")).is_some_and(|v| v >= threshold) {
            if let Some(reset) = parse_time_ms(q.get("unified7dReset")) {
                free_at = free_at.max(reset);
            }
        }

        let tokens_reset = q.get("tokensReset").or_else(|| q.get("resetsAt"));
        if let (Some(limit), Some(remaining), Some(reset)) = (
            json_f64(q.get("tokensLimit")),
            json_f64(q.get("tokensRemaining")),
            parse_time_ms(tokens_reset),
        ) {
            if limit > 0.0 && 1.0 - remaining / limit >= threshold {
                free_at = free_at.max(reset);
            }
        }

        let requests_reset = q.get("requestsReset").or_else(|| q.get("resetsAt"));
        if let (Some(limit), Some(remaining), Some(reset)) = (
            json_f64(q.get("requestsLimit")),
            json_f64(q.get("requestsRemaining")),
            parse_time_ms(requests_reset),
        ) {
            if limit > 0.0 && 1.0 - remaining / limit >= threshold {
                free_at = free_at.max(reset);
            }
        }

        if free_at > 0 {
            consider_soonest(&mut soonest, free_at - now_ms);
        } else {
            consider_soonest(&mut soonest, 60_000);
        }
    }

    soonest.map(|ms| std::cmp::max(1, ((ms as f64) / 1000.0).ceil() as u64))
}

fn summarize_teamclaude_health(
    status: Option<&serde_json::Value>,
    config: Option<&serde_json::Value>,
    server: Option<&serde_json::Value>,
    status_reachable: bool,
    _status_error: Option<&str>,
    current_process_proxy_set: bool,
    default_claude_clears_proxy: bool,
) -> serde_json::Value {
    let threshold = json_f64(status.and_then(|v| v.get("switchThreshold")))
        .or_else(|| json_f64(config.and_then(|v| v.get("switchThreshold"))))
        .unwrap_or(0.98);
    let config_account_count = config
        .and_then(|v| v.get("accounts"))
        .and_then(|v| v.as_array())
        .map(|accounts| accounts.len())
        .unwrap_or(0);
    let accounts = status
        .and_then(|v| v.get("accounts"))
        .and_then(|v| v.as_array());

    let mut total = 0_usize;
    let mut active = 0_usize;
    let mut throttled = 0_usize;
    let mut exhausted = 0_usize;
    let mut error = 0_usize;
    let mut disabled = 0_usize;
    let mut inflight = 0_u64;
    let mut capacity = 0_u64;
    let mut fable_known = 0_usize;
    let mut fable_over = 0_usize;
    let mut fable_sum = 0.0_f64;
    let mut fable_min: Option<f64> = None;
    let mut fable_max: Option<f64> = None;
    let mut fable_soonest_reset: Option<i64> = None;

    if let Some(accounts) = accounts {
        total = accounts.len();
        for acct in accounts {
            match acct
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
            {
                "active" => active += 1,
                "throttled" => throttled += 1,
                "exhausted" => exhausted += 1,
                "error" => error += 1,
                _ => {}
            }
            if acct.get("enabled").and_then(|v| v.as_bool()) == Some(false) {
                disabled += 1;
            }
            inflight += json_u64(acct.get("inflight")).unwrap_or(0);
            capacity += json_u64(acct.get("maxConcurrent")).unwrap_or(0);

            let fable = acct
                .get("quota")
                .and_then(|q| q.get("modelWeekly"))
                .and_then(|m| m.get("7d_oi"));
            if let Some(utilization) = json_f64(fable.and_then(|w| w.get("utilization"))) {
                fable_known += 1;
                if utilization >= threshold {
                    fable_over += 1;
                }
                let pct = utilization * 100.0;
                fable_sum += pct;
                fable_min = Some(fable_min.map_or(pct, |current| current.min(pct)));
                fable_max = Some(fable_max.map_or(pct, |current| current.max(pct)));
                if utilization >= threshold {
                    if let Some(reset) = parse_time_ms(fable.and_then(|w| w.get("reset"))) {
                        if reset > chrono::Utc::now().timestamp_millis() {
                            match fable_soonest_reset {
                                Some(current) if reset >= current => {}
                                _ => fable_soonest_reset = Some(reset),
                            }
                        }
                    }
                }
            }
        }
    }

    let accounts_for_retry = accounts.cloned().unwrap_or_default();
    let retry_after_seconds = compute_teamclaude_retry_after_seconds(
        &accounts_for_retry,
        threshold,
        chrono::Utc::now().timestamp_millis(),
    );

    let fable_all_over = fable_known > 0 && fable_over == fable_known;
    let overall_status = if !status_reachable {
        "error"
    } else if total > 0 && error == total {
        "error"
    } else if fable_all_over || fable_over > 0 || throttled > 0 || exhausted > 0 || disabled > 0 {
        "warning"
    } else {
        "ok"
    };

    let mut hints = Vec::new();
    if !status_reachable {
        hints.push(
            "teamclaude 서버에 연결할 수 없습니다. `teamclaude server` 실행 상태를 확인하세요.",
        );
    }
    if fable_all_over {
        hints.push("Fable 주간 쿼터가 모든 확인 계정에서 임계치 이상입니다. 서버와 계정이 active여도 해당 모델 호출은 제한될 수 있습니다.");
    } else if fable_over > 0 {
        hints.push("일부 계정의 Fable 주간 쿼터가 임계치 이상입니다. teamclaude가 다른 계정으로 우회할 여지가 있는지 확인하세요.");
    }
    if current_process_proxy_set {
        hints.push("현재 앱 프로세스에 Anthropic proxy 환경 변수가 설정되어 있습니다. 터미널/앱 재시작이 필요할 수 있습니다.");
    }
    if !default_claude_clears_proxy {
        hints.push(
            "기본 `claude` wrapper가 proxy 환경 변수를 명시적으로 해제하는지 확인이 필요합니다.",
        );
    }

    let port = json_u64(server.and_then(|v| v.get("port"))).or_else(|| {
        json_u64(
            config
                .and_then(|v| v.get("proxy"))
                .and_then(|p| p.get("port")),
        )
    });
    let pid = json_u64(server.and_then(|v| v.get("pid")));
    let started_at = server
        .and_then(|v| v.get("startedAt"))
        .and_then(|v| v.as_str())
        .map(String::from);
    let max_concurrent_per_account =
        json_u64(config.and_then(|v| v.get("maxConcurrentPerAccount")));
    let session_affinity = config
        .and_then(|v| v.get("sessionAffinity"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let fable_avg = if fable_known > 0 {
        Some(round1(fable_sum / fable_known as f64))
    } else {
        None
    };

    serde_json::json!({
        "checkedAt": chrono::Utc::now().to_rfc3339(),
        "overallStatus": overall_status,
        "teamclaude": {
            "config": {
                "present": config.is_some(),
                "accountCount": config_account_count,
                "switchThreshold": threshold,
                "maxConcurrentPerAccount": max_concurrent_per_account,
                "sessionAffinity": session_affinity
            },
            "server": {
                "running": status_reachable,
                "reachable": status_reachable,
                "port": port,
                "pid": pid,
                "startedAt": started_at
            },
            "accounts": {
                "total": total,
                "configured": config_account_count,
                "active": active,
                "throttled": throttled,
                "exhausted": exhausted,
                "error": error,
                "disabled": disabled,
                "inflight": inflight,
                "capacity": capacity
            },
            "quota": {
                "fableWeekly": {
                    "knownAccounts": fable_known,
                    "overThreshold": fable_over,
                    "allOverThreshold": fable_all_over,
                    "minPercent": fable_min.map(round1),
                    "maxPercent": fable_max.map(round1),
                    "avgPercent": fable_avg,
                    "soonestResetAt": fable_soonest_reset.map(ms_to_iso)
                }
            },
            "retryAfterSeconds": retry_after_seconds
        },
        "routing": {
            "currentProcessProxySet": current_process_proxy_set,
            "defaultClaudeClearsProxy": default_claude_clears_proxy,
            "teamclaudeConfigPresent": config.is_some()
        },
        "hints": hints
    })
}

fn fetch_live_teamclaude_status(
    config: Option<&serde_json::Value>,
    server: Option<&serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let port = json_u64(server.and_then(|v| v.get("port")))
        .or_else(|| {
            json_u64(
                config
                    .and_then(|v| v.get("proxy"))
                    .and_then(|p| p.get("port")),
            )
        })
        .ok_or_else(|| "missing port".to_string())?;
    let api_key = config
        .and_then(|v| v.get("proxy"))
        .and_then(|p| p.get("apiKey"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let url = format!("http://127.0.0.1:{}/teamclaude/status", port);

    let mut command = Command::new("curl");
    command.args(["-sS", "--max-time", "3"]);
    if !api_key.is_empty() {
        command.arg("-H").arg(format!("x-api-key: {}", api_key));
    }
    let output = command
        .arg(url)
        .env("PATH", "/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin")
        .output()
        .map_err(|_| "curl unavailable".to_string())?;

    if !output.status.success() {
        return Err("status endpoint unreachable".to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|_| "status JSON parse failed".to_string())
}

fn summarize_teamcodex_pool(
    status: Option<&serde_json::Value>,
    config: Option<&serde_json::Value>,
    server: Option<&serde_json::Value>,
    status_reachable: bool,
) -> serde_json::Value {
    let port = json_u64(server.and_then(|v| v.get("port"))).or_else(|| {
        json_u64(
            config
                .and_then(|v| v.get("proxy"))
                .and_then(|p| p.get("port")),
        )
    });
    let current_account = status
        .and_then(|v| v.get("currentAccount"))
        .and_then(|v| v.as_str());
    let switch_threshold = json_f64(status.and_then(|v| v.get("switchThreshold")))
        .or_else(|| json_f64(config.and_then(|v| v.get("switchThreshold"))))
        .unwrap_or(0.98);

    let live_accounts = status
        .and_then(|v| v.get("accounts"))
        .and_then(|v| v.as_array());
    let configured_accounts = config
        .and_then(|v| v.get("accounts"))
        .and_then(|v| v.as_array());
    let source_accounts = live_accounts.or(configured_accounts);

    let accounts = source_accounts
        .map(|rows| {
            rows.iter()
                .filter_map(|account| {
                    let name = account.get("name")?.as_str()?.trim();
                    if name.is_empty() {
                        return None;
                    }
                    let quota = account.get("quota");
                    let usage = account.get("usage");
                    let input_tokens = json_u64(usage.and_then(|v| v.get("totalInputTokens")))
                        .unwrap_or(0);
                    let output_tokens = json_u64(usage.and_then(|v| v.get("totalOutputTokens")))
                        .unwrap_or(0);

                    Some(serde_json::json!({
                        "name": name,
                        "isCurrent": current_account == Some(name),
                        "enabled": account.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
                        "status": account.get("status").and_then(|v| v.as_str()).unwrap_or("configured"),
                        "sessionPercent": json_f64(quota.and_then(|v| v.get("unified5h"))).map(|v| round1(v * 100.0)),
                        "weeklyPercent": json_f64(quota.and_then(|v| v.get("unified7d"))).map(|v| round1(v * 100.0)),
                        "inflight": json_u64(account.get("inflight")).unwrap_or(0),
                        "maxConcurrent": json_u64(account.get("maxConcurrent")).unwrap_or(0),
                        "totalRequests": json_u64(usage.and_then(|v| v.get("totalRequests"))).unwrap_or(0),
                        "totalTokens": input_tokens + output_tokens
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    serde_json::json!({
        "checkedAt": chrono::Utc::now().to_rfc3339(),
        "serverReachable": status_reachable,
        "serverPort": port,
        "currentAccount": current_account,
        "switchThresholdPercent": round1(switch_threshold * 100.0),
        "accounts": accounts
    })
}

fn fetch_live_teamcodex_status(
    config: Option<&serde_json::Value>,
    server: Option<&serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let port = json_u64(server.and_then(|v| v.get("port")))
        .or_else(|| {
            json_u64(
                config
                    .and_then(|v| v.get("proxy"))
                    .and_then(|p| p.get("port")),
            )
        })
        .ok_or_else(|| "missing port".to_string())?;
    let url = format!("http://127.0.0.1:{}/teamclaude/status", port);
    let output = Command::new("curl")
        .args(["-sS", "--max-time", "3", &url])
        .env("PATH", "/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin")
        .output()
        .map_err(|_| "curl unavailable".to_string())?;

    if !output.status.success() {
        return Err("status endpoint unreachable".to_string());
    }

    serde_json::from_slice(&output.stdout).map_err(|_| "status JSON parse failed".to_string())
}

fn default_claude_wrapper_clears_proxy(home: &PathBuf) -> bool {
    let zshrc = home.join(".zshrc");
    let Ok(content) = fs::read_to_string(zshrc) else {
        return false;
    };
    content.contains("claude()")
        && content.contains("unset ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_BASE_URL")
}

#[tauri::command]
pub async fn fetch_teamclaude_health() -> serde_json::Value {
    let home = home_dir();
    let config = read_json_if_exists(&home.join(".config/teamclaude.json"));
    let server = read_json_if_exists(&home.join(".config/teamclaude.server.json"));
    let live_status = fetch_live_teamclaude_status(config.as_ref(), server.as_ref());
    let current_process_proxy_set = std::env::var("ANTHROPIC_BASE_URL")
        .ok()
        .is_some_and(|v| !v.trim().is_empty())
        || std::env::var("ANTHROPIC_AUTH_TOKEN")
            .ok()
            .is_some_and(|v| !v.trim().is_empty())
        || std::env::var("ANTHROPIC_API_KEY")
            .ok()
            .is_some_and(|v| !v.trim().is_empty());

    summarize_teamclaude_health(
        live_status.as_ref().ok(),
        config.as_ref(),
        server.as_ref(),
        live_status.is_ok(),
        live_status.as_ref().err().map(|s| s.as_str()),
        current_process_proxy_set,
        default_claude_wrapper_clears_proxy(&home),
    )
}

#[tauri::command]
pub async fn fetch_teamcodex_pool() -> serde_json::Value {
    let home = home_dir();
    let config = read_json_if_exists(&home.join(".config/teamcodex.json"));
    let server = read_json_if_exists(&home.join(".config/teamcodex.server.json"));
    let live_status = fetch_live_teamcodex_status(config.as_ref(), server.as_ref());

    summarize_teamcodex_pool(
        live_status.as_ref().ok(),
        config.as_ref(),
        server.as_ref(),
        live_status.is_ok(),
    )
}

/// USD→KRW 환율 조회. open.er-api.com 무료 API(키 불필요)를 curl로 호출.
/// 네트워크/파싱 실패 시 폴백 상수 반환 → 호출부는 항상 유효한 환율을 받는다.
/// curl 사용 이유: ccusage와 동일한 subprocess 패턴 + reqwest 의존성 추가 회피.
#[tauri::command]
pub async fn fetch_usd_krw_rate() -> serde_json::Value {
    const FALLBACK: f64 = 1450.0;
    let now_ms = chrono::Utc::now().timestamp_millis();

    let fallback = |reason: &str| {
        eprintln!("환율 폴백 사용 ({}): {}원", reason, FALLBACK);
        serde_json::json!({ "rate": FALLBACK, "source": "fallback", "fetchedAt": 0 })
    };

    let output = Command::new("curl")
        .args([
            "-s",
            "--max-time",
            "8",
            "https://open.er-api.com/v6/latest/USD",
        ])
        .env("PATH", "/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin")
        .output();

    let stdout = match output {
        Ok(o) if o.status.success() => o.stdout,
        Ok(_) => return fallback("curl 종료코드 ≠ 0"),
        Err(e) => return fallback(&format!("curl 실행 실패: {}", e)),
    };

    let parsed: serde_json::Value = match serde_json::from_slice(&stdout) {
        Ok(v) => v,
        Err(e) => return fallback(&format!("JSON 파싱 실패: {}", e)),
    };

    // result == "success" 확인 (있으면)
    if let Some(result) = parsed.get("result").and_then(|v| v.as_str()) {
        if result != "success" {
            return fallback("API result != success");
        }
    }

    match parsed
        .get("rates")
        .and_then(|r| r.get("KRW"))
        .and_then(|v| v.as_f64())
    {
        Some(krw) if krw > 0.0 => {
            serde_json::json!({ "rate": krw, "source": "live", "fetchedAt": now_ms })
        }
        _ => fallback("KRW 환율 없음"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn teamclaude_health_redacts_account_names_and_secrets() {
        let status = json!({
            "currentAccount": "private@example.com",
            "switchThreshold": 0.98,
            "accounts": [
                {
                    "name": "private@example.com",
                    "type": "oauth",
                    "status": "active",
                    "enabled": true,
                    "quota": {
                        "unified5h": 0.12,
                        "unified7d": 0.44,
                        "modelWeekly": {
                            "7d_oi": { "utilization": 1.01, "reset": 1780000000000.0 }
                        }
                    },
                    "usage": { "totalInputTokens": 12, "totalOutputTokens": 34, "totalRequests": 5 },
                    "inflight": 1,
                    "maxConcurrent": 3,
                    "rateLimitedUntil": null
                },
                {
                    "name": "second-account",
                    "type": "oauth",
                    "status": "active",
                    "enabled": true,
                    "quota": {
                        "modelWeekly": {
                            "7d_oi": { "utilization": 0.42, "reset": 1780000000000.0 }
                        }
                    },
                    "usage": { "totalInputTokens": 1, "totalOutputTokens": 2, "totalRequests": 1 },
                    "inflight": 0,
                    "maxConcurrent": 3,
                    "rateLimitedUntil": null
                }
            ]
        });
        let config = json!({
            "accounts": [{ "name": "private@example.com", "accessToken": "oauth-secret-token" }],
            "proxy": { "port": 3456, "apiKey": "tc-secret-api-key" },
            "switchThreshold": 0.98,
            "maxConcurrentPerAccount": 3,
            "sessionAffinity": true
        });
        let server = json!({ "pid": 1234, "port": 3456, "startedAt": "2026-07-06T08:11:26.845Z" });

        let health = summarize_teamclaude_health(
            Some(&status),
            Some(&config),
            Some(&server),
            true,
            None,
            false,
            false,
        );
        let serialized = serde_json::to_string(&health).expect("health serializes");

        assert_eq!(health["teamclaude"]["accounts"]["total"], 2);
        assert_eq!(health["teamclaude"]["accounts"]["active"], 2);
        assert_eq!(
            health["teamclaude"]["quota"]["fableWeekly"]["knownAccounts"],
            2
        );
        assert_eq!(
            health["teamclaude"]["quota"]["fableWeekly"]["overThreshold"],
            1
        );
        assert_eq!(
            health["teamclaude"]["quota"]["fableWeekly"]["maxPercent"],
            101.0
        );
        assert!(!serialized.contains("private@example.com"));
        assert!(!serialized.contains("second-account"));
        assert!(!serialized.contains("tc-secret-api-key"));
        assert!(!serialized.contains("oauth-secret-token"));
        assert!(!serialized.contains("currentAccount"));
    }

    #[test]
    fn teamclaude_retry_after_uses_binding_window_resets() {
        let accounts = json!([
            {
                "enabled": true,
                "status": "active",
                "rateLimitedUntil": "2026-07-09T00:01:00.000Z",
                "quota": {
                    "unified5h": 0.99,
                    "unified5hReset": 1780000300000.0,
                    "unified7d": 0.50,
                    "unified7dReset": 1780000900000.0
                }
            },
            {
                "enabled": true,
                "status": "active",
                "quota": {
                    "unified5h": 0.20,
                    "unified5hReset": 1780000100000.0
                }
            }
        ]);

        let retry_after = compute_teamclaude_retry_after_seconds(
            accounts.as_array().expect("array"),
            0.98,
            1780000000000,
        );

        assert_eq!(retry_after, Some(60));
    }

    #[test]
    fn teamclaude_unreachable_keeps_safe_degraded_shape() {
        let config = json!({
            "accounts": [{ "name": "private@example.com" }],
            "proxy": { "port": 3456, "apiKey": "tc-secret-api-key" },
            "switchThreshold": 0.98
        });

        let health = summarize_teamclaude_health(
            None,
            Some(&config),
            None,
            false,
            Some("connection refused"),
            true,
            true,
        );
        let serialized = serde_json::to_string(&health).expect("health serializes");

        assert_eq!(health["overallStatus"], "error");
        assert_eq!(health["teamclaude"]["server"]["reachable"], false);
        assert_eq!(health["teamclaude"]["config"]["accountCount"], 1);
        assert_eq!(health["routing"]["currentProcessProxySet"], true);
        assert_eq!(health["routing"]["defaultClaudeClearsProxy"], true);
        assert!(!serialized.contains("private@example.com"));
        assert!(!serialized.contains("tc-secret-api-key"));
        assert!(!serialized.contains("connection refused"));
    }

    #[test]
    fn teamcodex_pool_keeps_account_rows_and_usage() {
        let status = json!({
            "currentAccount": "codex-main",
            "switchThreshold": 0.98,
            "accounts": [
                {
                    "name": "codex-main",
                    "enabled": true,
                    "status": "active",
                    "inflight": 2,
                    "maxConcurrent": 3,
                    "quota": {
                        "unified5h": 0.27,
                        "unified7d": 0.04
                    },
                    "usage": {
                        "totalRequests": 1234,
                        "totalInputTokens": 500,
                        "totalOutputTokens": 250
                    }
                }
            ]
        });
        let config = json!({
            "accounts": [{ "name": "codex-main" }],
            "proxy": { "port": 3457 },
            "switchThreshold": 0.98
        });
        let server = json!({ "pid": 4321, "port": 3457 });

        let pool = summarize_teamcodex_pool(Some(&status), Some(&config), Some(&server), true);

        assert_eq!(pool["serverReachable"], true);
        assert_eq!(pool["serverPort"], 3457);
        assert_eq!(pool["currentAccount"], "codex-main");
        assert_eq!(pool["switchThresholdPercent"], 98.0);
        assert_eq!(pool["accounts"][0]["isCurrent"], true);
        assert_eq!(pool["accounts"][0]["sessionPercent"], 27.0);
        assert_eq!(pool["accounts"][0]["weeklyPercent"], 4.0);
        assert_eq!(pool["accounts"][0]["inflight"], 2);
        assert_eq!(pool["accounts"][0]["totalRequests"], 1234);
        assert_eq!(pool["accounts"][0]["totalTokens"], 750);
    }

    #[test]
    fn teamcodex_pool_keeps_configured_accounts_when_server_is_offline() {
        let config = json!({
            "accounts": [
                { "name": "codex-main", "enabled": true },
                { "name": "codex-backup", "enabled": false }
            ],
            "proxy": { "port": 3457 }
        });

        let pool = summarize_teamcodex_pool(None, Some(&config), None, false);

        assert_eq!(pool["serverReachable"], false);
        assert_eq!(pool["accounts"].as_array().map(Vec::len), Some(2));
        assert_eq!(pool["accounts"][0]["status"], "configured");
        assert_eq!(pool["accounts"][1]["enabled"], false);
    }
}
