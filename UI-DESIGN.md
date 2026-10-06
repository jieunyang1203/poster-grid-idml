# UI 디자인 가이드 — 캔버스 + 인스펙터

포스터 그리드 툴(`~/Desktop/poster-grid-idml`)에서 쓴 UI 규칙.
레퍼런스: [모크업 생성기](https://products.minguhongmfg.com/mockup-generator/) (기능 말고 톤만 참고).
다른 프로젝트에 적용할 때 이 파일과 `style.css`를 같이 넘기면 된다.

---

## 1. 원칙

- **회색 하나로 끝낸다.** 색은 검정의 투명도(5 / 7.5 / 10 / 37.5 / 75%)만 쓴다. 포인트 컬러는 없다. 색은 작업물(캔버스)에만 쓴다.
- **선보다 면.** 컨트롤은 테두리 없이 옅은 회색 면으로 구분한다. 선(1px, 10%)은 영역을 나눌 때만 쓴다.
- **설명 문구를 넣지 않는다.** 라벨은 짧은 명사(`단 수`, `여백`, `도련`)로 쓴다. 도움말, 빈 상태 안내, 버전 표시, 개수 표시는 넣지 않는다.
- **숫자는 오른쪽 정렬, 단위는 흐리게.** `폭 ······ 594 mm`처럼 쓴다.
- **작고 촘촘하게.** 루트 글자 크기는 12px, 컨트롤 높이는 36px(3rem)이다.
- **상태는 면의 진하기로 보여준다.** 기본 5% → 호버 7.5% → 선택 10%. 선택된 글자는 진하게, 선택 안 된 글자는 흐리게 한다.

---

## 2. 토큰

```css
:root {
  --text: rgba(0, 0, 0, .75);
  --text-muted: rgba(0, 0, 0, .375);
  --border-color: rgba(0, 0, 0, .1);
  --control-background: rgba(0, 0, 0, .05);
  --control-background-hover: rgba(0, 0, 0, .075);
  --control-background-active: rgba(0, 0, 0, .1);
  --background: #fff;
  --canvas: #333;            /* 작업물 뒤 배경 */

  --space-xs: .25rem;        /* 3px */
  --space-sm: .5rem;         /* 6px  — 컨트롤 사이 간격 */
  --space-md: .75rem;        /* 9px  — 패널 안쪽 여백 */
  --space-lg: 1rem;          /* 12px */
  --border: 1px solid var(--border-color);
  --radius: .25rem;          /* 3px */
  --control-height: 3rem;    /* 36px */
}

html { font-size: 12px; }
body {
  font-family: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  word-break: keep-all;
  color: var(--text);
  user-select: none;         /* 툴 느낌. 텍스트 입력칸만 다시 켠다 */
}
```

폰트(Pretendard) CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css">
```

| 용도 | 값 |
|---|---|
| 본문 / 라벨 | 12px, 500 |
| 단위 (`mm`, `.idml`) | 0.875rem(10.5px), `--text-muted` |
| 굵기 | 500 하나만 쓴다. 강조는 굵기가 아니라 진하기(75% vs 37.5%)로 한다 |

---

## 3. 레이아웃

```
┌──────────────────────────────┬────────────┐
│                              │ [모드 전환]  │
│                              ├────────────┤
│        캔버스 (#333)          │ ▾ 섹션      │
│        작업물 가운데 맞춤        │   컨트롤    │
│                              │ ▾ 섹션      │  ← 여기만 스크롤
│                              │   ...      │
│ 수치 표시줄 (흰색 50%)          ├────────────┤
│                              │ [파일명]    │  ← 하단 고정
│                              │ [주 버튼]   │
└──────────────────────────────┴────────────┘
                                 25rem (300px)
```

```css
.main { position: fixed; inset: 0; display: grid; grid-template-columns: minmax(0, 1fr) 25rem; }
.stage { position: relative; background: var(--canvas); }
.inspector { display: flex; flex-direction: column; overflow: hidden; border-left: var(--border); }
.inspector-main { flex: 1 1 auto; overflow-y: auto; }
.inspector-footer { display: grid; gap: var(--space-sm); padding: var(--space-md); border-top: var(--border); }
```

- 페이지 전체는 스크롤하지 않는다. 스크롤되는 곳은 인스펙터 가운데뿐이다.
- 캔버스 여백은 위·양옆 56px, 아래 64px(수치 표시줄 자리)이다.
- 수치 표시줄은 캔버스 왼쪽 아래에 둔다. 라벨은 흰색 50%, 값은 흰색 85%로 한다. 값이 잘못되면(예: 단 너비가 음수) 붉은색(`#ff8a80`)으로 바꾸고 저장 버튼을 끈다.

---

## 4. 컴포넌트

### 섹션 (접기/펼치기)
`<details>` / `<summary>`를 쓴다. 제목 높이는 36px이다. 닫힌 섹션의 제목은 흐리게, 열린 섹션은 진하게 한다. 열린 섹션의 제목은 스크롤할 때 위에 붙어 있게(`position: sticky`) 한다. 오른쪽 화살표는 `clip-path`로 그린 꺾쇠이고, 열리면 180° 돈다.

```html
<details class="section" open>
  <summary>여백</summary>
  <div class="section-body"> … </div>
</details>
```

### 숫자 입력
라벨은 왼쪽, 값은 오른쪽 정렬, 단위는 흐리게 한다. 화살표 키로 한 칸씩, Shift+화살표로 10칸씩 움직인다. 입력칸에서 나가면 값을 다시 정리한다.

```html
<label class="control number-field">
  <span>폭</span><input type="number"><span class="field-unit">mm</span>
</label>
```

### 슬라이더 + 숫자
`라벨 5rem | 슬라이더 | 숫자 4rem` 3칸으로 나눈다. 트랙은 2px 두께의 10% 회색, 손잡이는 12px 크기의 75% 원이다.

### 세그먼트 (2–3개 중 하나 고르기)
버튼 사이 간격은 1px이고, 바깥 모서리만 둥글다. 선택된 버튼은 면 10%에 진한 글자, 나머지는 흐린 글자로 한다.
예: `세로 | 가로`, `pt | mm`, `포스터 | 책`

### 토글
행 전체가 버튼이다. 라벨은 왼쪽, 오른쪽에 12px 원을 두고, 꺼지면 10%, 켜지면 75%로 채운다. 체크박스 모양은 쓰지 않는다.

### 선택 (드롭다운)
기본 `<select>`를 쓰되 외형을 지운다. 값은 오른쪽 정렬하고, 화살표는 배경 그라데이션으로 그린 작은 꺾쇠를 쓴다.

### 목록 (프리셋)
항목 사이 간격은 1px이고, 목록 전체만 둥글다. 항목은 `이름 | ×` 두 칸이고, `×`는 흐린 버튼으로 둔다.

### 버튼
| 종류 | 모양 |
|---|---|
| 기본 | 면 5%, 호버 7.5% |
| 주 버튼 (`data-variant="primary"`) | 검정 80%, 흰 글자, 호버하면 검정 100%. 화면에 하나만 둔다 |
| 조용한 버튼 (`quiet`) | 배경 없음, 흐린 글자, 호버하면 진한 글자 |
| 비활성 | 투명도 50% |

### 토스트
화면 아래 가운데에 검정 80% 배경, 흰 글자로 띄우고 1.8초 뒤 사라진다. 내용은 결과만 짧게 쓴다(`저장됨 · 이름`, `A1_12단.idml`).

---

## 5. 배치 규칙

- 관련된 두 값은 한 줄에 반씩 놓는다(`폭 | 높이`, `위 | 아래`).
- 숫자 입력과 단위 전환처럼 폭이 다른 두 개를 한 줄에 둘 때는 `minmax(0,1fr) auto`로 나눈다.
- 섹션 순서는 작업 흐름을 따른다. **모드 → 프리셋 → 크기 → 세부값 → 보기 옵션**이고, 자주 안 쓰는 섹션은 닫아 둔다.
- 저장/내보내기는 항상 하단에 고정한다. 단축키는 ⌘S로 한다.
- 설정은 바뀌는 즉시 캔버스에 반영한다. 적용 버튼은 두지 않는다.
- 마지막 설정은 `localStorage`에 자동 저장한다. 읽고 쓸 때는 `try/catch`로 감싼다.

---

## 6. 캔버스 안 색 (이 툴 전용, 참고용)

인디자인 화면 색을 따라 했다. 다른 프로젝트에서는 작업물에 맞게 바꾸면 된다.

| 요소 | 색 |
|---|---|
| 여백 | `#d63cc4` |
| 단 | `#8a4fd8`, 단 면 7% |
| 행 안내선 | `#16b3d6` |
| 기준선 | `rgba(90,170,240,.45)` |
| 도련 | `rgba(255,80,80,.7)` |

---

## 7. 다른 프로젝트에 적용할 때 넘길 요청 예시

> `UI-DESIGN.md`와 `style.css`를 기준으로 UI를 맞춰줘. 왼쪽은 #333 캔버스, 오른쪽은 25rem 인스펙터(접히는 섹션)로 하고, 회색 투명도만 쓰고, 설명 문구는 빼줘.
