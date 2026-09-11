# Third-party notices

DK Flash Browser 자체 소스 코드는 이 저장소의 [`LICENSE`](LICENSE)에 따라 **MIT License**로 제공됩니다.

MIT License는 DK Flash Browser 프로젝트가 직접 작성·배포하는 소스 코드에 적용됩니다. 이 저장소가 소유하지 않는 제3자 소프트웨어나 바이너리에 대한 별도 권리를 부여하지 않습니다.

## Electron

프로젝트는 공식 Electron 6.1.12 Windows x86 런타임을 사용합니다. Electron은 Electron 프로젝트의 MIT License에 따라 배포됩니다.

Electron 런타임에는 Chromium 및 여러 제3자 구성요소가 포함되며, 각각의 라이선스 고지는 공식 Electron 런타임에 포함된 파일을 따릅니다. 패키징 스크립트는 해당 런타임의 라이선스 파일을 유지합니다.

## Chromium

Chromium 및 Chromium에 포함된 구성요소는 각각의 오픈소스 라이선스를 따릅니다. 관련 고지는 Electron 공식 런타임 배포물에 포함되어 있습니다.

## Electron rcedit

Windows 패키징 과정에서는 Electron 프로젝트의 `rcedit` v2.0.0 x86 빌드를 **빌드 도구로만** 사용합니다.

`rcedit`은 실행 파일 아이콘과 Windows 버전 리소스를 적용하기 위해 사용되며, 로컬의 무시된 `.runtime\tools` 디렉터리에 내려받습니다. 포터블 패키지/공개 ZIP에는 포함하지 않습니다.

`rcedit`은 Electron 프로젝트가 제공하는 별도 오픈소스 라이선스를 따릅니다.

## Adobe Flash Player / Pepper Flash

**Adobe Flash Player 및 Pepper Flash는 DK Flash Browser의 MIT 라이선스 대상이 아닙니다.**

이 저장소는 `pepflashplayer.dll` 또는 다른 Adobe Flash Player 바이너리를 포함하거나 재배포하지 않습니다. 프로젝트는 해당 바이너리의 사용 권한을 제공하지도 않습니다.

Flash 기능을 사용하려는 사용자는 본인이 사용할 권한이 있는 **32비트 PPAPI/Pepper Flash DLL을 직접 확보**하여 다음 위치에 배치해야 합니다.

```text
Flash\pepflashplayer.dll
```

현재 개발/검증 기준은 Pepper Flash 29.0.0.140 x86입니다. 다른 버전의 동작은 보장하지 않습니다.

로컬 빌드 스크립트는 사용자가 직접 제공한 DLL을 로컬 테스트/패키지 출력으로 복사할 수 있습니다. 해당 DLL은 저장소에 커밋하거나 이 프로젝트의 공개 Release/배포 파일에 첨부해서는 안 됩니다.

Adobe Flash Player 사용 가능 여부와 라이선스 조건을 확인하는 책임은 사용자에게 있습니다.
