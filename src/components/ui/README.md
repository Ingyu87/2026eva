# Design system primitives (Figma-style marketing)

이 폴더의 컴포넌트와 [`app/styles/tokens.css`](../../../app/styles/tokens.css) 토큰만 사용해 UI를 구성합니다.

## 원칙

- **Chrome은 흑백**: 배경 `--color-canvas`, 텍스트 `--color-ink`, 주요 CTA는 `Button variant="primary"` (검정 pill).
- **스토리는 파스텔 블록**: 섹션 강조는 `ColorBlockSection`의 `tone` 하나만 (`lime` | `lilac` | `cream` | `mint` | `pink` | `coral` | `navy`). 임의 색 추가 금지.
- **버튼은 pill만**: `Button` / `Pill`. 사각형 primary 버튼 없음.
- **Mono는 taxonomy만**: 구역 라벨은 `Eyebrow`, 컬럼 헤드는 `Caption` — 본문 단락에 쓰지 않음.
- **그림자 최소**: 깊이는 색 블록 전환으로. 카드는 `hairline` 테두리.

## 화면 매핑 (본 앱)

| 영역 | 권장 토큰 / 컴포넌트 |
|------|---------------------|
| 최상단 바 | `TopNav` + 우측 `Button` secondary / primary 쌍 |
| 로그인 히어로 | `ColorBlockSection tone="lilac"` + `Eyebrow` |
| 설문 빌더 우측 패널 | `ColorBlockSection tone="lime"` |
| 대상 탭 (교원/학부모/…) | `Pill` selected = 검정 채움 (`pricing-tab` 패턴) |
| 푸터 | `Footer` |

## Codex에 넘길 한 줄

이제부터 UI는 `app/styles/tokens.css`와 `src/components/ui/*`의 토큰·컴포넌트만 사용한다. 새 색·새 버튼 모양·그림자는 넣지 말고, 색이 필요하면 `<ColorBlockSection tone="lime|lilac|cream|mint|pink|coral|navy">`만 사용한다.
