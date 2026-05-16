# 7단계 기술 스택 및 아키텍처 확정

## 추천 스택

- 프론트엔드: Vanilla HTML/CSS/JavaScript ES Modules.
- 악보 렌더링: 자체 SVG 렌더러.
- 실제 악보 교환 파일: MusicXML 3.1 생성.
- PDF 텍스트 추출: 브라우저 PDF.js 동적 import.
- PDF 다운로드: 브라우저 jsPDF 동적 로드.
- DB/API/인증: P0 없음.
- 배포: 정적 호스팅 또는 로컬 `python -m http.server`.

## 선택 이유

- 설치 없이 바로 실행 가능하다.
- 개인정보와 파일을 서버에 저장하지 않는다.
- MusicXML은 MuseScore, Finale, Sibelius 등 악보 도구에서 열 수 있는 표준 교환 형식이다.

## 공통 에러 코드 확정본

정적 앱 내부 상태로 대체한다.

- `INVALID_INPUT`: 유효 음표 없음.
- `BAD_GATEWAY`: PDF.js 로드 실패 또는 PDF 텍스트 추출 실패.
- `INTERNAL_ERROR`: 다운로드 변환 실패.

## 최종 확정안 1줄 요약

Vanilla HTML/CSS/JavaScript + A4 SVG renderer + PNG/PDF/MusicXML export + optional PDF.js/jsPDF, no backend.

## 단계 종료 정리

1. 이번 단계 확정 사항: 기준 스택 확정.
2. 다음 단계 입력 핵심 요약: 프로젝트 구조는 `index.html`, `styles.css`, `src/*`, `docs/*`.
3. 추가 확인 필요 항목: 정적 배포 플랫폼 선택.
4. 충돌 가능 항목: 서버 저장/로그인 추가 시 스택 변경 가능.

## 수정 표시

- 2026-05-16: A4 SVG 렌더러와 jsPDF 기반 PDF 다운로드를 기준 스택에 반영.
