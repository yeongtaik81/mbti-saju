#!/usr/bin/env bash
set -euo pipefail

bash scripts/saju/run-codex-json.sh <<'JSON'
{
  "input": {
    "cacheKey": "smoke-self-basic",
    "periodContext": {
      "scope": "YEARLY",
      "periodKey": "2026",
      "referenceDate": "2026-03-06"
    },
    "readingType": "SELF",
    "subjectType": "BASIC",
    "userName": "테스트",
    "userMbtiType": "INTJ",
    "userBirthInfo": {
      "birthDate": "1984-03-06",
      "birthTime": "12:00",
      "birthTimeUnknown": false,
      "birthCalendarType": "SOLAR",
      "isLeapMonth": false,
      "gender": "FEMALE"
    }
  },
  "draft": {
    "summary": "기본 요약 초안입니다.",
    "sectionsJson": {
      "overview": "전체 흐름 초안입니다.",
      "coreSignal": "금 기운은 단단하고 목 기운은 보완이 필요합니다.",
      "caution": "속도를 너무 앞세우면 관계의 숨 고르기가 부족해질 수 있습니다.",
      "actions": [
        "이번 주 우선순위를 하나로 줄이기",
        "지출 기록을 3일 연속 남기기",
        "중요한 대화를 오전에 배치하기"
      ],
      "reflectionQuestion": "지금 가장 먼저 정리해야 할 생활 리듬은 무엇인가요?",
      "sajuEvidence": [
        "금 기운이 상대적으로 강해 기준과 원칙을 세우는 힘이 좋습니다.",
        "목 기운이 약해 새 판을 넓히는 속도는 의식적으로 보완해야 합니다."
      ],
      "currentDaewoon": "현재 대운은 기반을 다시 다지는 흐름입니다.",
      "yearlyFlow": "2026년은 성급한 확장보다 구조 정리에 유리합니다.",
      "wealthFlow": "재물운은 큰 한 방보다 누수를 줄일 때 안정적으로 올라옵니다.",
      "relationshipFlow": "관계운은 내 기준을 설명하는 방식에 따라 체감이 달라집니다.",
      "timingHint": "중요한 시작은 오전 집중 시간대가 좋습니다."
    }
  },
  "instruction": "Return strict JSON only."
}
JSON
