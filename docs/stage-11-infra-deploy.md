# 11단계 인프라 / 배포 / 실행 파일 초안

## 추천 배포 플랫폼

- 정적 호스팅: GitHub Pages, Netlify, Vercel 중 하나.
- 이유: 백엔드/DB가 없고 정적 파일만 제공하면 된다.

## 로컬 실행

```powershell
cd C:\Users\eunho\Desktop\VibeCoding\HangulNoteStaff
py -3 -m http.server 5174
```

## 파일별 목적

- `index.html`: 앱 엔트리.
- `styles.css`: 화면 스타일.
- `src/*.js`: 파서, 렌더러, 내보내기, PDF 추출.
- `docs/*.md`: 단계별 산출물.

## 헬스 체크

정적 배포에서는 `/index.html` HTTP 200 확인으로 대체한다.

## 운영 장애 시 1차 대응 순서

1. 정적 페이지 200 응답 확인.
2. 브라우저 콘솔 오류 확인.
3. PDF.js/jsPDF CDN 접근 가능 여부 확인.
4. 최근 배포 파일 변경 확인.
5. 이전 정적 파일 버전으로 롤백.

## CI/CD 초안

- HTML/CSS/JS 정적 파일 배포.
- 배포 전 브라우저 smoke test: 기본 샘플 렌더링, SVG 버튼 존재 확인.

## 단계 종료 정리

1. 이번 단계 확정 사항: 정적 배포 전략.
2. 다음 단계 입력 핵심 요약: 테스트는 P0 파서/렌더링/다운로드/PDF 업로드 중심.
3. 추가 확인 필요 항목: 실제 운영 배포 플랫폼.
4. 충돌 가능 항목: 서버 OCR 도입 시 배포 구조 변경.

## 수정 표시

- 2026-05-16: PDF 다운로드용 jsPDF CDN 의존성을 운영 점검 항목에 추가.
