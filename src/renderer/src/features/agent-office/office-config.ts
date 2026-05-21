import type { AgentCategory } from '../../lib/types'

// ── 픽셀아트 팔레트 ── (legacy, 일부 호환용)
export const PIXEL_PALETTE = {
  wall: '#2a2a3a',
  wallHighlight: '#3a3a4e',
  wallShadow: '#1a1a28',
  floor: '#1e2028',
  floorAlt: '#232630',
  carpet: '#1a1f2e',
  door: '#4a3a2a',
  doorFrame: '#6a5a4a',
  desk: '#3a3020',
  deskTop: '#5a4a35',
  monitor: '#1a2a1a',
  monitorScreen: '#2a4a3a',
  chair: '#2a2a3a',
}

// ── 자비스(JARVIS) HUD 팔레트 ──
// 토니 스타크 AI 비서 시각 언어 — 청록 시그니처 + 위험 시 주황
export const JARVIS = {
  primary: '#00d4ff',      // 메인 청록 (작동 중 코어)
  primaryDim: '#0099cc',   // 어두운 청록 (idle)
  accent: '#ff8c00',       // 주황 액센트 (경고/위험)
  gold: '#ffb84d',         // 골드 (opus 부장)
  emerald: '#10e88c',      // 에메랄드 (작업 활성)
  scarlet: '#ff3860',      // 적색 (offline)
  bg: '#020817',           // 거의 검정 배경
  bgPanel: '#0a1628',      // 패널 배경
  bgGrid: '#0e1a30',       // 그리드 라인
  text: '#e0f0ff',         // 메인 텍스트
  textDim: '#5a7ba8',      // 보조 텍스트
  border: '#1c3458',       // 일반 보더
  borderActive: '#00d4ff', // 활성 보더 (글로우 적용)
}

// 벽 두께
export const WALL_THICKNESS = 6

// 에이전트 1인 공간
export const AVATAR_CELL = { w: 80, h: 100 }

// 방 패딩 (벽 두께 포함)
export const ROOM_PADDING = { top: 56, right: 28, bottom: 28, left: 28 }

// 부서별 그리드 열 수
export const ROOM_COLS: Record<AgentCategory, number> = {
  development: 7, marketing: 5, review: 3, business: 3,
  creative: 2, research: 1, legal: 2, operations: 2,
  investment: 2, lifestyle: 1
}

// 부서 라벨
export const DEPT_LABELS: Record<AgentCategory, string> = {
  development: '개발부서', review: '리뷰부서', business: '비즈니스부서',
  marketing: '마케팅부서', creative: '크리에이티브부서', research: '리서치부서',
  legal: '법무부서', operations: '운영부서',
  investment: '투자부서', lifestyle: '라이프부서'
}

// 부서 이모지
export const DEPT_EMOJI: Record<AgentCategory, string> = {
  development: '🧑‍💻', review: '🔍', business: '💼', marketing: '📢',
  creative: '🎨', research: '🔬', legal: '⚖️', operations: '⚙️',
  investment: '📈', lifestyle: '🔮'
}

// 부서별 바닥 색상 (타일 2톤)
export const FLOOR_COLORS: Record<AgentCategory, [string, string]> = {
  development: ['#191d28', '#1c2130'],
  review: ['#1b1930', '#1e1c38'],
  business: ['#172320', '#1a2a24'],
  marketing: ['#1a2318', '#1e2a1c'],
  creative: ['#231a26', '#2a1e2e'],
  research: ['#1e1a28', '#221e30'],
  legal: ['#23201a', '#2a2620'],
  operations: ['#221c18', '#2a2220'],
  investment: ['#152228', '#1a2a30'],
  lifestyle: ['#231a24', '#2a1e2c'],
}

// 모델별 아바타 설정
export const MODEL_CONFIG: Record<string, {
  badge: string; headSize: number; rank: string; glow: boolean
  headColor: string; bodyScale: number
}> = {
  opus: { badge: '👑', headSize: 40, rank: '부장', glow: true, headColor: '#7961DB', bodyScale: 1.2 },
  sonnet: { badge: '🎯', headSize: 34, rank: '대리', glow: false, headColor: '#2D72D2', bodyScale: 1.0 },
  haiku: { badge: '🌱', headSize: 28, rank: '인턴', glow: false, headColor: '#29A634', bodyScale: 0.85 }
}

// 상태별 설정
// 실데이터 기반: 세션 이벤트의 lastSeen 경과 시간으로 working/recent/idle/offline 판단
// - working: 최근 30초 이내 활동
// - recent: 30초~5분 이내 활동
// - idle: 5분 초과 활동 (또는 세션 이벤트는 있지만 오래됨)
// - offline: 세션 이벤트 자체가 없음 (또는 매칭 실패)
export type AgentStatus = 'working' | 'recent' | 'idle' | 'offline'

export const STATUS_CONFIG: Record<AgentStatus, {
  label: string; animClass: string; bubble: string
}> = {
  working: { label: '작업 중', animClass: 'animate-typing', bubble: '...' },
  recent: { label: '방금 활동', animClass: 'animate-idle', bubble: '✓' },
  idle: { label: '대기 중', animClass: 'animate-idle', bubble: '' },
  offline: { label: '오프라인', animClass: 'animate-break', bubble: '☕' }
}

// ── 가구 시스템 ──
export type FurnitureType =
  | 'whiteboard' | 'coffee_machine' | 'plant_small' | 'plant_large'
  | 'server_rack' | 'bookshelf' | 'water_cooler' | 'meeting_table'
  | 'printer' | 'sofa' | 'filing_cabinet' | 'trash_bin' | 'clock'

export type FurnitureItem = {
  type: FurnitureType
  w: number
  h: number
  x: number
  y: number
}

// 부서별 가구 배치 (방 내 상대좌표, 에이전트 그리드 우측/하단에 배치)
export const ROOM_FURNITURE: Record<AgentCategory, FurnitureItem[]> = {
  development: [
    { type: 'whiteboard', w: 48, h: 32, x: 8, y: 0 },
    { type: 'server_rack', w: 32, h: 40, x: 8, y: 100 },
    { type: 'plant_small', w: 20, h: 24, x: 52, y: 108 },
    { type: 'printer', w: 28, h: 24, x: 8, y: 200 },
  ],
  marketing: [
    { type: 'whiteboard', w: 48, h: 32, x: 8, y: 0 },
    { type: 'sofa', w: 44, h: 28, x: 8, y: 90 },
    { type: 'plant_large', w: 24, h: 32, x: 56, y: 86 },
  ],
  review: [
    { type: 'bookshelf', w: 40, h: 32, x: 8, y: 0 },
    { type: 'plant_small', w: 20, h: 24, x: 52, y: 4 },
  ],
  business: [
    { type: 'meeting_table', w: 48, h: 36, x: 4, y: 0 },
    { type: 'filing_cabinet', w: 24, h: 28, x: 56, y: 4 },
  ],
  creative: [
    { type: 'sofa', w: 44, h: 28, x: 4, y: 0 },
    { type: 'plant_large', w: 24, h: 32, x: 52, y: -2 },
  ],
  research: [
    { type: 'bookshelf', w: 40, h: 32, x: 4, y: 0 },
  ],
  legal: [
    { type: 'bookshelf', w: 40, h: 32, x: 8, y: 0 },
    { type: 'filing_cabinet', w: 24, h: 28, x: 52, y: 4 },
  ],
  operations: [
    { type: 'printer', w: 28, h: 24, x: 8, y: 0 },
    { type: 'trash_bin', w: 16, h: 16, x: 44, y: 8 },
  ],
  investment: [
    { type: 'whiteboard', w: 48, h: 32, x: 4, y: 0 },
    { type: 'plant_small', w: 20, h: 24, x: 56, y: 4 },
  ],
  lifestyle: [
    { type: 'bookshelf', w: 40, h: 32, x: 4, y: 0 },
  ]
}

// 복도 가구
export const CORRIDOR_FURNITURE: FurnitureItem[] = [
  { type: 'coffee_machine', w: 28, h: 32, x: 0, y: 0 },
  { type: 'plant_large', w: 24, h: 32, x: 50, y: -2 },
  { type: 'water_cooler', w: 20, h: 28, x: 96, y: 2 },
  { type: 'plant_small', w: 20, h: 24, x: 136, y: 4 },
  { type: 'sofa', w: 44, h: 28, x: 170, y: 0 },
  { type: 'plant_large', w: 24, h: 32, x: 230, y: -2 },
]

// 복도 폭
export const CORRIDOR_WIDTH = 72

// 방 간 간격
export const ROOM_GAP = 20
