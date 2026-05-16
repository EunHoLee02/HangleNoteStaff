# 8단계 프로젝트 구조 및 구현 계획

## 전체 프로젝트 구조

```text
HangulNoteStaff/
  index.html
  styles.css
  README.md
  src/
    app.js
    parser.js
    scoreRenderer.js
    musicXml.js
    pdfExtractor.js
  docs/
    stage-00-service-input.md
    ...
    stage-12-test-plan.md
```

## 구현 우선순위

1. P0 파서: 한글 음계, 쉼표, 길이, 옥타브, 올림/내림.
2. P0 SVG 오선보 렌더러.
3. P0 SVG/PNG/MusicXML 다운로드.
4. P0 TXT/PDF 텍스트 추출.
5. P1 OCR 확장 여지를 문서화.

## API 응답/에러 기준

API 없음. UI 상태 메시지로 성공/오류를 표시한다.

## 단계 종료 정리

1. 이번 단계 확정 사항: 구현 파일 구조와 P0 순서 확정.
2. 다음 단계 입력 핵심 요약: DB 연결은 없음으로 명시.
3. 추가 확인 필요 항목: 패키지 매니저 도입 여부.
4. 충돌 가능 항목: npm 기반 빌드 도입 시 실행 방식 변경.
