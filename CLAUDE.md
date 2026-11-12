# school-soccer-league 프로젝트 지침

전역 지침(~/.claude/CLAUDE.md)의 DoRms 연수 규칙을 따른다. 사용자에게는 쉬운 한국어로 보고한다.

## 목표
학교 축구 리그 운영 프로그램. 서버 없는 HTML 한 파일(`index.html`) + 구글 시트 저장소(`apps-script/Code.gs`).
- 기록은 기본적으로 브라우저(localStorage)에 저장, 구글 시트에 연결하면 PC·휴대폰이 같은 기록을 씀.
- 학생 이름·백업(.json/.csv)은 절대 Git에 올리지 않는다(`.gitignore`).
- 웹 앱 URL과 접속 코드는 코드·Git·채팅에 적지 않는다. 접속 코드는 시트 스크립트 속성에만 있다.

## 검증 기준
- Pages 주소 HTTP 200, 브라우저 콘솔 오류 없음
- 웹 앱 GET → `{"ok":true,"app":"school-soccer-league"}`, 틀린 코드 POST → `bad_code`
- 도름스체크 scan

## 이 프로젝트의 연결 정보
비밀값은 적지 않는다.

- 로컬 폴더: C:\Users\sanju\Desktop\school-soccer-league
- GitHub 저장소: https://github.com/sanjuc0410/school-soccer-league (공개, 브랜치 main)
- 공개 주소: GitHub Pages https://sanjuc0410.github.io/school-soccer-league/ (main 푸시 시 자동 배포)
- Supabase·Vercel: 사용 안 함
- 구글 Apps Script: 선생님이 **원래 쓰던 구글 시트**(이미 ⚽ 축구리그 메뉴 설치·연결됨)를 사용한다. 시트 ID·scriptId는 아직 기록 안 됨(필요하면 선생님께 시트 주소를 받아 기록).
  - 2026-11-12에 clasp로 새로 만든 시트 "축구리그 기록"(sanjuc0410@gmail.com)은 쓰지 않기로 해서 드라이브 휴지통으로 옮겼다. 다른 시트와 헷갈리지 말 것.
  - `Code.gs`를 고치면 원래 시트의 Apps Script에 붙여넣고 배포 → 배포 관리 → 새 버전으로 갱신해야 반영된다(clasp로 하려면 그 시트의 scriptId로 `.clasp.json`을 만든다, Git 제외).
