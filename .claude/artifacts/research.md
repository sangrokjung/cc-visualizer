# Research: Claude Code System Visualizer

## 데이터 소스 탐색 결과 (2026-03-14)

### 1. 에이전트 (32개)

**위치**: `~/.claude/agents/*.md`

**파일 구조** (YAML frontmatter):
```yaml
---
name: planner
description: |
  Use when creating implementation plans...
  <example>...</example>
tools: ["Read", "Grep", "Glob", "Write", "Edit"]
model: opus          # opus | sonnet
memory: project
maxTurns: 20
isolation: worktree  # 선택사항
color: blue          # blue, cyan, red, yellow, green, magenta
---
<Agent_Prompt>...</Agent_Prompt>
```

**카테고리별 분류** (agent-catalog.md 기준):
| 카테고리 | 수량 | 에이전트 |
|---------|------|---------|
| 개발 | 14 | planner, architect, tdd-guide, code-reviewer, security-reviewer, database-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater, verify-agent, codex-reviewer, gemini-reviewer, web-designer |
| QJC 비즈니스 | 4 | qjc-business, qjc-operations, qjc-content, quotation |
| 크리에이티브 | 2 | copywriting, remotion-creator |
| 광고 최적화 | 4 | ad-optimizer-team, ad-scout-google, ad-scout-meta, ad-compass |
| 업무 자동화 | 1 | email-action-team |
| 기획 | 1 | product-strategist |
| IP/변리 | 1 | patent-attorney |
| 재무/회계 | 1 | financial-accountant |
| 법률 | 1 | contract-legal |
| 특수 | 3 | performance-growth-marketer, seo-geo-aeo-strategist, researcher |

### 2. 훅 (40개 스크립트, 10개 이벤트 타입)

**위치**: `~/.claude/hooks/*.sh` + `~/qjc-office/dotclaude/hooks/email-mime-validate.sh`
**설정**: `~/.claude/settings.json` (hooks 섹션)

**이벤트 타입별 훅 수:**
| 이벤트 | 훅 수 | 주요 matcher |
|--------|------|-------------|
| PreToolUse | 14 | Bash, mcp__gmail, mcp__supabase, mcp__ads, mcp__playwright, mcp__*, Write\|Edit |
| PostToolUse | 8 | (전체), Bash\|Read\|Grep\|mcp__, Bash, Edit\|Write |
| SessionStart | 7 | (전체) |
| SessionEnd | 4 | (전체) |
| Stop | 3 | (전체) |
| UserPromptSubmit | 1 | (전체) |
| TaskCompleted | 3 | (전체) |
| Notification | 1 | idle_prompt\|permission_prompt |
| PreCompact | 1 | (전체) |
| SubagentStop | 1 | (전체) |
| TeammateIdle | 1 | (전체) |

**훅 속성**: type, command, timeout, async(boolean)

### 3. MCP 서버 (~20개)

**settings.json permissions.allow에서 추출:**
- context7, exa, youtube-transcript, memory, coingecko, korea-stock
- remotion, supabase, analytics-mcp
- data-go-nts, data-go-pps, data-go-fsc, data-go-msds
- github (부분 allow), n8n-mcp (부분 allow), desktop-commander (부분 allow)
- playwright, notebooklm-mcp, notion, stitch, fetch, jina-reader
- google-ads-mcp, meta-ads-mcp, codex-bridge, sequential-thinking

### 4. Rules (27개)

**위치**: `~/qjc-office/dotclaude/rules/*.md`
**주요 파일**: golden-principles, coding-style, interaction, verification, agents-v2, session, git-workflow-v2, gws, planning, seo-geo-aeo, performance-marketing, patent-attorney, ralph-loop 등

### 5. 파이프라인 (8개)

**위치**: `~/qjc-office/dotclaude/reference/agent-pipeline.md`
- 코드리뷰: code-reviewer -> security/database-reviewer -> codex/gemini-review
- 검증: build-error-resolver -> tdd-guide -> handoff-verify -> verify-loop
- 비즈니스: qjc-business -> quotation/operations/content -> performance-marketer -> ad-optimizer-team
- 콘텐츠/마케팅: copywriting -> content-creator/qjc-content/web-designer
- 이메일: /email-action (Phase 0/1/2) -> qjc-business/operations/content
- SEO: seo-geo-aeo-strategist -> researcher/copywriting/web-designer/qjc-content
- 기획: product-strategist -> researcher/pm-skills -> planner
- 설계/구현: planner -> architect -> tdd-guide -> code-reviewer

### 6. 에이전트 메모리

**위치**: `~/.claude/agent-memory/{agent-name}/`
**현재 활성**: researcher/ (20+ 파일), copywriting/ (1 파일)

### 7. 세션 로그

**위치**: `~/.claude/work-log/session-summary-*.json`
**구조**: { status, summary, changes[], test_results, next_steps[], blockers[] }

### 8. Permissions

**위치**: settings.json
- allow: 77개 패턴
- deny: 73개 패턴

### 파싱 전략

1. **에이전트 .md**: gray-matter 또는 커스텀 YAML frontmatter 파서로 name, tools, model, color, isolation, maxTurns 추출
2. **settings.json**: JSON.parse -> hooks, permissions, mcpServers, env 섹션 추출
3. **Rules .md**: 파일명 + 첫 H1 제목 + IMPORTANT/CRITICAL 태그 추출
4. **Pipeline**: agent-pipeline.md에서 Mermaid-like 구조 파싱 또는 하드코딩
5. **세션 로그**: JSON.parse -> 타임라인 렌더링
6. **실시간 감시**: chokidar로 work-log/, agent-memory/ 변경 감지
