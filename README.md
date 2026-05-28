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

> `dist/`(렌더러)와 `dist-electron/`(메인/프리로드)에 산출물만 생성됩니다. 실제 배포 가능한 `.app` / `.dmg`는 아래 패키징 단계에서 만들어집니다.

---

## 📦 패키징 및 실행 (Packaging & Distribution)

본 프로젝트는 [`electron-builder`](https://www.electron.build/)를 사용해 macOS용 패키지를 생성합니다.

### 사용 가능한 스크립트

| 스크립트           | 설명                                                   | 결과물                                     |
| ------------------ | ------------------------------------------------------ | ------------------------------------------ |
| `npm run pack`     | 압축/서명 없이 `.app` 번들만 빠르게 생성 (개발 검증용) | `release/mac-arm64/WorstCompare.app`       |
| `npm run dist:mac` | 배포용 DMG 인스톨러 생성                               | `release/WorstCompare-<version>-arm64.dmg` |

> 최초 실행 시 Electron 런타임 바이너리(~116MB)를 다운로드하므로 2~3분 소요됩니다. 이후 실행은 캐시를 사용해 훨씬 빠릅니다.

### 1) DMG 인스톨러로 배포하기

```bash
npm run dist:mac
open release/WorstCompare-1.0.0-arm64.dmg
```

마운트된 DMG에서 `WorstCompare.app`을 `Applications` 폴더로 드래그한 뒤 Launchpad나 Spotlight에서 실행합니다.

### 2) 빌드된 .app 바로 실행 (검증용)

```bash
npm run pack
open release/mac-arm64/WorstCompare.app
```

### 3) 개발 모드 (패키징 없이 코드 변경을 즉시 반영)

```bash
npm run dev
```

### macOS 보안 경고 우회

코드 서명(Code Signing)을 하지 않았기 때문에 다른 머신에서 실행 시 Gatekeeper가 차단할 수 있습니다. 다음 중 하나로 해결합니다.

```bash
# 격리 속성(quarantine) 제거
xattr -cr release/mac-arm64/WorstCompare.app
open release/mac-arm64/WorstCompare.app
```

또는 Finder에서 **우클릭 → "열기" → "열기"**를 선택해 1회만 허용해주면 됩니다.

### 패키징 설정 위치

모든 설정은 `package.json`의 `build` 필드에 있습니다.

```json
{
  "build": {
    "appId": "com.taewook.worstcompare",
    "productName": "WorstCompare",
    "directories": { "output": "release" },
    "files": ["dist/**/*", "dist-electron/**/*", "package.json"],
    "mac": {
      "target": [{ "target": "dmg", "arch": ["arm64"] }],
      "category": "public.app-category.developer-tools",
      "identity": null
    }
  }
}
```

### 자주 하는 커스터마이징

- **Intel Mac까지 지원** → `mac.target[0].arch`를 `["arm64", "x64"]` 또는 `["universal"]`로 변경
- **앱 아이콘 교체** → `build.mac.icon`에 `.icns` 파일 경로 지정 (예: `"build/icon.icns"`)
- **정식 서명/공증** → Apple Developer ID 인증서 발급 후 `identity`를 해당 인증서 이름으로 변경하고, 노타리제이션(notarization) 설정 추가
- **Windows/Linux 추가** → `build.win` / `build.linux` 섹션과 `dist:win` / `dist:linux` 스크립트 추가

---

## 📖 문서 (Documentation)

- [PRD.md](./prd.md): 제품 요구사항 정의서
- [SPEC.md](./SPEC.md): 기능 및 기술 명세서
- [GEMINI.md](./GEMINI.md): AI 에이전트 운영 지침 및 프로젝트 컨텍스트
