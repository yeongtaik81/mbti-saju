# Algorithmic Trading

레짐 적응형 스윙 트레이딩 시스템. 한국투자증권(KIS) API 기반 자동매매.

## 프로젝트 구조

```
algorithmic-trading/
├── apps/
│   ├── engine/          # TypeScript 트레이딩 엔진 (핵심 로직)
│   └── app/             # Android 자동매매 앱 (Kotlin/Compose)
├── web/                 # Next.js 백테스트 웹 UI
├── packages/
│   └── shared/          # 공유 타입 및 상수 (TypeScript)
└── docs/                # 설계 문서
```

## 모듈별 역할

### `apps/engine/` - 트레이딩 엔진

전략 로직의 원본. TypeScript로 작성.

- 기술 지표 계산 (SMA, RSI, ATR)
- 시그널 생성 (MA 지지, 변동성 돌파)
- Breadth 기반 시장 레짐 판단
- 주문 상태 머신, 리스크 관리
- KIS REST API 클라이언트

### `apps/app/` - Android 앱 (실전 매매용)

엔진 로직을 Kotlin으로 포팅한 모바일 자동매매 앱.

- Foreground Service로 장중 30초 폴링
- 08:00 자동 시작 ~ 15:40 자동 종료
- 모의/실전 환경 전환
- Room DB, Hilt DI, Jetpack Compose UI

### `web/` - 백테스트 웹 (전략 검증용)

Next.js 기반 백테스트 및 데이터 관리 UI.

- 일봉 데이터 수집 및 관리
- 백테스트 실행 및 결과 시각화
- 전략 파라미터 튜닝
- `@trading/engine` 로직 재사용

### `packages/shared/` - 공유 패키지

engine과 web에서 공통으로 사용하는 TypeScript 타입 및 상수.

- 시장/주문/포지션/전략 타입 정의
- 호가 단위, 수수료 규칙

## 전략 개요

**레짐 적응형 스윙 (Regime-Adaptive Swing)**

| 레짐    | 매수 조건              | 매도 조건                   |
| ------- | ---------------------- | --------------------------- |
| BULL    | 이동평균 지지 매수     | 손절 -7% 또는 보유 7일 초과 |
| BEAR    | 변동성 돌파 + RSI 필터 | 동일                        |
| NEUTRAL | 매수 안 함             | 동일                        |

- 시장 레짐: Breadth (20일 SMA 위 종목 비율)로 판단
- BULL > 50%, BEAR < 40%, 그 사이 NEUTRAL

## 기술 스택

| 구분 | 기술                                          |
| ---- | --------------------------------------------- |
| 엔진 | TypeScript, Node.js, better-sqlite3           |
| 앱   | Kotlin, Jetpack Compose, Room, Hilt, Retrofit |
| 웹   | Next.js, React, Tailwind CSS                  |
| API  | 한국투자증권 KIS REST API                     |

## 리스크 관리 (기본값)

- 최대 보유 종목: 10개
- 종목당 최대 비중: 20%
- 종목당 최대 금액: 100만원
- 일일 손실 한도: -3%

## 시작하기

### TypeScript (엔진 + 웹)

```bash
pnpm install
pnpm build
pnpm test
```

### Android 앱

Android Studio에서 `apps/app/` 열기 → Run

## 문서

- [PRD](docs/PRD.md) - 제품 요구사항
- [DESIGN](docs/DESIGN.md) - 시스템 설계
- [WORKFLOW](docs/WORKFLOW.md) - 개발 워크플로우
- [Standards](docs/standards.md) - 코딩 표준
