# cc-visualizer - 기능 명세

## Feature 1: Dashboard (시스템 개요)
### 요구사항
1. 스크롤 가능한 풀 대시보드 레이아웃 (max-w-[1400px])
2. HeroSection + StatCards(6개, 카운트업 애니메이션) + 차트 4종 + PipelineCards + McpGrid + MemoryPanel
3. 차트: SystemRadar(8카테고리), ModelRadialBar, SkillTreemap, ToolUsageChart
4. 전체 Palantir Blueprint 다크 테마 (#111418, #1C2127, #252A31, #404854)
### 현재 상태
- v6 완료: 9개 시각화 컴포넌트 통합, 팔란티어 테마 적용

## Feature 2: Agent Map
### 요구사항
1. React Flow 기반 에이전트 관계도 (dagre TB 레이아웃)
2. 파이프라인 기반 에이전트 연결/의존성 시각화 (smoothstep + ArrowClosed)
3. 카테고리별 색상 구분 (8개 카테고리), 필터 토글, 디테일 패널
4. 모델 뱃지 (Opus/Sonnet/Default), Handle 카테고리 색상, hover glow
### 현재 상태
- v2 완료: 팔란티어 테마, smoothstep 엣지, 모델 뱃지, 디테일 패널 개선

## Feature 3: Architecture View
### 요구사항
1. 시스템 아키텍처 다이어그램
2. 계층 구조 시각화 (Electron, Rules, Hooks, MCP 등)
3. 컴포넌트 간 데이터 흐름 표현
### 현재 상태
- 기본 구현 완료

## Feature 4: Live Monitor
### 요구사항
1. 실시간 세션 모니터링 (향후)
2. 현재는 정적 데이터 기반 모니터링 뷰
3. 토큰 사용량, 에이전트 실행 상태 표시
### 현재 상태
- 기본 구현 완료, 실시간 연동 미구현

## Feature 5: Catalog
### 요구사항
1. 에이전트, 스킬, 훅, 룰 전체 목록
2. 검색 및 필터링
3. 상세 정보 표시
### 현재 상태
- 기본 구현 완료

## Feature 6: 실시간 세션 연동 (미구현)
### 요구사항
1. Claude Code 세션 데이터 실시간 수집
2. 에이전트 실행 상태 라이브 업데이트
3. 토큰 사용량 실시간 추적
### 데이터 소스
- 현재: `scripts/scan-system.ts` 정적 스캔
- 향후: 세션 로그 파싱 또는 IPC 연동

## Feature 7: Systems (시스템 생태계)
### 요구사항
1. QJC 외부 자동화 시스템 10개를 카드 그리드로 시각화
2. 카테고리별 필터 (자동화/콘텐츠/재무/교육/마케팅/영상)
3. 히어로 섹션 (Active/WIP 카운트, 총 에이전트/스킬/MCP)
4. SystemCard (상태 도트, 기술 스택 뱃지, 에이전트/스킬/MCP 카운트, 핵심 기능)
5. SystemDetailPanel (우측 슬라이드 패널, 전체 상세 정보)
### 데이터 소스
- data/external-systems.json (정적 조사 데이터 10개 프로젝트)
### 현재 상태
- v1 완료: 카드 그리드 + 필터 + 디테일 패널, 팔란티어 테마

## 공통: 검색
### 요구사항
1. Cmd+K 글로벌 검색
2. 에이전트, 스킬, 훅, 룰 통합 검색
3. 검색 결과 선택 시 해당 뷰로 네비게이션
### 현재 상태
- SearchBar 구현 완료
