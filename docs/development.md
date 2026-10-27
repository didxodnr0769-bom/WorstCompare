# 개발 및 패키징

소스를 실행하고 검사하거나 macOS 앱과 DMG를 생성하는 방법입니다.

[앱 소개](../README.md) · [사용법과 앱 설치](./usage.md)

## 준비 환경

- Node.js: **22.x (22.13.0 이상) 권장**
- Node.js 24.x도 지원하며, **22.23.4와 24.22.1에서 테스트·빌드를 검증**했습니다.
- npm
- Git
- 현재 패키징 대상: macOS 13 이상, Apple Silicon (`arm64`)

`package.json`의 Node.js 지원 범위는 `^22.13.0 || ^24.0.0`입니다. Electron 45 설치 패키지는 Node.js 22.12 이상을 요구하므로 Node 20·21은 지원하지 않습니다.

저장소의 `.nvmrc`는 권장 계열인 `22`를 지정합니다. nvm을 사용한다면 아래 명령처럼 의존성 설치 전에 `nvm install`과 `nvm use`로 현재 터미널을 전환하세요. nvm을 사용하지 않는 경우에는 지원 범위에 맞는 Node.js를 설치한 뒤 진행합니다.

## 소스 실행

```bash
git clone https://github.com/didxodnr0769-bom/WorstCompare.git
cd WorstCompare
nvm install
nvm use
node -v
npm ci --include=dev --include=optional
npm run dev
```

`npm run dev`는 Vite 개발 서버와 Electron 앱을 함께 실행합니다. 파일을 수정하면 개발 화면에 반영됩니다.

## 검사와 빌드

```bash
npm test
npm run lint
npm run build
```

`npm run build`는 TypeScript 타입 검사 후 `dist/`에 렌더러, `dist-electron/`에 메인·프리로드 번들을 생성합니다. 실행 가능한 앱 번들과 설치 파일은 패키징 명령으로 만듭니다.

## macOS 패키징

### 앱 번들 생성

```bash
npm run pack
open release/mac-arm64/WorstCompare.app
```

`release/mac-arm64/WorstCompare.app`을 생성합니다. 설치 파일 없이 앱을 실행해 확인할 때 사용할 수 있습니다.

### DMG 생성

```bash
npm run dist:mac
open release
```

`release/WorstCompare-<version>-arm64.dmg`를 생성합니다. 다른 PC에 전달할 때는 DMG를 사용하고, 설치·업데이트 방법은 [사용법](./usage.md)을 함께 안내하세요.

Electron 런타임이 캐시에 없으면 패키징 과정에서 다운로드합니다. 현재 설정의 `identity`는 `null`이므로 개발자 서명·공증을 수행하지 않습니다.

## 기존 소스 업데이트

프로젝트 폴더에서 현재 변경사항을 확인한 뒤 업데이트합니다.

```bash
git status
git switch main
git pull --ff-only origin main
nvm install
nvm use
npm ci --include=dev --include=optional
```

개발 실행은 `npm run dev`, 설치 앱 교체용 DMG 생성은 `npm run dist:mac`을 사용합니다. 소스를 갱신해도 이미 응용 프로그램 폴더에 복사한 앱이 자동으로 바뀌지는 않습니다.

## 주요 명령어

| 명령                      | 용도                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`             | Vite 개발 서버와 Electron 앱 실행                                             |
| `npm test`                | Vitest 테스트 1회 실행                                                        |
| `npm run lint`            | `src`의 ESLint 검사                                                           |
| `npm run build`           | 타입 검사와 앱 번들 코드 생성                                                 |
| `npm run preview`         | Vite 산출물 미리보기. Electron IPC를 포함한 앱 검증에는 개발·패키징 실행 사용 |
| `npm run pack`            | `.app` 번들 생성                                                              |
| `npm run dist:mac`        | `.app`과 DMG 생성                                                             |
| `npm run format`          | 소스·테스트·문서·설정의 Prettier 포맷 적용                                    |
| `npm run release <level>` | 버전·CHANGELOG·릴리즈 커밋·태그 생성                                          |
| `npm run prepare`         | `scripts/hooks`를 Git hooks 경로로 지정                                       |

## 릴리즈

기능·수정 변경사항을 먼저 커밋한 뒤 릴리즈를 생성합니다.

```bash
npm run release patch
```

변경 성격에 따라 `patch`, `minor`, `major`를 선택합니다. 이 저장소에서는 push 전에 버전을 올리고, `CHANGELOG.md`는 직전 태그 이후 변경사항만 기록합니다. 버전이 1.0.0 미만인 동안 호환성을 깨는 변경은 minor로 올립니다.

생성된 릴리즈 노트를 확인하고, 최종 릴리즈 커밋에 버전 태그가 연결되어 있는지 확인한 뒤 push합니다.

```bash
git push --follow-tags
```

`main`의 pre-push 훅은 현재 `package.json` 버전 태그가 push 대상 커밋을 가리키는지 검사합니다. `npm run release <level> -- --push`는 릴리즈 생성 후 push까지 수행합니다.

## 패키징 설정 변경

설정은 `package.json`의 `build` 필드에 있습니다.

- `appId`: `com.taewook.worstcompare`
- `productName`: `WorstCompare`
- `directories.output`: `release`
- `mac.target`: `dmg`, `arm64`
- `mac.minimumSystemVersion`: `13.0.0`
- `mac.identity`: `null`

Intel Mac이나 Windows·Linux를 지원하려면 대상 아키텍처·플랫폼 설정과 빌드 명령을 추가하고 해당 환경에서 검증해야 합니다. 아이콘은 `build.mac.icon`, macOS 배포 서명·공증은 개발자 인증서와 패키징 설정을 통해 구성합니다.

## 문제 해결

### Node 버전 오류

`node -v`로 현재 터미널의 Node 버전을 확인합니다. nvm을 사용한다면 저장소 폴더에서 아래 명령을 실행해 `.nvmrc`가 지정한 Node 22.x로 전환한 뒤 의존성을 재설치합니다.

```bash
nvm install
nvm use
node -v
npm ci --include=dev --include=optional
```

### Rolldown 네이티브 모듈 누락

`Cannot find module '@rolldown/binding-...'`가 나오면 Node 버전과 CPU 아키텍처를 확인합니다.

```bash
nvm install
nvm use
node -p 'process.version + " " + process.platform + " " + process.arch'
npm ci --include=dev --include=optional
```

잠금 파일에는 플랫폼별 Rolldown 의존성이 포함되어 있습니다. `npm ci`는 기존 `node_modules`를 정리하고 잠금 파일 기준으로 설치하며, 위 옵션은 빌드 도구와 선택 의존성이 빠지지 않도록 합니다.

### `npm ci`가 잠금 파일을 찾지 못하는 경우

명령을 실행한 폴더가 이 저장소인지 확인하세요.

```bash
pwd
git status
ls package.json package-lock.json
```

다른 프로젝트의 터미널에서 실행하고 있다면 WorstCompare 폴더로 이동한 뒤 다시 실행합니다.

## 참고 문서

- [Vite 실행 환경](https://vite.dev/guide/)
- [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci/)
- [electron-builder macOS 설정](https://www.electron.build/mac.html)
- [Electron 코드 서명](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [Electron 44 이상에서 macOS 13을 요구하는 변경](https://www.electronjs.org/docs/latest/breaking-changes#removed-macos-12-support)
- [PRD](../prd.md) · [기능 명세](../SPEC.md) · [변경 이력](../CHANGELOG.md)
