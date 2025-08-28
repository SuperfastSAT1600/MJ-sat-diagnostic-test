# SAT Diagnostic Test V3.0

SuperfastSAT SAT 진단 테스트 시스템의 개선된 버전입니다.

## 🚀 새로운 기능 (V3.0)

- **향상된 UI/UX**: 더 직관적이고 현대적인 사용자 인터페이스
- **고급 분석**: 상세한 성과 분석 및 인사이트 제공
- **개선된 리포트**: 더 상세하고 시각적으로 매력적인 리포트
- **성능 최적화**: 빠른 로딩 및 반응성 향상
- **모바일 최적화**: 모든 디바이스에서 최적의 경험

## 📋 주요 기능

- 학생 정보 입력 (이름, 학년, 전화번호)
- SAT 진단 문제 풀이 (RW + Math)
- 답안 및 신뢰도 평가
- 실시간 리포트 생성
- PDF 리포트 다운로드
- 상세한 스킬 분석
- 개인 맞춤 학습 권장사항

## 🛠️ 설치 및 실행

### 필수 요구사항
- Node.js (v16 이상 권장)
- npm 또는 yarn

### 설치
```bash
# 저장소 클론
git clone [repository-url]
cd sat-diagnostic-test-v3

# 의존성 설치
npm install
```

### 실행
```bash
# 개발 모드로 서버 시작
npm run dev

# 또는 프로덕션 모드
npm start
```

서버가 시작되면 브라우저에서 `http://localhost:3000`으로 접속하세요.

## 📁 파일 구조

- `quiz.html` - 진단 테스트 페이지
- `server.js` - Express 서버 (핵심 로직)
- `questions.csv` - 문제 데이터베이스
- `Diagnostic DataBase - Unit DB.csv` - 단위별 상세 정보
- `firebase-server.js` - Firebase 연동 모듈
- `live_report.html` - 실시간 리포트 템플릿
- `reports/` - 생성된 리포트 파일들
- `style.css` - 스타일시트
- `admin-question-editor/` - 관리자용 문제 편집기

## 📊 사용법

1. **학생 정보 입력**: 기본 정보 및 연락처 입력
2. **진단 테스트**: RW(Reading & Writing) 및 Math 문제 풀이
3. **답안 제출**: 답안과 함께 신뢰도 평가
4. **리포트 확인**: 상세한 성과 분석 및 스킬별 평가
5. **PDF 다운로드**: 오프라인 참고용 리포트 저장

## 🔧 개발

### 개발 환경 설정
```bash
# 개발 서버 시작
npm run dev

# 의존성 업데이트
npm update
```

### Git 워크플로우
**변경사항 저장:**
```bash
git add .
git commit -m "feat: 새로운 기능 추가"
git push origin main
```

**최신 변경사항 가져오기:**
```bash
git pull origin main
```

## 📈 버전 히스토리

- **V3.0** (현재): UI/UX 개선, 고급 분석, 성능 최적화
- **V2.0**: Firebase 연동, 실시간 리포트
- **V1.0**: 기본 진단 테스트 시스템

## 🤝 기여

프로젝트 개선을 위한 제안이나 버그 리포트는 언제든 환영합니다.

## 📄 라이선스

ISC License 