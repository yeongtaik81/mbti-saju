# MBTI 사주

사주 해석을 중심에 두고 MBTI를 행동 성향 보정 레이어로 결합한 Next.js 기반 웹 서비스입니다.

현재 구현은 다음 흐름까지 연결되어 있습니다.

- email/password 회원가입/로그인
- 온보딩 기반 내 정보 저장
- 무료 MBTI 검사(미니 12문항, 정식 36문항)
- 복 지갑과 Mock 충전
- 한 명 사주 보기 / 두 명 궁합 보기
- 카테고리 그룹형 시나리오 선택
- 시나리오별 로딩/상세 카피 분기
- 시기 기반 캐시와 중복 과금 방지
- 생성 실패 시 복 자동 복구

## 핵심 화면

- `/` : 로그인 진입, 회원가입/무료 MBTI 이동
- `/sign-up` : 회원가입
- `/mbti` : 무료 MBTI 검사
- `/onboarding` : 내 정보 설정/수정
- `/dashboard` : MBTI 사주 메인 화면
- `/admin` : 관리자 전용 운영 요약 화면
- `/admin/stats` : 관리자 전용 통계 화면
- `/admin/stats/scenarios/[readingType]/[subjectType]` : 관리자 전용 시나리오 통계 drill-down
- `/admin/users` : 관리자 전용 전체 사용자 목록
- `/admin/users/[userId]` : 관리자 전용 사용자 상세 / 복 수동 조정
- `/admin/failures` : 관리자 전용 실패 로그 목록
- `/admin/readings` : 관리자 전용 전체 최근 해석 목록
- `/bok` : 복 지갑, 충전 내역, Mock 충전
- `/saju/readings/[readingId]` : 사주 풀이 상세 보기

## 기술 요약

- Next.js 15 App Router
- React 19
- TypeScript strict
- Tailwind CSS 4
- shadcn/ui
- manseryeok 기반 사주 계산
- Prisma + PostgreSQL
- JWT + httpOnly cookie 세션
- 로컬 Codex CLI 기반 LLM 렌더링

## 빠른 시작

### 1. 설치

```bash
pnpm install
```

### 2. 환경변수 준비

`.env.example`를 복사해 `.env`를 만듭니다.

```bash
cp .env.example .env
```

기본적으로 확인할 값

- `DATABASE_URL`
- `JWT_SECRET`
- `SAJU_PIPELINE_MODE`
- `SAJU_LLM_MODE`
- `SAJU_LLM_COMMAND`

### 3. 로컬 DB 초기화

로컬 PostgreSQL이 실행 중이어야 합니다.

```bash
pnpm db:init:local
pnpm db:migrate:dev init
```

### 4. 개발 서버 실행

```bash
pnpm dev
```

기본 주소: `http://localhost:4000`

## 자주 쓰는 명령어

```bash
pnpm dev
pnpm test
pnpm lint
pnpm typecheck
pnpm prisma:studio
pnpm db:init:local
pnpm db:migrate:dev <name>
pnpm db:migrate:deploy
pnpm saju:llm:smoke
pnpm saju:failures -- --limit 20
pnpm admin:ensure:local
```

## 로컬 DB 운영

### 최초 1회

```bash
pnpm db:init:local
pnpm db:migrate:dev init
```

### 스키마 변경 시

```bash
pnpm db:migrate:dev add_some_change
```

### 현재 상태 확인

```bash
pnpm exec prisma migrate status
```

운영 환경에서는 `prisma migrate dev`를 사용하지 않고 아래만 사용합니다.

```bash
pnpm db:migrate:deploy
```

## LLM 연동

현재 해석 생성기는 아래 모드를 지원합니다.

- `rule-only`
- `verified-llm-optional`
- `verified-llm-required`

기본 권장

- 일반 로컬 개발: `verified-llm-optional`
- 품질 점검: `verified-llm-required`

### 로컬 Codex 연결 준비

1. Codex CLI 로그인

```bash
codex login
```

2. `.env` 확인

```bash
SAJU_PIPELINE_MODE="verified-llm-optional"
SAJU_LLM_MODE="local-codex"
SAJU_LLM_COMMAND="bash scripts/saju/run-codex-json.sh"
SAJU_CODEX_DISABLE_MCP="true"
SAJU_CODEX_RUNTIME_HOME=""
SAJU_LLM_MAX_ATTEMPTS="1"
SAJU_LLM_TIMEOUT_MS="30000"
SAJU_LLM_REVIEW_ENABLED="false"
```

3. 연결 확인

```bash
pnpm saju:llm:smoke
```

참고

- `SAJU_CODEX_MODEL`로 모델을 지정할 수 있습니다.
- `SAJU_CODEX_DISABLE_MCP="true"`면 Codex를 MCP 없는 런타임으로 실행합니다.
- `SAJU_LLM_REVIEW_ENABLED="true"`일 때만 리뷰 단계를 추가 실행합니다.

## 현재 제품 정책

- `1복 = 777원`
- 해석 1회 생성 시 `1복` 사용
- 동일 사용자 동일 입력 재조회는 무차감
- 생성 실패 시 복은 차감되지 않음
- 실패 건은 사용자 목록에 남기지 않고 내부 로그만 적재
- 일반 해석은 연 단위, `올해운/월운/오늘운` 계열은 일 단위 시기 키를 사용

## 실패 로그 확인

최근 사주 생성 실패 로그를 로컬에서 바로 확인할 수 있습니다.

```bash
pnpm saju:failures -- --limit 20
pnpm saju:failures -- --stage LLM_RENDER
pnpm saju:failures -- --user <userId>
pnpm saju:failures -- --json
```

## 로컬 관리자 계정

로컬에서 관리자 화면까지 확인하려면 아래를 한 번 실행합니다.

```bash
pnpm admin:ensure:local
```

기본 계정

- email: `admin@mbti-saju.local`
- password: `Admin1234!`

환경변수 `ADMIN_EMAIL`, `ADMIN_PASSWORD`를 넣으면 다른 값으로 만들 수 있습니다.

## 현재 구현 범위

### 완료

- 회원가입/로그인
- 온보딩 저장/수정
- 무료 MBTI 검사 및 저장
- 복 지갑/Mock 충전
- 상대 프로필 생성/수정/삭제
- 사주 보기 / 궁합 보기
- 최근 해석 목록 / 상세 풀이
- 룰 엔진 + LLM 파이프라인
- 만세력 기반 일간/오행/대운 계산 연결
- 보이는 천간 기준 십성(연간/월간/시간) 반영
- 지장간(연지/월지/일지/시지) 기반 보조 근거 반영
- 12운성(월지 중심) 기반 흐름 해석 반영
- 월지/뿌리/지장간/십성 가중치 기반 용신/희신/기신 판정
- 재물운/직업운/연애·배우자·궁합 하위 유형 분기 반영
- 실패 복구 및 실패 로그 적재
- httpOnly cookie 기반 인증 전환
- 관리자 전용 운영 요약 / 사용자 목록 / 실패 로그 / 해석 목록 화면
- 관리자 전용 통계 화면(`/admin/stats`)
- 시나리오별 통계 drill-down 및 기간 필터
- 관리자 사용자 상세에서 복 수동 충전/차감 및 조정 이력 확인

### 아직 남은 것

- 실제 PG 결제 연동
- 이메일 인증
- 큐 기반 비동기 생성 파이프라인
- 관측성 도구(Sentry 등)

## 문서

- [서비스 구조](docs/mbti-saju-service-structure.md)
- [기술 아키텍처](docs/mbti-saju-technical-architecture.md)
- [기술 스택](docs/mbti-saju-tech-stack.md)
- [구현 현황/계획](docs/implementation-plan.md)
- [DB 운영](docs/db-operations.md)
- [제품 리뷰](docs/product-review.md)
- [FE 표준](docs/fe-standards.md)
