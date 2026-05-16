# Hangul Note Staff

한글 음계 `도 레 미 파 솔 라 시 도`를 입력하면 오선보 SVG/PNG와 실제 악보 교환 파일인 MusicXML로 변환하는 웹 서비스 MVP입니다.

## 실행

```powershell
cd C:\Users\eunho\Desktop\VibeCoding\HangulNoteStaff
py -3 -m http.server 5174
```

브라우저에서 `http://localhost:5174`를 엽니다.

## 사용법

- 한글 음계 입력: `도레미파솔라시도`, `도 레 미 파 | 솔 라 시 도`
- 쉼표 입력: `쉼`
- 음 길이 지정: `도/2`, `레/4`, `미/8`, `파/16`
- 높은 옥타브: `도'`, 낮은 옥타브: `도,`
- 올림/내림: `도#`, `시b`
- PDF/TXT 업로드: 텍스트 레이어가 있는 PDF 또는 TXT에서 한글 음계를 추출합니다.

## 산출물

- `index.html`, `styles.css`, `src/`: 실행 가능한 정적 웹앱
- `docs/stage-00-service-input.md` ~ `docs/stage-12-test-plan.md`: 프롬프트 단계별 산출물
- 내보내기: SVG, PNG, MusicXML

## 현재 제한

- PDF 입력은 텍스트 기반 PDF만 안정 지원합니다. 스캔 이미지 PDF의 OCR은 P1 범위로 분리했습니다.
- MusicXML은 C major, treble clef, 단선율 MVP 기준입니다.
- 서버 저장, 로그인, 관리자 화면은 MVP 출시 범위에서 제외했습니다.
