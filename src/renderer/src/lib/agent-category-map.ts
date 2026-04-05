import type { AgentCategory } from './types'

/**
 * 에이전트 → 카테고리 단일 진실점 (Single Source of Truth).
 *
 * scan-system.ts (정적 JSON 생성)와 agent-parser.ts (Tauri 런타임) 양쪽에서
 * 이 매핑을 import하여 카테고리 불일치를 방지한다.
 *
 * 새 에이전트 추가 시 이 파일만 업데이트하면 된다.
 */
export const AGENT_CATEGORY_MAP: Record<string, AgentCategory> = {
  // ── development (개발) ──
  'architect': 'development',
  'build-error-resolver': 'development',
  'planner': 'development',
  'refactor-cleaner': 'development',
  'doc-updater': 'development',
  'e2e-runner': 'development',
  'verify-agent': 'development',
  'escalation-fixer': 'development',

  // ── review (리뷰) ──
  'code-reviewer': 'review',
  'codex-reviewer': 'review',
  'gemini-reviewer': 'review',
  'database-reviewer': 'review',
  'security-reviewer': 'review',
  'tdd-guide': 'review',

  // ── marketing (마케팅) ──
  'ad-compass': 'marketing',
  'ad-optimizer-team': 'marketing',
  'ad-scout-google': 'marketing',
  'ad-scout-meta': 'marketing',
  'copywriting': 'marketing',
  'seo-geo-aeo-strategist': 'marketing',
  'performance-growth-marketer': 'marketing',
  'qjc-content': 'marketing',
  'storyteller': 'marketing',

  // ── business (비즈니스) ──
  'qjc-business': 'business',
  'quotation': 'business',
  'financial-accountant': 'business',
  'gov-support-strategist': 'business',
  'product-strategist': 'business',
  'crm-manager': 'business',
  'first-principles-thinker': 'business',
  'budget-analyst': 'business',
  'ci-bi-strategist': 'business',
  'expense-processor': 'business',
  'feedback-analyst': 'business',
  'lead-scorer': 'business',
  'meeting-prep': 'business',

  // ── creative (크리에이티브) ──
  'web-designer': 'creative',
  'remotion-creator': 'creative',
  'design-creator': 'creative',

  // ── research (리서치) ──
  'researcher': 'research',
  'ai-researcher': 'research',
  'research-pi': 'research',
  'auto-experimenter': 'research',
  'data-analyst': 'research',

  // ── legal (법무) ──
  'contract-legal': 'legal',
  'patent-attorney': 'legal',
  'labor-consultant': 'legal',
  'compliance-checker': 'legal',
  'nda-generator': 'legal',

  // ── operations (운영) ──
  'qjc-operations': 'operations',
  'email-action-team': 'operations',
  'hr-manager': 'operations',
  'action-architect': 'operations',
  'folder-hunter': 'operations',
  'mail-scout': 'operations',
  'browser-automation-agent': 'operations',
  'cs-responder': 'operations',
  'faq-builder': 'operations',
  'meeting-secretary': 'operations',
  'musk-hiring-evaluator': 'operations',
  'onboarding-guide': 'operations',
  'training-designer': 'operations',

  // ── investment (투자) ──
  'real-estate-investor': 'investment',
  'real-estate-property': 'investment',
  'stock-investment-advisor': 'investment',
  'loan-advisor': 'investment',

  // ── lifestyle (라이프) ──
  'saju-myeongri': 'lifestyle',
}
