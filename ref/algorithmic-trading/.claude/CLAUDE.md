# Project Rules

## Phase 개발 워크플로우

모든 Phase는 아래 3단계 사이클을 반드시 따른다.

### Step 1: 구현 (Implement)

- PRD(`docs/PRD.md`) 및 설계문서(`docs/DESIGN.md`) 기반으로 해당 Phase 코드 작성
- 단위 테스트 포함
- `pnpm build` + `pnpm test` 통과 확인
- 완료 후 커밋

### Step 2: Codex 리뷰 (Review)

- Step 1 완료 후 반드시 Codex에 리뷰를 요청한다
- 변경된 코드 전체를 대상으로 리뷰
- 결과를 Must Fix / Should Fix / Consider로 분류

### Step 3: 리뷰 반영 (Fix)

- Must Fix: 전량 반영
- Should Fix: 판단 후 반영
- Consider: 선택적 반영
- 반영 완료 후 커밋
- Phase 완료 선언 → 다음 Phase 진입

## Plan 워크플로우

Plan mode에서 구현 계획을 세울 때도 아래 사이클을 따른다.

1. **계획 수립**: 탐색 → 설계 → plan 파일 작성
2. **Codex 리뷰**: 작성한 plan을 Codex에 리뷰 요청 (Must Fix / Should Fix / Consider)
3. **리뷰 반영**: Codex 피드백을 plan에 반영 후 사용자에게 최종 승인 요청

Plan 승인 후 구현 단계(Phase 워크플로우 Step 1)로 진입한다.

## 참조 문서

- PRD: `docs/PRD.md`
- 설계: `docs/DESIGN.md`
- FE 표준: `docs/standards.md`
- 워크플로우 상세: `docs/WORKFLOW.md`

## 기술 규칙

- 모노레포: pnpm workspace (`apps/engine`, `apps/web`, `packages/shared`)
- TypeScript strict 모드, `as const` + union 패턴 (enum 사용 금지)
- DB: SQLite (better-sqlite3, WAL 모드)
- 테스트: Node.js 내장 test runner (`node:test` + `node:assert/strict`)
- 커밋: Conventional Commits (`feat`, `fix`, `chore` 등)
- `.env` 파일에 시크릿 저장 (git 제외), 코드에 하드코딩 금지
