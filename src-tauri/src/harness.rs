use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Manager;

const PROVIDERS: [&str; 4] = ["claude", "codex", "grok", "antigravity"];
const MAX_BYTES: u64 = 16 * 1024 * 1024;
const SCAN_TIMEOUT: Duration = Duration::from_secs(30);
static NEXT_TEMP: AtomicU64 = AtomicU64::new(0);

#[tauri::command]
pub async fn open_ax_contact() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/open")
            .arg("https://qjc.app/contact?utm_source=harness_demo&utm_medium=product&utm_campaign=ax_showcase")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|_| "브라우저를 열지 못했습니다.".to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err("브라우저를 열지 못했습니다.".into())
        }
    }
    #[cfg(not(target_os = "macos"))]
    Err("브라우저에서 qjc.app/contact를 열어 주세요.".into())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Inventory {
    schema_version: u8,
    generation: String,
    scope: String,
    scan_started_at: String,
    checked_at: String,
    mode: String,
    providers: Vec<Provider>,
    resources: Vec<Resource>,
    bindings: Vec<Binding>,
    relations: Vec<Relation>,
    diagnostics: Vec<Diagnostic>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Provider {
    id: String,
    installed: String,
    configured: bool,
    running: String,
    status: String,
    checked_at: String,
    last_success_at: Option<String>,
    duration_ms: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Resource {
    id: String,
    kind: String,
    name: String,
    description: String,
    source_ref: String,
    canonical_identity: String,
    origin: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Binding {
    provider_id: String,
    resource_id: String,
    scope: String,
    enabled_state: String,
    precedence: f64,
    evidence: String,
    observed_at: String,
    reason: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Relation {
    from: String,
    to: String,
    kind: String,
    provenance: String,
    evidence: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Diagnostic {
    provider_id: String,
    source: String,
    code: String,
    message: String,
}

#[derive(Default)]
struct ScopeScan {
    finished_at: Option<Instant>,
    result: Option<Inventory>,
}

type ScanRegistry = Mutex<BTreeMap<PathBuf, Arc<Mutex<ScopeScan>>>>;
static SCANS: OnceLock<ScanRegistry> = OnceLock::new();

fn valid_timestamp(value: &str) -> bool {
    chrono::DateTime::parse_from_rfc3339(value).is_ok()
}

fn validate(value: &Inventory, scope: &str) -> bool {
    let ids: HashSet<&str> = value.resources.iter().map(|r| r.id.as_str()).collect();
    let providers: HashSet<&str> = value.providers.iter().map(|p| p.id.as_str()).collect();
    value.schema_version == 1
        && value.mode == "local"
        && value.scope == scope
        && !value.generation.is_empty()
        && valid_timestamp(&value.scan_started_at)
        && valid_timestamp(&value.checked_at)
        && value.providers.len() == 4
        && providers == HashSet::from(PROVIDERS)
        && ids.len() == value.resources.len()
        && value.resources.len() <= 50_000
        && value.bindings.len() <= 200_000
        && value.providers.iter().all(|p| {
            ["yes", "no", "unknown"].contains(&p.installed.as_str())
                && ["observed", "not-observed", "unknown"].contains(&p.running.as_str())
                && ["ok", "partial", "error", "stale"].contains(&p.status.as_str())
                && valid_timestamp(&p.checked_at)
                && p.last_success_at
                    .as_ref()
                    .is_none_or(|s| valid_timestamp(s))
        })
        && value.resources.iter().all(|r| {
            !r.id.is_empty()
                && [
                    "agent", "skill", "rule", "hook", "mcp", "workflow", "plugin",
                ]
                .contains(&r.kind.as_str())
                && r.name.chars().count() <= 200
                && r.description.chars().count() <= 400
        })
        && value.bindings.iter().all(|b| {
            PROVIDERS.contains(&b.provider_id.as_str())
                && ids.contains(b.resource_id.as_str())
                && ["global", "project", "shared"].contains(&b.scope.as_str())
                && ["enabled", "disabled", "shadowed", "unknown"]
                    .contains(&b.enabled_state.as_str())
                && ["confirmed", "configured", "unresolved"].contains(&b.evidence.as_str())
                && b.precedence.is_finite()
                && valid_timestamp(&b.observed_at)
                && b.reason.chars().count() <= 400
        })
        && value.relations.iter().all(|r| {
            ["configured", "observed"].contains(&r.provenance.as_str())
                && (ids.contains(r.from.as_str()) || PROVIDERS.contains(&r.from.as_str()))
                && (ids.contains(r.to.as_str()) || PROVIDERS.contains(&r.to.as_str()))
        })
        && value.diagnostics.iter().all(|d| {
            PROVIDERS.contains(&d.provider_id.as_str())
                && [
                    "missing",
                    "permission-denied",
                    "malformed",
                    "unsupported",
                    "stale",
                    "limit",
                ]
                .contains(&d.code.as_str())
                && d.message.chars().count() <= 400
        })
}

fn read_inventory(path: &Path, scope: &str) -> Option<Inventory> {
    let file = File::open(path).ok()?;
    if !file.metadata().ok()?.is_file() || file.metadata().ok()?.len() > MAX_BYTES {
        return None;
    }
    let mut bytes = Vec::new();
    file.take(MAX_BYTES + 1).read_to_end(&mut bytes).ok()?;
    if bytes.len() as u64 > MAX_BYTES {
        return None;
    }
    let value: Inventory = serde_json::from_slice(&bytes).ok()?;
    validate(&value, scope).then_some(value)
}

fn normalize_project(project: Option<String>) -> Result<Option<PathBuf>, String> {
    project
        .map(|raw| {
            let path = PathBuf::from(raw);
            if !path.is_absolute() {
                return Err("프로젝트는 절대 경로로 선택해 주세요.".into());
            }
            let canonical = path
                .canonicalize()
                .map_err(|_| "프로젝트 폴더를 읽을 수 없습니다.")?;
            if !canonical.is_dir() || canonical.to_str().is_none() {
                return Err("유효한 프로젝트 폴더를 선택해 주세요.".into());
            }
            Ok(canonical)
        })
        .transpose()
}

fn cache_name(scope: &str) -> String {
    // 캐시를 읽을 때 원본 scope도 검증하므로 해시 충돌로 다른 프로젝트를 반환하지 않는다.
    let hash = scope.bytes().fold(0xcbf29ce484222325_u64, |hash, b| {
        (hash ^ u64::from(b)).wrapping_mul(0x100000001b3)
    });
    format!("inventory-v1-{hash:016x}.json")
}

fn private_directory(path: &Path) -> std::io::Result<()> {
    fs::create_dir_all(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn private_file(path: &Path) -> std::io::Result<File> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    options.open(path)
}

struct ScanFiles(PathBuf);

impl ScanFiles {
    fn new(directory: &Path) -> std::io::Result<Self> {
        let name = format!(
            "scan-{}-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_micros(),
            NEXT_TEMP.fetch_add(1, Ordering::Relaxed)
        );
        let path = directory.join(name);
        fs::create_dir(&path)?;
        private_directory(&path)?;
        Ok(Self(path))
    }
}

impl Drop for ScanFiles {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn write_cache(path: &Path, inventory: &Inventory) -> std::io::Result<()> {
    let parent = path.parent().ok_or(std::io::ErrorKind::InvalidInput)?;
    let files = ScanFiles::new(parent)?;
    let temp = files.0.join("inventory.json");
    let mut output = private_file(&temp)?;
    serde_json::to_writer(&mut output, inventory)?;
    output.flush()?;
    output.sync_all()?;
    fs::rename(temp, path)
}

fn scan_path(home: &Path) -> std::ffi::OsString {
    let mut paths: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|value| std::env::split_paths(&value).collect())
        .unwrap_or_default();
    paths.extend([
        home.join(".local/share/fnm/aliases/default/bin"),
        home.join("Library/Application Support/fnm/aliases/default/bin"),
        home.join(".local/bin"),
        home.join(".npm-global/bin"),
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
    ]);
    std::env::join_paths(paths).unwrap_or_else(|_| "/usr/bin:/bin".into())
}

fn node_path(path: &std::ffi::OsStr) -> Option<PathBuf> {
    std::env::split_paths(path)
        .map(|root| root.join("node"))
        .filter_map(|candidate| candidate.canonicalize().ok())
        .find(|candidate| {
            if !candidate.is_file() {
                return false;
            }
            let mut prefix = [0; 2];
            if File::open(candidate)
                .and_then(|mut file| file.read_exact(&mut prefix))
                .is_err()
                || prefix == *b"#!"
            {
                return false;
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                candidate
                    .metadata()
                    .is_ok_and(|meta| meta.permissions().mode() & 0o111 != 0)
            }
            #[cfg(not(unix))]
            {
                true
            }
        })
}

fn run_scanner(
    script: &Path,
    project: Option<&Path>,
    home: &Path,
    directory: &Path,
    timeout: Duration,
) -> Result<Inventory, &'static str> {
    if !script.is_file() {
        return Err("하네스 수집기가 없습니다. 앱을 다시 빌드해 주세요.");
    }
    let path = scan_path(home);
    let node = node_path(&path).ok_or("하네스 수집에 Node.js가 필요합니다.")?;
    let files = ScanFiles::new(directory).map_err(|_| "수집용 임시 폴더를 만들 수 없습니다.")?;
    let output = files.0.join("inventory.json");
    let mut command = Command::new(node);
    command
        .arg(script)
        .arg("--output")
        .arg(&output)
        .current_dir(home)
        .env_clear()
        .env("HOME", home)
        .env("PATH", path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    if let Some(project) = project {
        command.arg("--project").arg(project);
    }
    let mut child = command
        .spawn()
        .map_err(|_| "하네스 수집기를 실행할 수 없습니다.")?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(_)) => {
                return Err("하네스 수집이 실패했습니다. 원본 설정은 변경하지 않았습니다.")
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("하네스 수집 프로세스 상태를 확인할 수 없습니다.");
            }
            Ok(None) if started.elapsed() >= timeout => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("하네스 수집 시간이 30초를 넘었습니다. 다시 수집해 주세요.");
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
    let scope = project.and_then(Path::to_str).unwrap_or("global");
    read_inventory(&output, scope).ok_or("수집 결과의 형식 또는 범위가 올바르지 않습니다.")
}

fn diagnostic(provider_id: &str, message: &str, code: &str) -> Diagnostic {
    Diagnostic {
        provider_id: provider_id.into(),
        source: "harness-scanner".into(),
        code: code.into(),
        message: message.into(),
    }
}

fn failed_inventory(scope: &str, previous: Option<&Inventory>, message: &str) -> Inventory {
    let now = chrono::Utc::now().to_rfc3339();
    let mut inventory = previous.cloned().unwrap_or_else(|| Inventory {
        schema_version: 1,
        generation: format!("unobserved-{now}"),
        scope: scope.into(),
        scan_started_at: now.clone(),
        checked_at: now.clone(),
        mode: "local".into(),
        providers: PROVIDERS
            .iter()
            .map(|id| Provider {
                id: (*id).into(),
                installed: "unknown".into(),
                configured: false,
                running: "unknown".into(),
                status: "error".into(),
                checked_at: now.clone(),
                last_success_at: None,
                duration_ms: 0,
            })
            .collect(),
        resources: Vec::new(),
        bindings: Vec::new(),
        relations: Vec::new(),
        diagnostics: Vec::new(),
    });
    inventory
        .diagnostics
        .retain(|d| d.source != "harness-scanner");
    for provider in &mut inventory.providers {
        provider.status = if provider.last_success_at.is_some() {
            "stale"
        } else {
            "error"
        }
        .into();
        provider.running = "unknown".into();
        provider.checked_at = now.clone();
        inventory
            .diagnostics
            .push(diagnostic(&provider.id, message, "stale"));
    }
    inventory
}

fn preserve_failed_providers(mut current: Inventory, previous: Option<&Inventory>) -> Inventory {
    let Some(previous) = previous else {
        return current;
    };
    for provider in &mut current.providers {
        if provider.status != "error" {
            continue;
        }
        let Some(old) = previous
            .providers
            .iter()
            .find(|p| p.id == provider.id && p.last_success_at.is_some())
        else {
            continue;
        };
        provider.status = "stale".into();
        provider.configured = old.configured;
        provider.running = "unknown".into();
        provider.last_success_at = old.last_success_at.clone();
        current.bindings.retain(|b| b.provider_id != provider.id);
        current
            .relations
            .retain(|r| r.from != provider.id && r.to != provider.id);
        current.bindings.extend(
            previous
                .bindings
                .iter()
                .filter(|b| b.provider_id == provider.id)
                .cloned(),
        );
        current.diagnostics.push(diagnostic(
            &provider.id,
            "수집 실패로 마지막 성공 시점의 구성을 표시합니다.",
            "stale",
        ));
    }
    let used: HashSet<String> = current
        .bindings
        .iter()
        .map(|b| b.resource_id.clone())
        .collect();
    current.resources.retain(|r| used.contains(&r.id));
    let existing: HashSet<String> = current.resources.iter().map(|r| r.id.clone()).collect();
    current.resources.extend(
        previous
            .resources
            .iter()
            .filter(|r| used.contains(&r.id) && !existing.contains(&r.id))
            .cloned(),
    );
    current.relations.retain(|r| {
        (used.contains(&r.from) || PROVIDERS.contains(&r.from.as_str()))
            && (used.contains(&r.to) || PROVIDERS.contains(&r.to.as_str()))
    });
    // 이전 실행 관계는 재사용하지 않고, 보존된 binding의 설정 관계만 복원한다.
    let mut relation_pairs: HashSet<(String, String)> = current
        .relations
        .iter()
        .map(|r| (r.from.clone(), r.to.clone()))
        .collect();
    for binding in &current.bindings {
        if relation_pairs.insert((binding.provider_id.clone(), binding.resource_id.clone())) {
            current.relations.push(Relation {
                from: binding.provider_id.clone(),
                to: binding.resource_id.clone(),
                kind: "binding".into(),
                provenance: "configured".into(),
                evidence: binding.reason.clone(),
            });
        }
    }
    current
}

fn load_inventory(
    cache_dir: &Path,
    script: &Path,
    home: &Path,
    project: Option<&Path>,
    refresh: bool,
    requested_at: Instant,
) -> Result<Inventory, String> {
    let scope = project.and_then(Path::to_str).unwrap_or("global");
    let cache = cache_dir.join(cache_name(scope));
    let slot = {
        let mut registry = SCANS
            .get_or_init(|| Mutex::new(BTreeMap::new()))
            .lock()
            .map_err(|_| "하네스 수집 잠금이 해제되지 않았습니다.")?;
        registry.entry(cache.clone()).or_default().clone()
    };
    // 같은 scope의 실행을 직렬화하고, 대기 중 완료된 요청은 동일한 generation을 공유한다.
    let mut slot = slot
        .lock()
        .map_err(|_| "하네스 수집 잠금이 해제되지 않았습니다.")?;
    if slot
        .finished_at
        .is_some_and(|finished| finished >= requested_at)
    {
        if let Some(result) = &slot.result {
            if result.scope == scope {
                return Ok(result.clone());
            }
        }
    }
    let previous = slot
        .result
        .clone()
        .filter(|inventory| inventory.scope == scope)
        .or_else(|| read_inventory(&cache, scope));
    if !refresh {
        if let Some(value) = &previous {
            let age = chrono::DateTime::parse_from_rfc3339(&value.checked_at)
                .ok()
                .map(|time| chrono::Utc::now().signed_duration_since(time).num_seconds());
            if age.is_some_and(|seconds| (0..60).contains(&seconds)) {
                return Ok(value.clone());
            }
        }
    }
    let result = match private_directory(cache_dir) {
        Err(_) => failed_inventory(
            scope,
            previous.as_ref(),
            "하네스 캐시 폴더에 접근할 수 없습니다.",
        ),
        Ok(()) => match run_scanner(script, project, home, cache_dir, SCAN_TIMEOUT) {
            Err(message) => failed_inventory(scope, previous.as_ref(), message),
            Ok(inventory) => {
                let mut inventory = preserve_failed_providers(inventory, previous.as_ref());
                if write_cache(&cache, &inventory).is_err() {
                    for id in PROVIDERS {
                        inventory.diagnostics.push(diagnostic(
                            id,
                            "관측 결과를 캐시에 저장하지 못했습니다.",
                            "permission-denied",
                        ));
                    }
                }
                inventory
            }
        },
    };
    slot.finished_at = Some(Instant::now());
    slot.result = Some(result.clone());
    Ok(result)
}

#[tauri::command]
pub async fn load_harness_inventory(
    app: tauri::AppHandle,
    project: Option<String>,
    refresh: Option<bool>,
) -> Result<Inventory, String> {
    let requested_at = Instant::now();
    let cache = app
        .path()
        .app_data_dir()
        .map_err(|_| "하네스 캐시 경로를 찾을 수 없습니다.")?
        .join("harness-v1");
    let bundled = app
        .path()
        .resource_dir()
        .ok()
        .map(|dir| dir.join("harness-scanner.cjs"));
    let script = bundled.filter(|path| path.is_file()).unwrap_or_else(|| {
        if cfg!(debug_assertions) {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/harness-scanner.cjs")
        } else {
            PathBuf::new()
        }
    });
    let home = dirs::home_dir().ok_or("사용자 홈 폴더를 찾을 수 없습니다.")?;
    tauri::async_runtime::spawn_blocking(move || {
        let project = normalize_project(project)?;
        load_inventory(
            &cache,
            &script,
            &home,
            project.as_deref(),
            refresh.unwrap_or(false),
            requested_at,
        )
    })
    .await
    .map_err(|_| "하네스 수집 작업이 중단되었습니다.")?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(scope: &str) -> Inventory {
        let mut inventory = failed_inventory(scope, None, "fixture");
        inventory.generation = "fixture-v1".into();
        inventory.diagnostics.clear();
        for p in &mut inventory.providers {
            p.status = "ok".into();
            p.installed = "yes".into();
            p.configured = true;
            p.last_success_at = Some(inventory.checked_at.clone());
        }
        inventory.resources.push(Resource {
            id: "shared-skill".into(),
            kind: "skill".into(),
            name: "Fixture skill".into(),
            description: "Test only".into(),
            source_ref: "/fixture/SKILL.md".into(),
            canonical_identity: "/fixture/SKILL.md".into(),
            origin: "fixture".into(),
        });
        for id in ["claude", "codex"] {
            inventory.bindings.push(Binding {
                provider_id: id.into(),
                resource_id: "shared-skill".into(),
                scope: "shared".into(),
                enabled_state: "unknown".into(),
                precedence: 1.0,
                evidence: "unresolved".into(),
                observed_at: inventory.checked_at.clone(),
                reason: "fixture".into(),
            });
        }
        inventory
    }

    fn fixture_script(directory: &Path, inventory: &Inventory, delay_ms: u64) -> PathBuf {
        let file = directory.join("fixture.cjs");
        let script = format!(
            "const fs = require('node:fs');\nconst args = process.argv.slice(2);\nconst output = args[args.indexOf('--output') + 1];\nif (fs.existsSync(output)) process.exit(24);\nconst allowedEnv = process.platform === 'darwin' ? ['HOME', 'PATH', '__CF_USER_TEXT_ENCODING'] : ['HOME', 'PATH'];\nif (Object.keys(process.env).some(key => !allowedEnv.includes(key))) process.exit(23);\nprocess.stdout.write('x'.repeat(256000));\nprocess.stderr.write('x'.repeat(256000));\nsetTimeout(() => fs.writeFileSync(output, JSON.stringify({}), {{ mode: 0o600, flag: 'wx' }}), {});\n",
            serde_json::to_string(inventory).unwrap(), delay_ms,
        );
        fs::write(&file, script).unwrap();
        file
    }

    #[test]
    fn validates_scope_references_and_metadata_boundary() {
        let mut inventory = sample("global");
        assert!(validate(&inventory, "global"));
        assert!(!validate(&inventory, "/another/project"));
        inventory.bindings[0].resource_id = "missing-resource".into();
        assert!(!validate(&inventory, "global"));
        let mut raw = serde_json::to_value(sample("global")).unwrap();
        raw["resources"][0]["env"] = serde_json::json!({ "TOKEN": "sentinel" });
        assert!(serde_json::from_value::<Inventory>(raw).is_err());
    }

    #[test]
    fn cache_is_private_atomic_and_scope_specific() {
        let temp = ScanFiles::new(&std::env::temp_dir()).unwrap();
        let cache = temp.0.join(cache_name("global"));
        let mut inventory = sample("global");
        write_cache(&cache, &inventory).unwrap();
        assert!(read_inventory(&cache, "/other/project").is_none());
        assert_ne!(cache_name("global"), cache_name("/other/project"));
        inventory.generation = "fixture-v2".into();
        write_cache(&cache, &inventory).unwrap();
        assert_eq!(
            read_inventory(&cache, "global").unwrap().generation,
            "fixture-v2"
        );
        assert_eq!(fs::read_dir(&temp.0).unwrap().count(), 1);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                cache.metadata().unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
    }

    #[test]
    fn failed_provider_preserves_shared_resource_without_duplicate() {
        let previous = sample("global");
        let mut current = sample("global");
        current.generation = "fixture-v2".into();
        current.providers[0].status = "error".into();
        current.providers[0].last_success_at = None;
        current.bindings.retain(|b| b.provider_id != "claude");
        current.relations.push(Relation {
            from: "claude".into(),
            to: "shared-skill".into(),
            kind: "binding".into(),
            provenance: "observed".into(),
            evidence: "failed-scan-ghost".into(),
        });
        let merged = preserve_failed_providers(current, Some(&previous));
        assert!(validate(&merged, "global"));
        assert_eq!(merged.resources.len(), 1);
        assert_eq!(merged.bindings.len(), 2);
        assert_eq!(merged.providers[0].status, "stale");
        assert_eq!(merged.providers[1].status, "ok");
        assert_eq!(
            merged.providers[0].last_success_at,
            previous.providers[0].last_success_at
        );
        assert_eq!(merged.providers[0].running, "unknown");
        assert!(merged
            .relations
            .iter()
            .all(|r| r.evidence != "failed-scan-ghost" && r.provenance != "observed"));
    }

    #[test]
    fn failed_scan_keeps_generation_and_clears_running_observation() {
        let previous = sample("global");
        let failed = failed_inventory("global", Some(&previous), "scan-timeout");
        assert!(validate(&failed, "global"));
        assert_eq!(failed.generation, previous.generation);
        assert_eq!(failed.checked_at, previous.checked_at);
        assert!(failed
            .providers
            .iter()
            .all(|p| p.status == "stale" && p.running == "unknown"));
        assert_eq!(failed.bindings.len(), previous.bindings.len());
        let fresh = failed_inventory("global", None, "node-missing");
        assert!(validate(&fresh, "global"));
        assert!(fresh
            .providers
            .iter()
            .all(|p| p.status == "error" && p.last_success_at.is_none()));
    }

    #[test]
    fn scanner_uses_file_output_and_times_out_with_cleanup() {
        let temp = ScanFiles::new(&std::env::temp_dir()).unwrap();
        let home = dirs::home_dir().unwrap();
        let script = fixture_script(&temp.0, &sample("global"), 0);
        let result = run_scanner(&script, None, &home, &temp.0, Duration::from_secs(10)).unwrap();
        assert!(validate(&result, "global"));
        fixture_script(&temp.0, &sample("global"), 10_000);
        let started = Instant::now();
        assert!(run_scanner(&script, None, &home, &temp.0, Duration::from_millis(200)).is_err());
        assert!(started.elapsed() < Duration::from_secs(5));
        assert_eq!(fs::read_dir(&temp.0).unwrap().count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn node_lookup_resolves_symlinks_and_skips_shell_wrappers() {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let temp = ScanFiles::new(&std::env::temp_dir()).unwrap();
        let actual = node_path(&scan_path(&dirs::home_dir().unwrap())).unwrap();
        let shim_dir = temp.0.join("shim");
        let binary_dir = temp.0.join("binary");
        fs::create_dir(&shim_dir).unwrap();
        fs::create_dir(&binary_dir).unwrap();
        let shim = shim_dir.join("node");
        fs::write(&shim, "#!/bin/sh\nexit 23\n").unwrap();
        fs::set_permissions(&shim, fs::Permissions::from_mode(0o700)).unwrap();
        symlink(&actual, binary_dir.join("node")).unwrap();
        let lookup = std::env::join_paths([shim_dir, binary_dir]).unwrap();
        assert_eq!(node_path(&lookup), Some(actual.clone()));
        assert_eq!(actual.canonicalize().unwrap(), actual);
    }

    #[test]
    fn overlapping_refresh_requests_share_one_completed_generation() {
        let temp = ScanFiles::new(&std::env::temp_dir()).unwrap();
        let home = dirs::home_dir().unwrap();
        let script = fixture_script(&temp.0, &sample("global"), 0);
        let requested = Instant::now();
        let first = load_inventory(&temp.0, &script, &home, None, true, requested).unwrap();
        fs::remove_file(&script).unwrap();
        let overlapping = load_inventory(&temp.0, &script, &home, None, true, requested).unwrap();
        assert_eq!(overlapping.generation, first.generation);
        assert!(overlapping.diagnostics.is_empty());
        let subsequent =
            load_inventory(&temp.0, &script, &home, None, true, Instant::now()).unwrap();
        assert!(subsequent.providers.iter().all(|p| p.status == "stale"));
    }

    #[test]
    fn selected_project_requires_an_absolute_directory() {
        assert!(normalize_project(Some("relative/project".into())).is_err());
        let temp = ScanFiles::new(&std::env::temp_dir()).unwrap();
        let canonical = temp.0.canonicalize().unwrap();
        assert_eq!(
            normalize_project(Some(temp.0.to_str().unwrap().into())).unwrap(),
            Some(canonical)
        );
    }

    #[test]
    #[ignore = "로컬 PC 하네스를 읽는 수동 통합 QA"]
    fn bundled_scanner_reads_actual_pc_through_runtime() {
        let temp = ScanFiles::new(&std::env::temp_dir()).unwrap();
        let home = dirs::home_dir().unwrap();
        let script =
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/harness-scanner.cjs");
        let inventory = run_scanner(&script, None, &home, &temp.0, SCAN_TIMEOUT).unwrap();
        assert!(validate(&inventory, "global"));
        assert_eq!(inventory.providers.len(), 4);
        assert!(inventory.providers.iter().all(|p| p.status != "error"));
        eprintln!(
            "runtime QA: providers={}, resources={}, bindings={}",
            inventory.providers.len(),
            inventory.resources.len(),
            inventory.bindings.len()
        );
    }
}
