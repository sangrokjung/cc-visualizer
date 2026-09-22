import { useState } from 'react'
import './workflow.css'

export const contactUrl = 'https://qjc.app/contact?utm_source=harness_demo&utm_medium=product&utm_campaign=ax_showcase'
const scenarios = [
  {
    title: '조사에서 보고서까지', category: 'RESEARCH & STRATEGY',
    description: '흩어진 정보를 모으고, 근거를 검토해 의사결정에 필요한 문서로 만듭니다.',
    input: '조사 주제 · 비교할 기업 · 판단 기준',
    steps: [
      ['Grok', '공개 정보 조사', '출처와 관측 시점을 붙여 관련 정보를 정리합니다.'],
      ['Claude Code', '근거 검토', '서로 다른 출처를 대조하고 확인되지 않은 주장을 구분합니다.'],
      ['Codex', '보고서 구성', '확인된 자료로 비교표와 의사결정 초안을 만듭니다.'],
    ],
    review: '담당자가 출처의 신뢰성·최신성과 최종 권고를 확인합니다.',
    output: ['비교 기준: 고객 대응 방식 / 내부 업무 연결 / 도입 조건', '검토 결과: 출처가 부족한 항목은 추가 조사로 표시', '다음 행동: 우선 검증할 업무 한 가지와 필요한 자료 정리'],
  },
  {
    title: '문의에서 상담 준비까지', category: 'SALES & OPERATIONS',
    description: '문의 맥락과 공개된 기업 정보를 정리해, 사람이 더 깊이 있는 상담을 준비합니다.',
    input: '예시 문의 내용 · 공개 기업 소개 · 상담 목적',
    steps: [
      ['Claude Code', '문의 구조화', '요청 업무와 현재 불편, 아직 확인할 내용을 구분합니다.'],
      ['Grok', '기업 맥락 조사', '공개된 사업 정보를 확인하고 질문할 맥락을 정리합니다.'],
      ['Codex', '상담 브리프', '미팅 질문과 필요한 자료 목록을 한 장에 모읍니다.'],
    ],
    review: '담당자가 개인정보 취급 범위와 질문의 적절성을 검토합니다. 고객 답신은 승인 후 보냅니다.',
    output: ['문의 요약: 반복되는 주간 보고서 작성을 줄이고 싶음', '상담 질문: 자료는 어디에 있고, 최종 검토는 누가 하나요?', '준비 자료: 예시 보고서 / 업무 순서 / 접근 권한 범위'],
  },
  {
    title: '기획에서 콘텐츠 초안까지', category: 'CONTENT & CREATIVE',
    description: '하나의 기획을 조사·문안·화면으로 연결하고, 검토 가능한 초안으로 만듭니다.',
    input: '독자 · 핵심 메시지 · 게시 채널 · 브랜드 기준',
    steps: [
      ['Grok', '소재와 근거', '주제에 필요한 공개 정보와 참고 출처를 모읍니다.'],
      ['Claude Code', '구성과 문안', '독자 관점에서 흐름을 잡고 주장에 근거를 연결합니다.'],
      ['Antigravity', '화면 초안', '문안과 브랜드 기준을 적용한 미리보기를 구성합니다.'],
    ],
    review: '담당자가 사실·저작권·브랜드 표현을 확인한 뒤 게시를 결정합니다.',
    output: ['주제: 반복 업무에 AI를 적용하기 전 확인할 세 가지', '구성: 입력 자료 → 판단 기준 → 사람이 검토할 지점', '초안 상태: 검토 대기 · 게시 전 담당자 승인 필요'],
  },
]

export default function WorkflowShowcase() {
  const [selected, setSelected] = useState(0)
  const scenario = scenarios[selected]
  return <section className="workflow-showcase" aria-label="업무 자동화 예시">
    <div className="workflow-intro"><span className="workflow-eyebrow">FROM TOOLS TO OUTCOMES</span><h1>도구를 연결하면,<br />업무의 흐름이 보입니다.</h1><p>우리 회사의 반복 업무가 어떻게 달라질 수 있는지 살펴보세요.<br />아래는 역할과 검토 지점을 설명하는 예시입니다.</p></div>
    <div className="workflow-tabs" role="tablist" aria-label="예시 업무 선택">{scenarios.map((item, index) => <button key={item.title} role="tab" id={`workflow-tab-${index}`} aria-selected={selected === index} aria-controls="workflow-panel" onClick={() => setSelected(index)}>{String(index + 1).padStart(2, '0')}<span>{item.title}</span>↗</button>)}</div>
    <div id="workflow-panel" role="tabpanel" aria-labelledby={`workflow-tab-${selected}`} className="workflow-panel">
      <div className="workflow-summary"><span className="workflow-eyebrow">{scenario.category} / 예시 시나리오</span><h2>{scenario.title}</h2><p>{scenario.description}</p><div className="workflow-input"><span>시작할 때 필요한 것</span><p>{scenario.input}</p></div></div>
      <ol className="workflow-steps">{scenario.steps.map(([provider, title, body], index) => <li key={title}><span className="workflow-index">0{index + 1}</span><div><span className="workflow-eyebrow">{provider} · 예시 역할</span><h3>{title}</h3><p>{body}</p></div></li>)}</ol>
      <div className="workflow-output"><div><span className="workflow-eyebrow">HUMAN REVIEW</span><h3>사람이 판단하는 지점</h3><p>{scenario.review}</p></div><article><span className="workflow-eyebrow">SAMPLE OUTPUT · 예시 산출물</span><h3>검토 가능한 초안</h3>{scenario.output.map(line => <p key={line}>{line}</p>)}</article></div>
    </div>
    <div className="workflow-contact"><div><span className="workflow-eyebrow">BUILD YOUR OWN WORKFLOW</span><h2>우리 회사의 업무로<br />시작해 보세요.</h2><p>현재 업무와 도입 범위를 함께 정리합니다.</p></div><a href={contactUrl} target="_blank" rel="noopener noreferrer">우리 회사 AX 적용 상담 <span aria-hidden="true">↗</span></a></div>
    <p className="workflow-note">이 화면은 예시 데이터로 구성됩니다. 실제 고객 사례나 실행 결과가 아니며, 도구별 역할은 업무에 맞게 달라집니다.</p>
  </section>
}
