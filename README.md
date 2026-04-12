# Worst Compare

**Worst Compare**는 로컬의 두 폴더를 트리 구조로 비교하고, 파일 간의 차이점(diff)을 분석하여 선택적으로 변경 사항을 반영할 수 있는 효율적인 데스크톱 애플리케이션입니다.

> 🚀 이 프로젝트는 **gemini-cli**를 이용한 **바이브 코딩(Vibe Coding)**으로 작성되었습니다. 모든 기능 구현과 아키텍처 설계는 AI 에이전트와의 협업을 통해 이루어졌습니다.

---

## 🌟 주요 기능 (Key Features)

- **폴더 트리 비교:** 두 폴더 간의 파일 구조를 한눈에 파악하고 `Same`, `Modified`, `Left-only`, `Right-only` 상태를 식별합니다.
- **Side-by-side Diff:** 텍스트 파일의 차이점을 나란히 비교하며 시각적으로 확인합니다.
- **Hunk 단위 병합:** 파일 전체가 아닌 변경 블록(Hunk) 단위로 좌↔우 변경 사항을 선택적으로 적용할 수 있습니다.
- **Undo / Redo:** 실수로 반영한 변경 사항을 최대 50단계까지 되돌리거나 다시 실행할 수 있습니다.
- **작업 버퍼 및 저장:** 변경 사항을 즉시 파일에 쓰지 않고 메모리 버퍼에 유지하며, `Ctrl+S`를 통해 명시적으로 저장합니다.
- **다크/라이트 테마:** 사용자의 기본 설정에 맞춘 시각적 테마를 지원합니다.

## 🛠 기술 스택 (Tech Stack)

- **Runtime:** [Electron](https://www.electronjs.org/)
- **Frontend:** [React](https://react.dev/) (v19), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** Vanilla CSS
- **Utilities:** `diff` (Hunk 분석), `lucide-react` (아이콘)
- **Testing:** [Vitest](https://vitest.dev/)

## 🚀 시작하기 (Getting Started)

### 설치 (Installation)

```bash
npm install
```

### 실행 (Development)

```bash
npm run dev
```

### 빌드 (Build)

```bash
npm run build
```

---

## 📖 문서 (Documentation)

- [PRD.md](./prd.md): 제품 요구사항 정의서
- [SPEC.md](./SPEC.md): 기능 및 기술 명세서
- [GEMINI.md](./GEMINI.md): AI 에이전트 운영 지침 및 프로젝트 컨텍스트
