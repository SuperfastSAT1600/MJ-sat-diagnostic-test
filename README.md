# SAT Diagnostic Test

SuperfastSAT SAT 진단 테스트 시스템입니다.

## 기능

- 학생 정보 입력 (이름, 학년, 전화번호)
- SAT 진단 문제 풀이
- 답안 및 신뢰도 평가
- 실시간 리포트 생성
- PDF 리포트 다운로드

## 설치 및 실행

### 필수 요구사항
- Node.js (v14 이상)
- npm

### 설치
```bash
# 저장소 클론
git clone https://github.com/SuperfastSAT1600/MJ-sat-diagnostic-test.git
cd MJ-sat-diagnostic-test

# 의존성 설치
npm install
```

### 실행
```bash
# 서버 시작
node server.js
```

서버가 시작되면 브라우저에서 `http://localhost:3000`으로 접속하세요.

## 파일 구조

- `quiz.html` - 진단 테스트 페이지
- `server.js` - Express 서버
- `questions.csv` - 문제 데이터
- `database.json` - 학생 응답 데이터
- `reports/` - 생성된 리포트 파일들
- `style.css` - 스타일시트

## 사용법

1. 학생 정보 입력
2. 진단 문제 풀이
3. 답안 제출
4. 리포트 확인 및 다운로드

## 개발

두 기기에서 작업하기:

**변경사항 저장:**
```bash
git add .
git commit -m "작업 내용"
git push
```

**최신 변경사항 가져오기:**
```bash
git pull
``` 