# Security policy

DK Flash Browser는 지원이 종료된 Electron/Chromium/Adobe Flash 기술이 필요한 레거시 시스템을 위한 호환 도구입니다.

## 중요한 보안 전제

이 프로젝트는 최신 브라우저 수준의 보안을 제공하지 않으며, 지원 종료된 런타임과 플러그인의 알려지거나 알려지지 않은 취약점에 노출될 수 있습니다.

따라서 다음 사항은 사용자 책임으로 관리해야 합니다.

- 일반 인터넷 브라우징에 사용하지 않기
- 가능한 경우 신뢰된 레거시 시스템과 격리된 네트워크에서만 사용하기
- 방화벽, 접근 제어, 망 분리 등 환경 보안 정책 적용하기
- Flash 콘텐츠 및 접속 대상의 신뢰성 확인하기
- 계정, 비밀번호, 다운로드/업로드 파일 등 민감 정보 취급 여부 판단하기
- 사용 중인 Flash DLL의 출처, 사용 권한 및 안전성 확인하기

## Flash Player

Adobe Flash Player / Pepper Flash 바이너리는 이 프로젝트에 포함되지 않습니다.

사용자는 본인이 사용할 권한이 있는 32비트 PPAPI/Pepper Flash DLL을 직접 준비해야 합니다.

```text
Flash\pepflashplayer.dll
```

현재 검증 기준은 Pepper Flash 29.0.0.140 x86입니다.

## 지원 범위

DK Flash Browser 자체 코드에서 발생하는 재현 가능한 오류나 보안 문제는 GitHub Issue로 보고할 수 있습니다.

다만 다음 항목은 이 프로젝트가 수정하거나 보안 지원을 제공할 수 있는 범위가 아닙니다.

- Adobe Flash Player 자체 취약점
- Electron 6 / Chromium 76 자체 취약점
- 접속하는 레거시 웹 시스템의 취약점
- 사용자가 직접 제공한 Flash DLL 또는 기타 파일의 안전성/라이선스 문제
- EOL 구성요소를 외부 인터넷에 노출해서 발생하는 문제

## 보증

프로젝트 소스는 MIT License에 따라 `AS IS`로 제공되며, 보증 없이 제공됩니다. 자세한 법적 조건은 `LICENSE`를 확인하세요.
