import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import type { AgentNode, AgentCategory, PipelineEdge } from '../../lib/types'
import { CATEGORY_COLORS } from '../../lib/types'
import {
  AVATAR_CELL, ROOM_PADDING, ROOM_COLS, DEPT_LABELS, DEPT_EMOJI,
  MODEL_CONFIG, ROOM_FURNITURE, CORRIDOR_FURNITURE,
  CORRIDOR_WIDTH, ROOM_GAP, FLOOR_COLORS,
} from './office-config'

type LayoutInput = {
  agents: AgentNode[]
  activeCategories: Set<AgentCategory>
  pipelines: PipelineEdge[]
}

// 방 크기 계산
function calcRoomSize(agentCount: number, cols: number) {
  const rows = Math.ceil(agentCount / cols)
  const w = ROOM_PADDING.left + cols * AVATAR_CELL.w + ROOM_PADDING.right + 80 // 가구 공간
  const h = ROOM_PADDING.top + rows * AVATAR_CELL.h + ROOM_PADDING.bottom
  return { w, h }
}

export function useOfficeLayout({ agents, activeCategories, pipelines }: LayoutInput): Node[] {
  return useMemo(() => {
    // 카테고리별 그룹화
    const grouped = new Map<AgentCategory, AgentNode[]>()
    const allCats: AgentCategory[] = ['development', 'review', 'business', 'marketing', 'creative', 'research', 'legal', 'operations', 'investment', 'lifestyle']
    for (const cat of allCats) {
      grouped.set(cat, [])
    }
    for (const agent of agents) {
      grouped.get(agent.category)?.push(agent)
    }

    const nodes: Node[] = []
    const isFiltered = activeCategories.size > 0

    // 각 방의 크기를 미리 계산
    const roomSizes = new Map<AgentCategory, { w: number; h: number }>()
    for (const cat of allCats) {
      const count = grouped.get(cat)?.length ?? 0
      const cols = ROOM_COLS[cat]
      roomSizes.set(cat, calcRoomSize(Math.max(count, 1), cols))
    }

    // ── 레이아웃 계산 ──
    // 행 1: 개발(왼쪽) + 복도 + 리뷰/비즈니스(오른쪽 스택)
    const devSize = roomSizes.get('development')!
    const reviewSize = roomSizes.get('review')!
    const bizSize = roomSizes.get('business')!

    const row1RightH = reviewSize.h + ROOM_GAP + bizSize.h
    const row1H = Math.max(devSize.h, row1RightH)

    const devPos = { x: 0, y: 0 }
    const reviewPos = { x: devSize.w + CORRIDOR_WIDTH, y: 0 }
    const bizPos = { x: devSize.w + CORRIDOR_WIDTH, y: reviewSize.h + ROOM_GAP }

    // 행 2: 마케팅(왼쪽) + 복도 + 크리에이티브/리서치(오른쪽 스택)
    const mktSize = roomSizes.get('marketing')!
    const creativeSize = roomSizes.get('creative')!
    const researchSize = roomSizes.get('research')!

    const row2Top = row1H + ROOM_GAP
    const row2RightH = creativeSize.h + ROOM_GAP + researchSize.h
    const row2H = Math.max(mktSize.h, row2RightH)

    const mktPos = { x: 0, y: row2Top }
    const creativePos = { x: devSize.w + CORRIDOR_WIDTH, y: row2Top }
    const researchPos = { x: devSize.w + CORRIDOR_WIDTH, y: row2Top + creativeSize.h + ROOM_GAP }

    // 행 3: 법무 + 운영 + 투자 + 라이프 (나란히)
    const legalSize = roomSizes.get('legal')!
    const opsSize = roomSizes.get('operations')!
    const investSize = roomSizes.get('investment')!
    const lifeSize = roomSizes.get('lifestyle')!

    const row3Top = row2Top + row2H + ROOM_GAP
    const legalPos = { x: 0, y: row3Top }
    const opsPos = { x: legalSize.w + ROOM_GAP, y: row3Top }
    const investPos = { x: legalSize.w + ROOM_GAP + opsSize.w + ROOM_GAP, y: row3Top }
    const lifePos = { x: legalSize.w + ROOM_GAP + opsSize.w + ROOM_GAP + investSize.w + ROOM_GAP, y: row3Top }

    // 방 위치 맵
    const roomPositions = new Map<AgentCategory, { x: number; y: number }>([
      ['development', devPos], ['review', reviewPos], ['business', bizPos],
      ['marketing', mktPos], ['creative', creativePos], ['research', researchPos],
      ['legal', legalPos], ['operations', opsPos],
      ['investment', investPos], ['lifestyle', lifePos]
    ])

    // ── 방 노드 생성 ──
    for (const cat of allCats) {
      const size = roomSizes.get(cat)!
      const pos = roomPositions.get(cat)!
      const isActive = !isFiltered || activeCategories.has(cat)
      const color = CATEGORY_COLORS[cat]
      const agentCount = grouped.get(cat)?.length ?? 0

      nodes.push({
        id: `room-${cat}`,
        type: 'departmentZone',
        position: pos,
        style: {
          width: size.w,
          height: size.h,
          opacity: isActive ? 1 : 0.15,
          zIndex: 0,
        },
        data: {
          category: cat,
          label: DEPT_LABELS[cat],
          emoji: DEPT_EMOJI[cat],
          color,
          agentCount,
          floorColors: FLOOR_COLORS[cat],
        },
        draggable: false,
        selectable: false,
      })
    }

    // ── 에이전트 노드 생성 ──
    for (const cat of allCats) {
      const catAgents = grouped.get(cat) ?? []
      const cols = ROOM_COLS[cat]
      const isActive = !isFiltered || activeCategories.has(cat)

      if (!isActive) continue

      catAgents.forEach((agent, idx) => {
        const col = idx % cols
        const row = Math.floor(idx / cols)
        const x = ROOM_PADDING.left + col * AVATAR_CELL.w
        const y = ROOM_PADDING.top + row * AVATAR_CELL.h

        const modelCfg = MODEL_CONFIG[agent.model] ?? MODEL_CONFIG.sonnet

        // 에이전트가 관련된 파이프라인 수
        const pipelineCount = pipelines.filter(
          p => p.from === agent.id || p.to === agent.id
        ).length

        nodes.push({
          id: agent.id,
          type: 'agentAvatar',
          position: { x, y },
          parentId: `room-${cat}`,
          extent: 'parent',
          data: {
            agent,
            status: 'idle' as const,
            modelConfig: modelCfg,
            color: CATEGORY_COLORS[cat],
            pipelineCount,
          },
          draggable: false,
          style: { zIndex: 10 },
        })
      })
    }

    // ── 가구 노드 생성 (방 내부) ──
    for (const cat of allCats) {
      const furniture = ROOM_FURNITURE[cat] ?? []
      const isActive = !isFiltered || activeCategories.has(cat)
      if (!isActive) continue

      const cols = ROOM_COLS[cat]
      // 가구는 에이전트 그리드 오른쪽에 배치
      const gridRight = ROOM_PADDING.left + cols * AVATAR_CELL.w

      furniture.forEach((item, idx) => {
        nodes.push({
          id: `furniture-${cat}-${idx}`,
          type: 'furniture',
          position: {
            x: gridRight + item.x,
            y: ROOM_PADDING.top + item.y
          },
          parentId: `room-${cat}`,
          extent: 'parent',
          data: { type: item.type, w: item.w, h: item.h },
          draggable: false,
          selectable: false,
          style: { zIndex: 5 },
        })
      })
    }

    // ── 복도 가구 (절대 좌표) ──
    const corridorX = devSize.w + 10
    const corridorY = row1H + 4
    CORRIDOR_FURNITURE.forEach((item, idx) => {
      nodes.push({
        id: `corridor-furniture-${idx}`,
        type: 'furniture',
        position: {
          x: corridorX + item.x,
          y: corridorY + item.y
        },
        data: { type: item.type, w: item.w, h: item.h },
        draggable: false,
        selectable: false,
        style: { zIndex: 5 },
      })
    })

    return nodes
  }, [agents, activeCategories, pipelines])
}
