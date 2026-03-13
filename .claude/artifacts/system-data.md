# 시스템 데이터 레퍼런스 (팀원 참조용)

## 에이전트 목록 (32개)

| ID | Name | Model | Color | Category | MaxTurns | Tools수 | Memory |
|----|------|-------|-------|----------|----------|---------|--------|
| ad-compass | ad-compass | sonnet | green | marketing | 15 | 5 | project |
| ad-optimizer-team | ad-optimizer-team | opus | green | marketing | 25 | 6 | project |
| ad-scout-google | ad-scout-google | sonnet | green | marketing | 15 | 5 | project |
| ad-scout-meta | ad-scout-meta | sonnet | green | marketing | 15 | 5 | project |
| architect | architect | opus | blue | development | 20 | 4 | project |
| build-error-resolver | build-error-resolver | sonnet | cyan | development | 15 | 6 | project |
| code-reviewer | code-reviewer | opus | blue | review | 15 | 4 | project |
| codex-reviewer | codex-reviewer | sonnet | blue | review | 15 | 4 | project |
| contract-legal | contract-legal | opus | yellow | legal | 30 | 7 | project |
| copywriting | copywriting | opus | magenta | creative | 25 | 6 | user |
| database-reviewer | database-reviewer | sonnet | blue | review | 15 | 4 | project |
| doc-updater | doc-updater | sonnet | yellow | operations | 15 | 6 | project |
| e2e-runner | e2e-runner | sonnet | cyan | development | 20 | 6 | project |
| email-action-team | email-action-team | opus | green | operations | 30 | 4 | project |
| financial-accountant | financial-accountant | opus | yellow | business | 30 | 7 | project |
| gemini-reviewer | gemini-reviewer | sonnet | blue | review | 15 | 4 | project |
| patent-attorney | patent-attorney | opus | yellow | legal | 30 | 7 | project |
| performance-growth-marketer | performance-growth-marketer | opus | green | marketing | 25 | 5 | project |
| planner | planner | opus | blue | development | 20 | 5 | project |
| product-strategist | product-strategist | opus | blue | business | 30 | 8 | project |
| qjc-business | qjc-business | opus | green | business | 25 | 6 | user |
| qjc-content | qjc-content | sonnet | green | creative | 25 | 5 | user |
| qjc-operations | qjc-operations | sonnet | green | operations | 25 | 6 | user |
| quotation | quotation | opus | yellow | business | 30 | 6 | user |
| refactor-cleaner | refactor-cleaner | sonnet | yellow | development | 20 | 6 | project |
| remotion-creator | remotion-creator | sonnet | cyan | creative | 30 | 6 | project |
| researcher | researcher | sonnet | magenta | research | 15 | 8 | project |
| security-reviewer | security-reviewer | opus | red | review | 15 | 4 | project |
| seo-geo-aeo-strategist | seo-geo-aeo-strategist | opus | cyan | marketing | 25 | 5 | project |
| tdd-guide | tdd-guide | opus | cyan | development | 20 | 6 | project |
| verify-agent | verify-agent | sonnet | cyan | development | 10 | 6 | project |
| web-designer | web-designer | sonnet | magenta | creative | 20 | 6 | project |

## 카테고리 → 색상 매핑 (노드 그래프용)

| Category | 표시색 | 에이전트 수 |
|----------|--------|------------|
| development | #3b82f6 (blue) | 7 (architect, build-error-resolver, e2e-runner, planner, refactor-cleaner, tdd-guide, verify-agent) |
| review | #6366f1 (indigo) | 5 (code-reviewer, codex-reviewer, database-reviewer, gemini-reviewer, security-reviewer) |
| business | #10b981 (emerald) | 4 (financial-accountant, product-strategist, qjc-business, quotation) |
| marketing | #22c55e (green) | 5 (ad-compass, ad-optimizer-team, ad-scout-google, ad-scout-meta, performance-growth-marketer, seo-geo-aeo-strategist) |
| creative | #ec4899 (pink) | 3 (copywriting, qjc-content, remotion-creator, web-designer) |
| research | #a855f7 (purple) | 1 (researcher) |
| legal | #eab308 (yellow) | 2 (contract-legal, patent-attorney) |
| operations | #f97316 (orange) | 3 (doc-updater, email-action-team, qjc-operations) |

## 파이프라인 (edges)

### 1. 설계/구현
planner → architect → tdd-guide → code-reviewer

### 2. 코드리뷰
code-reviewer → security-reviewer (조건부: 보안 민감)
code-reviewer → database-reviewer (조건부: DB 변경)
code-reviewer → codex-reviewer (옵션)
code-reviewer → gemini-reviewer (옵션)

### 3. 검증
build-error-resolver → tdd-guide → verify-agent

### 4. 비즈니스
qjc-business → quotation (조건부)
qjc-business → qjc-operations
qjc-business → qjc-content
qjc-business → performance-growth-marketer (조건부)
performance-growth-marketer → ad-optimizer-team

### 5. 콘텐츠/마케팅
copywriting → qjc-content (조건부)
copywriting → web-designer (조건부)

### 6. 이메일
email-action-team → qjc-business (조건부)
email-action-team → qjc-operations (조건부)

### 7. SEO
seo-geo-aeo-strategist → researcher (조건부)
seo-geo-aeo-strategist → copywriting (조건부)
seo-geo-aeo-strategist → web-designer (조건부)

### 8. 기획
product-strategist → researcher (조건부)
product-strategist → planner

### 9. 재무
financial-accountant → researcher (조건부)
financial-accountant → qjc-operations (조건부)

### 10. 법무
contract-legal → researcher (조건부)
contract-legal → patent-attorney (조건부)
contract-legal → qjc-business (조건부)

### 11. 광고 최적화
ad-optimizer-team → ad-scout-google
ad-optimizer-team → ad-scout-meta
ad-optimizer-team → ad-compass

## 훅 (20개, 11 이벤트 타입)

| Event | Matcher | Async |
|-------|---------|-------|
| PreToolUse | Bash | sync |
| PreToolUse | mcp__gmail__send_email | sync |
| PreToolUse | mcp__supabase__(execute_sql\|apply_migration) | sync |
| PreToolUse | mcp__(meta-ads-mcp\|google-ads-mcp)__* | sync |
| PreToolUse | mcp__playwright__browser_run_code | sync |
| PreToolUse | mcp__* | sync |
| PreToolUse | Write\|Edit | sync |
| SessionStart | ALL | sync |
| UserPromptSubmit | ALL | sync |
| PostToolUse | ALL | sync |
| PostToolUse | Bash\|Read\|Grep\|mcp__.* | sync |
| PostToolUse | Bash | sync |
| PostToolUse | Edit\|Write | sync |
| Stop | ALL | sync |
| SessionEnd | ALL | sync |
| TaskCompleted | ALL | sync |
| Notification | idle_prompt\|permission_prompt | sync |
| PreCompact | ALL | sync |
| SubagentStop | ALL | sync |
| TeammateIdle | ALL | sync |

## Rules 파일 (27개)

경로: ~/qjc-office/dotclaude/rules/

| 파일 | 우선도 |
|------|--------|
| golden-principles.md | CRITICAL |
| interaction.md | CRITICAL |
| verification.md | CRITICAL |
| agents-v2.md | IMPORTANT |
| coding-style.md | IMPORTANT |
| git-workflow-v2.md | IMPORTANT |
| gws.md | IMPORTANT |
| image-generation.md | IMPORTANT |
| planning.md | IMPORTANT |
| ralph-loop.md | IMPORTANT |
| receiving-review.md | IMPORTANT |
| scrapling.md | IMPORTANT |
| seo-geo-aeo.md | IMPORTANT |
| session.md | IMPORTANT |
| contract-legal.md | NORMAL |
| document-production.md | NORMAL |
| email.md | NORMAL |
| esign.md | NORMAL |
| financial-accountant.md | NORMAL |
| patent-attorney.md | NORMAL |
| performance-marketing.md | NORMAL |
| personal-os.md | NORMAL |
| qjc-auto.md | NORMAL |
| quotation.md | NORMAL |
| remotion.md | NORMAL |
| supabase-mcp.md | NORMAL |
| youtube-subtitle.md | NORMAL |

## 메모리 시스템

| 유형 | 경로 |
|------|------|
| Auto Memory | ~/.claude/projects/-Users-sangrok/memory/ |
| Agent Memory | ~/.claude/agent-memory/{agent-name}/ |
| Personal OS | ~/qjc-office/personal-os/ |

## 데이터 소스 파일 경로

| 데이터 | 경로 |
|--------|------|
| 에이전트 정의 | ~/.claude/agents/*.md (YAML frontmatter) |
| 훅 설정 | ~/.claude/settings.json → hooks 섹션 |
| Rules | ~/qjc-office/dotclaude/rules/*.md |
| 파이프라인 | ~/qjc-office/dotclaude/reference/agent-pipeline.md |
| 세션 로그 | ~/.claude/work-log/session-summary-*.json |
| MCP 설정 | 프로젝트별 .claude/settings.json → mcpServers |
| 권한 | ~/.claude/settings.json → permissions (allow 61, deny 73) |
