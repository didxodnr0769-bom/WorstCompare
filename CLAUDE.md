# CLAUDE.md

이 저장소에서 작업할 때 Claude가 따르는 규칙과 프로젝트 개요입니다.

## 프로젝트 개요

WorstCompare — 로컬 두 폴더를 트리로 비교하고, 파일 상세 diff에서 hunk 단위로 변경을 반대편에 적용한 뒤 저장하는 개인용 Electron 데스크톱 도구.

- 스택: Electron + React 19 + TypeScript + Vite, diff 엔진은 `diff` v8.
- 주요 파일:
  - `src/main.ts` — Electron 메인 프로세스, 파일 시스템 IPC 핸들러(compare/read/save/copy/delete).
  - `src/preload.ts` — `window.api` 브리지.
  - `src/renderer/App.tsx` — 화면 상태(setup/diff), 비교 실행, Undo/Redo, busy 오버레이.
  - `src/renderer/components/DualTreeView.tsx` — 좌/우 트리, 복사·삭제 액션.
  - `src/renderer/components/DiffView.tsx` — 좌/우 라인 정렬 diff, hunk 적용, 미니맵.
- 사양 문서: `prd.md`, `SPEC.md`.

## 명령어

- `npm run dev` — Vite 개발 서버.
- `npm run build` — `tsc && vite build` (타입 체크 + 빌드).
- `npm test` — vitest.
- `npm run lint` — eslint.
- `npm run format` — prettier.
- `npm run release <major|minor|patch|auto> [--push]` — 버전 bump + CHANGELOG + 커밋 + 태그.

## UI 문구

사용자 노출 문구는 **한국어**로 작성한다 (비교 중…, 복사 중…, 전체 저장 등). 키보드 단축키 힌트(Alt+↑/↓ 등)는 그대로 둔다.

## 버전 관리 / 릴리즈 정책

- 버전은 **0.1.0** 부터 시작하며 [SemVer](https://semver.org/lang/ko/)를 따른다.
- **push 할 때마다 버전을 올린다.** 즉, push 전에 반드시 릴리즈(버전 bump + 태그)를 만든다.
- 릴리즈 노트는 `CHANGELOG.md` 에 버전별 섹션으로 작성하며, **직전 태그 이후의 변경사항**만 정리한다.
- `scripts/hooks/pre-push` 가 main 브랜치 push 시 "현재 package.json 버전 태그가 push 대상 커밋에 있는지"를 검사해 버전 누락 push를 막는다. (`core.hooksPath=scripts/hooks`, 우회는 `git push --no-verify`)

### 릴리즈 만드는 법

1. 기능/수정 작업을 먼저 커밋한다. 가능하면 conventional commits 사용: `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, 호환성 파괴는 `feat!:` 또는 본문에 `BREAKING CHANGE`.
2. `npm run release <level> [--push]` 실행 — 버전 bump, CHANGELOG 새 섹션 생성(직전 태그 이후 커밋 기반), `chore(release): vX.Y.Z` 커밋, `vX.Y.Z` 태그 생성. `--push` 시 `git push --follow-tags` 까지.
3. (Claude) 자동 생성된 릴리즈 노트를 사람이 읽기 좋게 다듬는다.

### Claude가 push 요청을 받았을 때 따르는 절차

사용자가 "push" 또는 배포를 요청하면:

1. `git log <직전 태그>..HEAD` 로 직전 릴리즈 이후 변경사항을 확인한다.
2. 변경 성격으로 올릴 버전 영역을 **판단**한다:
   - **patch** (X.Y.Z+1): 버그 수정, 내부 리팩터링, 문서/스타일 등 사용자 체감 기능 변화 없음.
   - **minor** (X.Y+1.0): 새 기능, 눈에 띄는 UX 변경 등 하위 호환 추가.
   - **major** (X+1.0.0): 하위 호환을 깨는 변경(기능 제거/이름 변경, 파일 포맷·저장 동작 변경 등).
     단, **버전이 1.0.0 미만인 동안에는** 호환성 파괴도 minor로 올리고, 앱이 안정 단계에 이르렀다고 판단되면 그때 1.0.0을 선언한다.
3. 결정한 레벨로 `npm run release <level>` 을 실행하고, 생성된 릴리즈 노트를 다듬은 뒤 `git push --follow-tags` 한다.
4. 어느 레벨로 올릴지와 그 이유를 사용자에게 한 줄로 알린다.
