# cc-visualizer - 구현 계획

## Phase 1: 5개 뷰 품질 완성
- [x] Dashboard: 스크롤 가능한 풀 대시보드로 재설계 (9개 시각화 컴포넌트 통합, 팔란티어 테마)
- [x] Agent Map: 카테고리 필터, 팔란티어 테마, smoothstep 엣지, 모델 뱃지, 디테일 패널 개선
- [ ] Architecture: 인터랙티브 요소 추가 (클릭 -> 상세)
- [ ] Live Monitor: 정적 데이터 기반 차트/메트릭 완성
- [ ] Catalog: 정렬, 페이지네이션, 상세 뷰 연동

## Phase 2: UX 통합
- [ ] 뷰 간 네비게이션 연동 (Dashboard 노드 클릭 -> Catalog 상세)
- [ ] 검색 결과에서 뷰 전환 + 엔티티 하이라이트
- [ ] 키보드 네비게이션 (Tab, Arrow, Enter)
- [ ] 반응형 레이아웃 (Electron 윈도우 리사이즈)

## Phase 3: 실시간 세션 연동
- [ ] 세션 데이터 수집 방식 설계 (IPC vs 파일 워치)
- [ ] Electron main process에 데이터 수집기 구현
- [ ] renderer에 실시간 업데이트 반영 (WebSocket/IPC)
- [ ] Live Monitor 뷰 실시간 데이터 연동

## Phase 4: 테스트 & 패키징
- [ ] 주요 컴포넌트 단위 테스트 (커버리지 80%+)
- [ ] React Flow 노드/엣지 상호작용 테스트
- [ ] Electron 빌드 검증 (macOS)
- [ ] 데이터 스캔 스크립트 안정화

## 의존성
- Phase 2는 Phase 1 완료 후 진행
- Phase 3은 독립적으로 진행 가능 (Phase 1과 병렬)
- Phase 4는 Phase 1-2 완료 후 진행
