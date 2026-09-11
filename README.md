# DK Flash Browser

Windows에서 **Adobe Flash(PPAPI/Pepper Flash)가 필요한 구형 웹 시스템을 실행하기 위한 포터블 브라우저**입니다.

설치 프로그램 없이 폴더 단위로 사용할 수 있으며, 주소창·탭·북마크·새로고침·확대/축소 등 일반적인 브라우저 기능을 제공합니다.

> [!WARNING]
> DK Flash Browser는 지원이 종료된 Electron/Chromium/Adobe Flash 기술을 사용합니다. **일반 인터넷 브라우징용으로 사용하지 마세요.** 접속 대상, 네트워크 격리, 계정 정보, 다운로드/업로드 파일, Flash 콘텐츠 실행 등 실제 사용에 따른 **보안 판단과 책임은 사용자에게 있습니다.**

> [!IMPORTANT]
> **Adobe Flash Player DLL은 이 저장소와 공개 배포본에 포함되지 않습니다.** Flash 기능을 사용하려면 사용자가 적법하게 확보한 **32비트 PPAPI/Pepper Flash DLL을 직접 준비해 `Flash\pepflashplayer.dll` 위치에 넣어야 정상 작동합니다.**

## 주요 기능

- Windows x86 / 32비트 포터블 실행
- 주소 직접 입력 및 이동
- 뒤로 / 앞으로
- 일반 새로고침 / 캐시 무시 강력 새로고침
- 시작 페이지 및 Home 설정
- 여러 탭
- 로컬 북마크 및 폴더
- 포터블 사용자 프로필 및 로그인 세션 유지
- 페이지 확대/축소 및 현재 배율 표시
- 이미지/미디어 다운로드
- 직접 확인 가능한 SWF 주소에 대한 Flash 다운로드 후보 목록
- 실행 인수로 최대화 실행 및 특정 주소 바로가기
- Chrome 로그인, Google Sync, Chrome Web Store 등 외부 계정 기능 없음

## 빠른 시작

### 1. 프로그램 준비

배포 ZIP을 원하는 폴더에 압축 해제합니다.

### 2. Flash DLL 직접 준비

DK Flash Browser 자체에는 Flash Player가 들어 있지 않습니다.

사용자가 사용 권한을 확인한 뒤 **32비트 PPAPI/Pepper Flash DLL**을 직접 준비하여 아래 위치에 넣습니다.

```text
DKFlashBrowser-win32-ia32\
└─ Flash\
   └─ pepflashplayer.dll
```

현재 개발/검증 기준은 다음과 같습니다.

```text
Pepper Flash 29.0.0.140 x86
```

다른 버전은 동작을 보장하지 않습니다.

Flash DLL이 없거나 x86 형식이 아니면 프로그램은 시작 시 오류를 표시하고 Flash 브라우징을 진행하지 않습니다.

### 3. 실행

```text
DKFlashBrowser.exe
```

기본 시작 주소는 `config.ini`에서 설정합니다.

## 시작 페이지 설정

`config.ini` 예시:

```ini
[Browser]
StartUrl=https://html.duckduckgo.com/html

[DefaultBookmarks]
Bookmark1=DuckDuckGo|https://html.duckduckgo.com/html
Bookmark2=Duck.ai|https://duck.ai/
```

`StartUrl`은 다음에 사용됩니다.

- 프로그램 기본 시작 페이지
- Home / `Alt+Home`
- 일반 새 탭

기본 북마크는 `UserData\bookmarks.json`이 처음 생성될 때만 적용됩니다.

## 실행 인수

### 최대화 상태로 실행

```text
DKFlashBrowser.exe --start-maximized
```

### 특정 주소를 바로 열기

```text
DKFlashBrowser.exe "http://legacy-server/"
```

주소에 `http://` 또는 `https://`가 없으면 `http://`를 자동으로 붙입니다.

### 최대화 + 특정 주소

```text
DKFlashBrowser.exe --start-maximized "http://legacy-server/"
```

명령줄로 전달한 주소는 **첫 번째 탭에만 적용**되며 `config.ini`를 수정하지 않습니다. 이후 Home 및 새 탭은 기존 `StartUrl`을 사용합니다.

Windows 바로가기의 대상에도 같은 형식을 사용할 수 있습니다.

```text
"C:\Apps\DKFlashBrowser\DKFlashBrowser.exe" --start-maximized "http://legacy-server/"
```

## 주요 단축키

| 기능 | 단축키 |
|---|---|
| 주소창 | `Ctrl+L` |
| 새 탭 | `Ctrl+T` |
| 현재 탭 닫기 | `Ctrl+W` |
| 다음 탭 | `Ctrl+Tab` |
| 이전 탭 | `Ctrl+Shift+Tab` |
| 새로고침 | `F5` / `Ctrl+R` |
| 캐시 무시 새로고침 | `Ctrl+F5` / `Ctrl+Shift+R` |
| Home | `Alt+Home` |
| 북마크 추가/제거 | `Ctrl+D` |
| 확대 | `Ctrl++` |
| 축소 | `Ctrl+-` |
| 100%로 초기화 | `Ctrl+0` |
| Flash 다운로드 후보 | `Ctrl+Shift+S` |

주소창 우측의 배율 표시를 클릭하면 100%로 초기화할 수 있습니다.

## 포터블 데이터

브라우저 데이터는 프로그램 폴더 아래에 저장됩니다.

```text
UserData\
```

주요 데이터:

```text
UserData\bookmarks.json
UserData\session-cookies.json
```

프로그램 폴더를 복사할 때 `UserData`도 함께 복사하면 해당 포터블 프로필이 같이 이동합니다. 로그인 정보 등이 포함될 수 있으므로 폴더 공유/백업 시 주의하세요.

## 알려진 제한

- `Ctrl + 마우스휠` 확대/축소는 지원하지 않습니다. `Ctrl++`, `Ctrl+-`, `Ctrl+0` 또는 상단 기능 메뉴를 사용하세요.
- Pepper Flash 자체 우클릭 메뉴는 브라우저에서 확장하지 않습니다.
- Flash 다운로드는 브라우저에서 직접 관찰 가능한 SWF URL만 best-effort 방식으로 제공합니다.
- Flash 내부에서 자체적으로 불러오는 리소스는 다운로드 후보에 나타나지 않을 수 있습니다.
- `target="_blank"` / `window.open()`은 현재 별도 창이 아니라 새 탭으로 처리됩니다.
- 32비트 Windows 실제 장비/VM에서의 실행을 별도로 검증하지 않은 환경에서는 호환성을 보장하지 않습니다.

## 보안 및 사용 책임

DK Flash Browser는 **지원 종료(EOL) 기술을 의도적으로 사용하는 레거시 호환 도구**입니다.

사용자는 다음 사항을 직접 판단하고 관리해야 합니다.

- 신뢰할 수 있는 레거시 시스템에만 접속
- 가능한 경우 외부 인터넷과 분리된 네트워크에서 사용
- Flash 콘텐츠의 출처와 신뢰성 확인
- 계정/비밀번호 등 민감한 정보의 사용 여부 판단
- 다운로드/업로드 파일의 안전성 확인
- 운영체제 및 네트워크 방화벽/보안 정책 적용
- 사용 중 발생할 수 있는 보안 위험 및 손실에 대한 책임

이 프로젝트는 특정 환경에서의 보안성, 무결성 또는 최신 웹 브라우저 수준의 보호 기능을 보증하지 않습니다.

## 문제 발생 시

로그:

```text
Logs\browser.log
```

Crashpad 덤프:

```text
CrashDumps\
```

비정상 종료가 발생하면 위 파일을 먼저 보존하는 것이 좋습니다.

## 개발자용 빌드

일반 사용자는 이 절차가 필요하지 않습니다.

저장소를 받은 뒤 사용 권한이 있는 Flash DLL을 다음 위치에 준비합니다.

```text
Flash\pepflashplayer.dll
```

실행:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run-dev.ps1
```

포터블 패키지 생성:

```powershell
Get-Process DKFlashBrowser -ErrorAction SilentlyContinue | Stop-Process -Force
powershell -ExecutionPolicy Bypass -File .\scripts\package-win32.ps1
```

정적 검증:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\validate-portable.ps1
```

현재 패키지 버전은 **1.0.0**입니다.

## 라이선스

**DK Flash Browser 프로젝트의 자체 소스 코드는 MIT License로 제공됩니다.** 자세한 내용은 [`LICENSE`](LICENSE)를 확인하세요.

단, MIT License는 이 저장소가 소유하지 않는 제3자 구성요소에 권리를 부여하지 않습니다.

- Adobe Flash Player / Pepper Flash: 프로젝트에 포함되지 않으며 Adobe의 라이선스/권리 조건을 따릅니다.
- Electron: Electron 프로젝트의 라이선스를 따릅니다.
- Chromium 및 번들 구성요소: 각각의 오픈소스 라이선스를 따릅니다.
- `rcedit`: 빌드 시 사용하는 Electron 프로젝트의 별도 오픈소스 도구입니다.

자세한 제3자 고지는 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)를 확인하세요.
