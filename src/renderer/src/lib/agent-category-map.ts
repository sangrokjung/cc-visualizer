import type { AgentCategory } from './types'

/**
 * 에이전트 → 카테고리 단일 진실점 (Single Source of Truth).
 *
 * scan-system.ts (정적 JSON 생성)와 agent-parser.ts (Tauri 런타임) 양쪽에서
 * 이 매핑을 import하여 카테고리 불일치를 방지한다.
 *
 * 새 에이전트 추가 시 이 파일만 업데이트하면 된다.
 * 2026-05-13: 32개 매핑 추가 (67 → 99). hub/team-lead, QA 4종, cert 파이프라인,
 * 메타-오케스트레이터 등.
 */
export const AGENT_CATEGORY_MAP: Record<string, AgentCategory> = {
  // ── development (개발) ──
  'architect': 'development',
  'build-error-resolver': 'development',
  'dev-brainstormer': 'development',
  'dev-team-lead': 'development',
  'doc-updater': 'development',
  'e2e-runner': 'development',
  'escalation-fixer': 'development',
  'impl-worker': 'development',
  'planner': 'development',
  'refactor-cleaner': 'development',
  'slides-web-builder': 'development',
  'verify-agent': 'development',

  // ── review (리뷰) ──
  'a11y-reviewer': 'review',
  'code-reviewer': 'review',
  'codex-reviewer': 'review',
  'database-reviewer': 'review',
  'gemini-reviewer': 'review',
  'performance-reviewer': 'review',
  'qa-evaluator': 'review',
  'qa-planner': 'review',
  'qa-reconciler': 'review',
  'qa-skeptic': 'review',
  'rca-debugger': 'review',
  'security-reviewer': 'review',
  'systematic-debugger': 'review',
  'tdd-guide': 'review',

  // ── marketing (마케팅) ──
  'ad-compass': 'marketing',
  'ad-optimizer-team': 'marketing',
  'ad-scout-google': 'marketing',
  'ad-scout-meta': 'marketing',
  'copywriting': 'marketing',
  'growth-engineer': 'marketing',
  'marketing-content-team': 'marketing',
  'performance-growth-marketer': 'marketing',
  'qjc-content': 'marketing',
  'reviewer-team': 'marketing',
  'seo-geo-aeo-strategist': 'marketing',
  'storyteller': 'marketing',
  'writer-team': 'marketing',

  // ── business (비즈니스) ──
  'bizmodel-architect': 'business',
  'budget-analyst': 'business',
  'business-team-lead': 'business',
  'ci-bi-strategist': 'business',
  'crm-manager': 'business',
  'expense-processor': 'business',
  'feedback-analyst': 'business',
  'financial-accountant': 'business',
  'first-principles-thinker': 'business',
  'gov-support-strategist': 'business',
  'lead-scorer': 'business',
  'meeting-prep': 'business',
  'product-strategist': 'business',
  'qjc-business': 'business',
  'qjc-orchestrator': 'business',
  'quotation': 'business',
  'sales-followup': 'business',

  // ── creative (크리에이티브) ──
  'design-creator': 'creative',
  'landing-page-team-lead': 'creative',
  'openai-image-creator': 'creative',
  'portfolio-architect': 'creative',
  'remotion-creator': 'creative',
  'scenario-visualizer': 'creative',
  'web-designer': 'creative',

  // ── research (리서치) ──
  'ai-researcher': 'research',
  'auto-experimenter': 'research',
  'data-analyst': 'research',
  'research-pi': 'research',
  'researcher': 'research',
  'super-research': 'research',

  // ── legal (법무) ──
  'civil-law-advisor': 'legal',
  'compliance-checker': 'legal',
  'contract-legal': 'legal',
  'labor-consultant': 'legal',
  'mediation-negotiator': 'legal',
  'nda-generator': 'legal',
  'patent-attorney': 'legal',

  // ── operations (운영) ──
  'action-architect': 'operations',
  'browser-automation-agent': 'operations',
  'cert-grader': 'operations',
  'cert-sender': 'operations',
  'context-sync-lead': 'operations',
  'cs-responder': 'operations',
  'email-action-team': 'operations',
  'faq-builder': 'operations',
  'folder-hunter': 'operations',
  'hometax-processor': 'operations',
  'hr-manager': 'operations',
  'mail-scout': 'operations',
  'meeting-secretary': 'operations',
  'musk-hiring-evaluator': 'operations',
  'onboarding-guide': 'operations',
  'qjc-operations': 'operations',
  'revenue-processor': 'operations',
  'training-designer': 'operations',

  // ── investment (투자) ──
  'loan-advisor': 'investment',
  'real-estate-investor': 'investment',
  'real-estate-property': 'investment',
  'stock-investment-advisor': 'investment',

  // ── lifestyle (라이프) ──
  'saju-myeongri': 'lifestyle',
}
