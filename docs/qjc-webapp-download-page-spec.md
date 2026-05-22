# qjc-webapp CC Visualizer 다운로드 페이지 구현 스펙

> 실제 코드 구현은 별도 PR로 진행. 이 문서는 설계 스펙 전용.
> 작성일: 2026-05-22

---

## 1. 목적 및 배경

직원 3명(대표, PM 김광오, 사원 장소영)이 CC Visualizer를 쉽게 다운로드할 수 있는
qjc-webapp 내부 페이지. GitHub Releases가 배포 출처이므로 GitHub Releases API를
단일 소스로 사용해 최신 버전 정보와 다운로드 URL을 자동으로 가져온다.

---

## 2. 라우트 설계

### 권장 라우트

```
/[locale]/admin/tools
```

**근거:**
- `/admin` 라우트 그룹 레이아웃(`src/app/[locale]/admin/layout.tsx`)이 이미 `getAuthedAdminUser` 체크 후 비관리자 → `/[locale]/login` 리다이렉트를 처리함.
- 별도 RBAC 미들웨어 추가 불필요.
- 기존 AdminSidebar에 `{ href: '/admin/tools', icon: Download, labelKey: 'tools' }` 항목 하나만 추가하면 자연스럽게 네비게이션에 편입됨.

### 파일 위치

```
src/app/[locale]/admin/tools/
└── page.tsx
```

### 대안 고려 (채택 안 함)

| 라우트 | 이유 |
|--------|------|
| `/[locale]/tools/cc-visualizer` | admin 보호를 별도로 구현해야 해서 중복 작업 |
| `/[locale]/internal/downloads` | 기존 admin 구조와 일관성 떨어짐 |

---

## 3. 접근 제어

### 현행 admin-guard.ts 함수 (read-only 조사 결과)

| 함수명 | 허용 role | 위치 |
|--------|----------|------|
| `requireAdmin` | `admin`, `super_admin` | `src/lib/auth/admin-guard.ts:14` |
| `requireManagerOrAdmin` | `manager`, `admin`, `super_admin` | `src/lib/auth/admin-guard.ts:42` |
| `requireSuperAdmin` | `super_admin` | `src/lib/auth/admin-guard.ts:72` |

### 권장 접근 제어

`/admin/tools` 페이지는 `/admin` 레이아웃 레벨에서 이미 보호되므로 **페이지 레벨 추가 가드 불필요**.
- 레이아웃이 사용하는 `getAuthedAdminUser`는 내부적으로 `admin` / `super_admin` / 관리자급만 허용.
- 직원 계정 role이 `manager` 이상이면 접근 가능. role 부족 시 `/[locale]/login`으로 자동 리다이렉트.

> **주의**: 직원 장소영, 김광오의 Supabase `users.role`이 `manager` 또는 `admin`으로 설정되어 있어야 해요. 설정 안 되어 있으면 배포 전에 업데이트 필요.

---

## 4. 데이터 소스

### 권장: GitHub Releases API

```
GET https://api.github.com/repos/sangrokjung/cc-visualizer/releases/latest
```

**권장 이유:**
- 빌드 산출물(.dmg, .zip)이 GitHub Releases에 올라가므로 **단일 출처(SSOT)**.
- Supabase Storage에 별도 업로드·관리 불필요.
- 버전 업데이트 시 GitHub Release 하나만 올리면 페이지에 자동 반영됨.

**비교:**

| | GitHub Releases API | Supabase Storage |
|---|---|---|
| 설정 비용 | 낮음 (API 호출만) | 중간 (버킷 + signed URL 생성 로직) |
| 버전 관리 | GitHub Release 태그 자동 | 수동 업로드 필요 |
| 인증 | Public repo면 불필요, Private이면 `GITHUB_TOKEN` | Supabase service key 필요 |
| 파일 관리 | GitHub Actions로 자동화 가능 | 별도 업로드 워크플로우 필요 |

cc-visualizer 저장소가 **Private**이면 `GITHUB_TOKEN` 환경변수 추가 필요:
```
GITHUB_TOKEN=ghp_...   # Vercel 환경변수에 추가
```

### API 응답에서 추출할 필드

```typescript
interface GitHubRelease {
  tag_name: string        // "v2.0.0" — 버전 표시용
  published_at: string    // ISO8601 — "2026-05-22T..." — 날짜 표시용
  body: string            // 릴리즈 노트 (선택 표시)
  assets: Array<{
    name: string          // "CC-Visualizer-v2.0.0.dmg", "cc-menubar-install.zip"
    browser_download_url: string  // 직접 다운로드 URL
    size: number          // 바이트 단위 크기
  }>
}
```

### Route Handler 위치 (권장)

```
src/app/api/admin/cc-visualizer/release/route.ts
```

페이지에서 직접 GitHub API를 클라이언트에서 호출하면 CORS/토큰 노출 위험이 있으므로,
Route Handler에서 서버사이드로 fetch 후 필요한 필드만 반환하는 패턴 권장.

---

## 5. 페이지 구성

```
/admin/tools
│
├── 헤더 영역
│   ├── 페이지 제목: "내부 도구"
│   └── 설명: "QJC 직원 전용 도구 다운로드"
│
└── CC Visualizer 카드
    ├── 앱 이름 + 버전 배지 (GitHub API에서 tag_name)
    ├── 릴리즈 날짜
    ├── 한 줄 설명: "Claude Code 사용량·에이전트·스킬을 실시간으로 시각화"
    │
    ├── [다운로드 버튼 영역]
    │   ├── "본체 앱 다운로드 (.dmg)"   ← assets에서 .dmg 필터
    │   └── "메뉴바 데몬 다운로드 (.zip)"  ← assets에서 cc-menubar*.zip 필터
    │
    ├── 파일 크기 표시 (assets.size → MB 환산)
    │
    ├── [설치 안내 링크]
    │   └── "설치 가이드 보기" → INSTALL-for-employees.md 또는 GitHub Raw
    │
    └── [미서명 우회 요약 — 접기 가능]
        "처음 실행 시 '확인되지 않은 개발자' 경고가 나와요.
         앱을 우클릭 → '열기' → 경고에서 '열기' 를 선택하거나,
         터미널에서 아래 명령을 실행해 주세요:
         xattr -dr com.apple.quarantine /Applications/CC\ Visualizer.app"
```

---

## 6. 재사용 컴포넌트 패턴

### DownloadButton 재사용 방식

기존 `src/components/templates/DownloadButton.tsx`는 templateId 기반 API(`/api/templates/:id/download`)와 결합되어 있어서 **직접 재사용은 어려워요**. 대신 동일한 UX 패턴을 참고해서 별도 컴포넌트로 작성 권장.

```typescript
// src/components/admin/tools/CCVisualizerDownloadButton.tsx
'use client'

interface Props {
  downloadUrl: string
  fileName: string
  fileSize: number  // bytes
  label: string
}

export function CCVisualizerDownloadButton({ downloadUrl, fileName, fileSize, label }: Props) {
  // DownloadButton.tsx의 isDownloading 상태 + a 태그 트리거 패턴을 그대로 차용
  // href를 browser_download_url로 설정 — GitHub에서 직접 다운로드
}
```

**참고한 기존 패턴 위치:**
- `src/components/templates/DownloadButton.tsx` (UI 패턴, animate-spin 로딩 등)
- `src/hooks/use-templates.ts:118` — `useTemplateDownload` (mutationFn → downloadTemplate → fetch)

### useTemplateDownload 방식과의 차이

| | useTemplateDownload | CC Visualizer |
|---|---|---|
| 다운로드 URL 획득 | `/api/templates/:id/download` Route Handler | GitHub `browser_download_url` 직접 |
| 인증 | 구독 tier 체크 포함 | admin 레이아웃 레벨에서 이미 보호 |
| 상태 | React Query mutation | 단순 useState(isDownloading) |

CC Visualizer 다운로드는 인증이 이미 레이아웃에서 처리되므로 React Query 불필요. 단순 `<a href={url} download>` 래퍼면 충분.

---

## 7. AdminSidebar 추가 항목

`src/components/admin/AdminSidebar.tsx`에 "도구" 섹션 추가:

```typescript
// 기존 items 배열에 추가 — "설정" 그룹 근처가 적합
{ href: '/admin/tools', icon: Download, labelKey: 'tools' }
```

i18n 키 추가 위치: `src/messages/ko.json`, `en.json` 등의 `admin.sidebar.tools` 키.

---

## 8. 환경변수

### 필요 시 추가 (Private 저장소일 때만)

```bash
# Vercel 환경변수
GITHUB_TOKEN=ghp_...     # cc-visualizer repo read:releases 권한
```

Public 저장소면 불필요. Rate limit(미인증 60 req/hr → 인증 5000 req/hr)이 걱정되면 추가 권장.

### 선택: 수동 오버라이드

빌드 파이프라인이 준비되기 전 임시 배포 시:

```bash
CC_VISUALIZER_DMG_URL=https://github.com/.../releases/download/v2.0.0/CC-Visualizer-v2.0.0.dmg
CC_VISUALIZER_MENUBAR_URL=https://github.com/.../releases/download/v2.0.0/cc-menubar-install.zip
CC_VISUALIZER_VERSION=v2.0.0
```

환경변수가 설정되어 있으면 GitHub API 호출을 스킵하고 정적 URL 사용.

---

## 9. 구현 순서 (PR 작업 시 참고)

1. `src/app/api/admin/cc-visualizer/release/route.ts` — GitHub API Route Handler
2. `src/components/admin/tools/CCVisualizerDownloadButton.tsx` — 다운로드 버튼 컴포넌트
3. `src/app/[locale]/admin/tools/page.tsx` — 페이지 (서버 컴포넌트)
4. `src/components/admin/AdminSidebar.tsx` — 네비게이션 항목 추가
5. i18n 키 추가 (ko.json / en.json)

---

## 10. 주의사항 및 다음 액션

### PR 만들기 전에 확인할 것

- [ ] cc-visualizer GitHub 저장소가 Public인지 Private인지 확인 → Private이면 `GITHUB_TOKEN` Vercel에 추가
- [ ] 직원 계정(김광오, 장소영)의 Supabase `users.role`이 `manager` 또는 `admin`인지 확인
- [ ] GitHub Releases에 실제 `.dmg` / `cc-menubar-install.zip` 파일이 올라가 있는지 확인 (assets 배열에 파일 존재 여부)
- [ ] AdminSidebar i18n 키 (`tools`) 누락 시 빌드 에러 가능 — i18n 파일 업데이트 병행

### 다음 단계 순서

1. cc-visualizer `.github/workflows/release.yml` 작성 (빌드 → .dmg + .zip → GitHub Release 자동 업로드)
2. 위 PR 워크플로우 완성 후 qjc-webapp PR 생성
3. Vercel preview 배포 → 직원 계정으로 접근 테스트
4. 이상 없으면 main 머지 → 직원 채널 공지
