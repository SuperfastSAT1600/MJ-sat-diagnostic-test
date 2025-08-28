const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse');
const CSV_PARSE = require('csv-parse');
const { firebaseDB } = require('./firebase-server');

// 1. Server Configuration
const app = express();
const port = 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const REPORTS_DIR = path.join(__dirname, 'reports');

// 2. Middleware Configuration
app.use((req, res, next) => {
  // landing.html은 정적으로 서빙하지 않음
  if (req.path === '/landing.html') {
    return next();
  }
  express.static(path.join(__dirname))(req, res, next);
});
app.use('/images', express.static(path.join(__dirname, 'images'))); // images 폴더 static 서빙 추가
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '2mb' })); // JSON 파싱 미들웨어 추가

// 3. DB Read/Write Helper Functions
const readDB = async () => {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await writeDB([]);
            return [];
        }
        throw error;
    }
};
const writeDB = async (data) => fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));

const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
};

// CSV 파일 파싱 함수 (Promise)
async function parseCsvFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return new Promise((resolve, reject) => {
    parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    }, (err, records) => {
      if (err) reject(err);
      else resolve(records);
    });
  });
}

// 동기 파싱 필요 시
const parseSync = require('csv-parse/sync');

// 답안/확신도 추출 함수
async function extractAnswersAndConfidence(formData) {
  // 문항번호-과목 매핑을 위해 questions.csv 파싱
  const csv = await fs.readFile(path.join(__dirname, 'questions.csv'), 'utf-8');
  const records = parseSync.parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    quote: false
  });
  
  // 디버깅을 위한 로그
  console.log('FormData keys:', Object.keys(formData));
  console.log('CSV records count:', records.length);
  
  // { 'qRW1': 'RW-1', 'qMath1': 'Math-1', ... }
  const qMap = {};
  for (const q of records) {
    const num = q.Number;
    const subj = q.Subject;
    if (num && subj) {
      qMap['q'+subj+num] = `${subj}-${num}`;
      qMap['c'+subj+num] = `${subj}-${num}`;
    }
  }
  
  // 디버깅: 실제 매핑 확인 (Math 2번, 14번 포함)
  console.log('Sample mappings:');
  for (let i = 1; i <= 3; i++) {
    console.log(`qRW${i} -> ${qMap['qRW'+i] || 'NOT FOUND'}`);
    console.log(`cRW${i} -> ${qMap['cRW'+i] || 'NOT FOUND'}`);
    console.log(`qMath${i} -> ${qMap['qMath'+i] || 'NOT FOUND'}`);
    console.log(`cMath${i} -> ${qMap['cMath'+i] || 'NOT FOUND'}`);
  }
  console.log(`qMath2 -> ${qMap['qMath2'] || 'NOT FOUND'}`);
  console.log(`cMath2 -> ${qMap['cMath2'] || 'NOT FOUND'}`);
  console.log(`qMath14 -> ${qMap['qMath14'] || 'NOT FOUND'}`);
  console.log(`cMath14 -> ${qMap['cMath14'] || 'NOT FOUND'}`);
  
  console.log('qMap:', qMap);
  
  // 실제 폼 데이터에서 Math 관련 키들 확인
  console.log('FormData Math keys:');
  Object.keys(formData).filter(key => key.includes('Math')).forEach(key => {
    console.log(`${key}: ${formData[key]}`);
  });
  
  // Math 2번, 14번 문제 특별 확인
  console.log('=== Math 2, 14번 문제 디버깅 ===');
  console.log('qMath2 in formData:', formData['qMath2']);
  console.log('cMath2 in formData:', formData['cMath2']);
  console.log('qMath14 in formData:', formData['qMath14']);
  console.log('cMath14 in formData:', formData['cMath14']);
  console.log('qMap[qMath2]:', qMap['qMath2']);
  console.log('qMap[qMath14]:', qMap['qMath14']);
  
  // 모든 Math 문제 (1-12번) 매핑 확인 및 수동 추가
  console.log('=== Math 문제 매핑 확인 ===');
  for (let i = 1; i <= 12; i++) {
    if (!qMap[`qMath${i}`]) {
      qMap[`qMath${i}`] = `Math-${i}`;
      console.log(`Math-${i} 매핑 수동 추가됨`);
    }
    if (!qMap[`cMath${i}`]) {
      qMap[`cMath${i}`] = `Math-${i}`;
      console.log(`cMath${i} 매핑 수동 추가됨`);
    }
  }
  
  // 모든 RW 문제 (1-13번) 매핑 확인 및 수동 추가
  console.log('=== RW 문제 매핑 확인 ===');
  for (let i = 1; i <= 13; i++) {
    if (!qMap[`qRW${i}`]) {
      qMap[`qRW${i}`] = `RW-${i}`;
      console.log(`RW-${i} 매핑 수동 추가됨`);
    }
    if (!qMap[`cRW${i}`]) {
      qMap[`cRW${i}`] = `RW-${i}`;
      console.log(`cRW${i} 매핑 수동 추가됨`);
    }
  }
  
  const answers = {};
  const confidence = {};
  for (const key in formData) {
    if (/^q[A-Za-z]+\d+/.test(key) && qMap[key]) {
      answers[qMap[key]] = formData[key];
    }
    if (/^c[A-Za-z]+\d+/.test(key) && qMap[key]) {
      confidence[qMap[key]] = formData[key];
    }
  }
  
  console.log('Extracted answers:', answers);
  console.log('Extracted confidence:', confidence);
  
  return { answers, confidence };
}

// PDF 리포트용 데이터 변환 함수
function buildPdfReportData(reportData) {
  // 문항별 결과 변환 (아이콘/색상)
  const questionRows = (reportData.questionRows || []).map(q => {
    // 결과 아이콘
    let resultIcon = '🔴';
    if (q.resultType === 'correct') resultIcon = '🟢';
    else if (q.resultType === 'trap') resultIcon = '🟡';
    // 확신도 색상
    let confColor = '#155724';
    if (q.conf < 80 && q.conf >= 60) confColor = '#0c5460';
    else if (q.conf < 60 && q.conf >= 40) confColor = '#856404';
    else if (q.conf < 40) confColor = '#721c24';
    // 난이도 색상
    let diffColor = '#d4edda';
    if (q.difficulty?.toLowerCase() === 'medium') diffColor = '#fff3cd';
    else if (q.difficulty?.toLowerCase() === 'hard') diffColor = '#f8d7da';
    return {
      ...q,
      resultIcon,
      confColor,
      diffColor
    };
  });

  // Skills Insight 변환 (도메인별 그룹핑, 색상/퍼센트)
  const skillsInsight = [];
  const grouped = {};
  (reportData.domainSkillRows || []).forEach(row => {
    if (!grouped[row.domain]) grouped[row.domain] = [];
    grouped[row.domain].push(row);
  });
  Object.entries(grouped).forEach(([domain, skills]) => {
    skillsInsight.push({
      domain,
      skills: skills.map(skill => {
        let color = '#27ae60';
        if (skill.rate >= 80) color = '#27ae60';
        else if (skill.rate >= 60) color = '#f1c40f';
        else color = '#e74c3c';
        return {
          skill: skill.skill,
          color,
          rate: skill.rate
        };
      })
    });
  });

  // Difficulty Insight 변환
  const diffTypes = ['easy', 'medium', 'hard'];
  const difficultyInsight = diffTypes.map(diff => {
    const total = (reportData.questionRows || []).filter(q => q.difficulty?.toLowerCase() === diff).length;
    const correct = (reportData.questionRows || []).filter(q => q.difficulty?.toLowerCase() === diff && q.resultType === 'correct').length;
    const trap = (reportData.questionRows || []).filter(q => q.difficulty?.toLowerCase() === diff && q.resultType === 'trap').length;
    const percent = total > 0 ? Math.round(((correct + trap * 0.5) / total) * 100) : 0;
    let bgColor = diff === 'easy' ? '#d4edda' : diff === 'medium' ? '#fff3cd' : '#f8d7da';
    return {
      label: diff.charAt(0).toUpperCase() + diff.slice(1),
      percent,
      bgColor
    };
  });

  // What to Improve 자동 생성
  let whatToImprove = reportData.whatToImprove;
  if (!whatToImprove) {
    let weakSkills = (reportData.domainSkillRows || []).filter(s => s.rate < 80).map(s => `${s.domain} - ${s.skill}`) || [];
    let hardAcc = (() => {
      const total = (reportData.questionRows || []).filter(q => q.difficulty?.toLowerCase() === 'hard').length || 0;
      const correct = (reportData.questionRows || []).filter(q => q.difficulty?.toLowerCase() === 'hard' && q.resultType === 'correct').length || 0;
      const trap = (reportData.questionRows || []).filter(q => q.difficulty?.toLowerCase() === 'hard' && q.resultType === 'trap').length || 0;
      return total > 0 ? Math.round(((correct + trap * 0.5) / total) * 100) : 0;
    })();
    let msg = '';
    if (weakSkills.length > 0) {
      msg += `특히 아래 영역에서 추가적인 학습이 필요합니다: ${weakSkills.join(', ')}.\n`;
    }
    if (hardAcc < 80) {
      msg += `어려운 난이도의 문제에서 정답률이 낮으니, 복잡한 문제 풀이 전략을 보완해보세요.`;
    }
    if (!msg) msg = '전반적으로 우수한 성취를 보이고 있습니다!';
    whatToImprove = msg;
  }

  return {
    ...reportData,
    questionRows,
    skillsInsight,
    difficultyInsight,
    whatToImprove
  };
}

// --- [Server Role (Route) Definitions] ---

// Role 1: Show quiz page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'quiz.html'));
});

// Role 2: Process quiz submission
app.post('/submit', async (req, res) => {
    let browser;
    try {
        const studentData = req.body;
        const resultId = uuidv4();
        const uniqueCode = generateCode();

        // --- Virtual scoring logic ---
        // 기존 랜덤 점수 부여 부분을 실제 채점 로직으로 대체
        const questionsCsv = await fs.readFile(path.join(__dirname, 'questions.csv'), 'utf-8');
        const studentAnswers = studentData; // form에서 넘어온 답안들
        
        // csv-parse를 사용한 robust한 파싱
        const records = [];
        const parser = parse(questionsCsv, {
          skip_empty_lines: true,
          relax_quotes: true,
          relax_column_count: true
        });
        
        let isFirstRow = true;
        for await (const record of parser) {
          if (isFirstRow) {
            isFirstRow = false;
            continue; // 헤더 스킵
          }
          
          if (record.length >= 9) {
            const answerValue = record[7] || '';
            
            // 주관식 문제 판별 - QuestionType 컬럼을 우선 확인
            let questionType = 'multiple_choice';
            if (record.length >= 10 && record[9]) {
              questionType = record[9].trim();
            } else {
              // QuestionType이 없으면 Answer 컬럼으로 판별
              const isShortAnswer = answerValue.includes(',') || answerValue.includes('|') || 
                                    (record[3] && record[3].includes('/') && record[4] && record[4].includes('.'));
              questionType = isShortAnswer ? 'short_answer' : 'multiple_choice';
            }
            
            records.push({
              Number: record[0],
              Subject: record[8] || 'RW',
              QuestionType: questionType,
              Answer: answerValue
            });
          }
        }
        
        let rwCorrect = 0, rwTotal = 0, mathCorrect = 0, mathTotal = 0;

        function normalizeAnswer(ans) {
          if (ans === undefined || ans === null) return '';
          if (Array.isArray(ans)) ans = ans[0] || '';
          ans = String(ans).trim().replace(/\s/g, '');
          // 분수 -> 소수 변환
          if (/^\d+\/\d+$/.test(ans)) {
            const [a, b] = ans.split('/').map(Number);
            if (b !== 0) return (a / b).toString();
          }
          // 백분율 -> 소수 변환
          if (/^\d+(\.\d+)?%$/.test(ans)) {
            return (parseFloat(ans) / 100).toString();
          }
          return ans;
        }

        for (const q of records) {
          const qNum = q.Number;
          const subject = q.Subject;
          const qType = q.QuestionType;
          const studentAns = studentAnswers['q' + qNum];
          if (!studentAns) continue;
          if (subject === 'RW') rwTotal++;
          if (subject === 'Math') mathTotal++;
          if (qType === 'multiple_choice') {
            if (studentAns === q.Answer) {
              if (subject === 'RW') rwCorrect++;
              if (subject === 'Math') mathCorrect++;
            }
          } else if (qType === 'short_answer') {
            // 복수 정답 모두 인정
            const corrects = (q.Answer || '').split(/\||,/).map(a => normalizeAnswer(a));
            const studentNorm = normalizeAnswer(studentAns);
            if (corrects.some(ans => ans === studentNorm)) {
              if (subject === 'RW') rwCorrect++;
              if (subject === 'Math') mathCorrect++;
            }
          }
        }
        // 점수 계산 (SAT 스케일에 맞춰 200~800, 10점 단위 반올림)
        // 현재 문제 수: RW 13문제, Math 12문제
        function roundToNearest10(n) {
          return Math.round(n / 10) * 10;
        }
        const rwScore = roundToNearest10(200 + (rwCorrect / 13) * 600);
        const mathScore = roundToNearest10(200 + (mathCorrect / 12) * 600);
        const totalScore = rwScore + mathScore;
        
        // --- Prepare report data ---
        const reportData = {
            id: resultId,
            code: uniqueCode,
            studentName: studentData.studentName,
            studentGrade: studentData.studentGrade,
            score: totalScore,
            rwScore: rwScore,
            mathScore: mathScore,
            createdAt: new Date().toISOString(),
            testDate: new Date().toLocaleDateString('en-US'),
            rw_results_table: '<tr><td>[01]</td><td>✔️</td><td>100%</td></tr>',
            rw_rationale_list: '<li>[01] Rationale for question 1...</li>',
            math_results_table: '<tr><td>[06]</td><td>✔️</td><td>100%</td></tr>',
            math_rationale_list: '<li>[06] Rationale for Math question 6...</li>',
        };
        
        // --- Start PDF generation logic ---
        // PDF 리포트 생성/저장 관련 코드 완전 제거
        // (pdfPath, puppeteer, report_template.html 등 모두 삭제)

        // --- Save results to Firebase ---
        // 답안/확신도 추출
        console.log('Raw studentData:', studentData);
        const { answers, confidence } = await extractAnswersAndConfidence(studentData);
        console.log('Extracted answers:', answers);
        console.log('Extracted confidence:', confidence);
        
        const dataToSave = {
            originalId: reportData.id, // 기존 UUID 보존
            code: reportData.code,
            studentName: reportData.studentName,
            studentGrade: reportData.studentGrade,
            score: reportData.score,
            rwScore: reportData.rwScore,
            mathScore: reportData.mathScore,
            createdAt: reportData.createdAt,
            answers,
            confidence
        };
        
        // Firebase에 저장하고 생성된 키 반환
        const firebaseKey = await firebaseDB.saveData(dataToSave);
        console.log('Data saved to Firebase successfully with key:', firebaseKey);
        
        // Firebase 키를 reportData.id에 저장 (리포트 링크용)
        reportData.id = firebaseKey;

        // --- Show only 'next action guidance' page to student ---
        let landingHtml = await fs.readFile(path.join(__dirname, 'landing.html'), 'utf-8');
        landingHtml = landingHtml.replace(/{{code}}/g, uniqueCode);
        landingHtml = landingHtml.replace(/{{studentName}}/g, studentData.studentName || '');
        res.send(landingHtml);

    } catch (error) {
        console.error('Error during Submit processing:', error);
        if (error && error.stack) console.error(error.stack);
        if(browser) await browser.close();
        res.status(500).send('An error occurred.');
    }
});

// Role 3: Show dynamic report page
app.get('/report/:id', async (req, res) => {
    try {
        const resultId = req.params.id;
        const resultData = await firebaseDB.getDataById(resultId);
        if (!resultData) {
            return res.status(404).send('<h1>Report not found.</h1>');
        }

    // 문제/유닛/해설 DB 파싱
    const [unitDb, rationaleDb, questionsCsv] = await Promise.all([
      parseCsvFile(path.join(__dirname, 'Diagnostic DataBase - Unit DB.csv')),
      parseCsvFile(path.join(__dirname, 'Diagnostic DataBase - Question Rationale DB.csv')),
      parseCsvFile(path.join(__dirname, 'questions.csv'))
    ]);
    let studentAnswers = resultData.answers || {};
    let studentConfidence = resultData.confidence || {};

    // questions.csv에서 문제 번호와 과목 매핑 생성
    const questionMap = {};
    for (const q of questionsCsv) {
      const num = q.Number;
      const subj = q.Subject;
      if (num && subj) {
        questionMap[`${subj}-${num}`] = {
          number: num,
          subject: subj,
          answer: q.Answer,
          questionType: q.QuestionType
        };
      }
    }
    
    // 디버깅: Math 2번, 14번 문제 매핑 확인
    console.log('Math-2 mapping:', questionMap['Math-2']);
    console.log('Math-14 mapping:', questionMap['Math-14']);
    console.log('Available student answers keys:', Object.keys(studentAnswers));
    console.log('Available student confidence keys:', Object.keys(studentConfidence));

    // 문항별 정보 조합
    const questionRows = [];
    for (const unit of unitDb) {
      const key = `${unit.Section}-${unit.Unit}`;
      const subject = unit.Section;
      const number = unit.Unit;
      const domain = unit.Domain;
      const skill = unit.Skill;
      const correct = unit['Correct Answer'];
      // questions.csv의 매핑을 사용해서 답안과 확신도 찾기
      const questionInfo = questionMap[key];
      let studentAnsRaw = '';
      let conf = '';
      
      if (questionInfo) {
        studentAnsRaw = studentAnswers[key] || '';
        conf = studentConfidence[key] || '';
      } else {
        // questionMap에 없는 경우, 직접 키로 찾아보기
        studentAnsRaw = studentAnswers[key] || '';
        conf = studentConfidence[key] || '';
      }
      
      // 디버깅: Math 2번, 14번 문제의 답안 확인
      if (key === 'Math-2' || key === 'Math-14') {
        console.log(`Processing ${key}:`);
        console.log(`  - studentAnsRaw: ${studentAnsRaw}`);
        console.log(`  - conf: ${conf}`);
        console.log(`  - questionInfo:`, questionInfo);
        console.log(`  - Available answers:`, Object.keys(studentAnswers));
        console.log(`  - Available confidence:`, Object.keys(studentConfidence));
      }
      
      // 디버깅: Math 2번, 14번 문제의 답안 확인
      if (key === 'Math-2' || key === 'Math-14') {
        console.log(`Processing ${key}:`);
        console.log(`  - studentAnsRaw: ${studentAnsRaw}`);
        console.log(`  - conf: ${conf}`);
        console.log(`  - questionInfo:`, questionInfo);
      }
      
      const studentAns = Array.isArray(studentAnsRaw) ? studentAnsRaw[0] : studentAnsRaw;
      
      // answers/confidence 데이터가 없는 경우 기본값 설정
      let resultType = 'wrong';
      let isCorrect = false;
      
      if (studentAns && correct) {
        // 정답 정규화 함수
        function normalizeAnswer(ans) {
          if (ans === undefined || ans === null) return '';
          if (Array.isArray(ans)) ans = ans[0] || '';
          ans = String(ans).trim().replace(/\s/g, '');
          // 분수 -> 소수 변환
          if (/^\d+\/\d+$/.test(ans)) {
            const [a, b] = ans.split('/').map(Number);
            if (b !== 0) return (a / b).toString();
          }
          // 백분율 -> 소수 변환
          if (/^\d+(\.\d+)?%$/.test(ans)) {
            return (parseFloat(ans) / 100).toString();
          }
          return ans;
        }
        
        // 복수 정답 처리 (쉼표로 구분된 정답들)
        const correctAnswers = String(correct).split(',').map(ans => normalizeAnswer(ans.trim()));
        const studentNorm = normalizeAnswer(studentAns);
        
        // 정오답 판정 (Trap Answer 로직 제거)
        isCorrect = correctAnswers.some(ans => ans === studentNorm);
        
        // 결과 타입 결정: correct 또는 wrong
        if (isCorrect) resultType = 'correct';
      }
      
      // 해설 찾기 (정답/확신도별)
      const rationale = rationaleDb.find(r => r.Section === subject && r.Unit === number && r.Answer === studentAns && String(r.Confidence) === String(conf));
      questionRows.push({
        key, subject, number, domain, skill, studentAns: String(studentAns), conf: String(conf),
        correct: String(correct), isCorrect, resultType,
        difficulty: unit.Difficulty, rationale: rationale ? rationale['Question Rationale'] : ''
      });
    }
    // SAT 점수 계산 알고리즘 (난이도 기반 가중 점수)
    function calculateSATScore(questions, subject) {
      const subjectQuestions = questions.filter(q => q.subject === subject);
      if (subjectQuestions.length === 0) return 400;
      
      let totalWeightedScore = 0;
      let totalWeight = 0;
      
      for (const q of subjectQuestions) {
        // 난이도별 가중치
        let weight = 1;
        switch(q.difficulty?.toLowerCase()) {
          case 'easy': weight = 1; break;
          case 'medium': weight = 1.5; break;
          case 'hard': weight = 2; break;
          default: weight = 1;
        }
        
        // 결과별 점수
        let score = 0;
        switch(q.resultType) {
          case 'correct': score = 1; break;
          case 'trap': score = 0; break;
          case 'wrong': score = 0; break;
          default: score = 0;
        }
        
        totalWeightedScore += score * weight;
        totalWeight += weight;
      }
      
      // 가중 평균 계산
      const weightedAverage = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      
      // SAT 스케일로 변환 (400-800)
      // 최고 성취도(1.0) = 800점, 최저 성취도(0.0) = 400점
      const satScore = Math.round((400 + (weightedAverage * 400)) / 10) * 10;
      
      return Math.max(400, Math.min(800, satScore));
    }
    
    // 각 과목별 점수 계산 - 가중치 기반 계산 사용
    const rwScore = calculateSATScore(questionRows, 'RW');
    const mathScore = calculateSATScore(questionRows, 'Math');
    const totalScore = rwScore + mathScore;
    // 도메인/스킬별 정답률 (난이도 가중) - RW와 Math 분리
    const domainSkillMap = {};
    for (const q of questionRows) {
      const key = `${q.domain}||${q.skill}`;
      if (!domainSkillMap[key]) domainSkillMap[key] = { 
        domain: q.domain, 
        skill: q.skill, 
        subject: q.subject,
        totalWeight: 0, 
        weightedScore: 0
      };
      
      // 난이도별 가중치
      let weight = 1;
      switch(q.difficulty?.toLowerCase()) {
        case 'easy': weight = 1; break;
        case 'medium': weight = 1.5; break;
        case 'hard': weight = 2; break;
        default: weight = 1;
      }
      
      // 결과별 점수
      let score = 0;
      switch(q.resultType) {
        case 'correct': score = 1; break;
        case 'trap': score = 0.5; break;
        case 'wrong': score = 0; break;
        default: score = 0;
      }
      
      domainSkillMap[key].totalWeight += weight;
      domainSkillMap[key].weightedScore += score * weight;
    }
    const domainSkillRows = Object.values(domainSkillMap).map(d => ({
      domain: d.domain,
      skill: d.skill,
      subject: d.subject,
      rate: d.totalWeight > 0 ? Math.round((d.weightedScore / d.totalWeight) * 100) : 0
    }));

    // RW와 Math Skills Insight 분리
    const rwSkillsInsight = [];
    const mathSkillsInsight = [];
    const grouped = {};
    domainSkillRows.forEach(row => {
      if (!grouped[row.subject]) grouped[row.subject] = {};
      if (!grouped[row.subject][row.domain]) grouped[row.subject][row.domain] = [];
      grouped[row.subject][row.domain].push(row);
    });
    
    // RW Skills Insight 생성
    if (grouped['RW']) {
      Object.entries(grouped['RW']).forEach(([domain, skills]) => {
        rwSkillsInsight.push({
          domain,
          skills: skills.map(skill => {
            let color = '#27ae60';
            if (skill.rate >= 80) color = '#27ae60';
            else if (skill.rate >= 60) color = '#f1c40f';
            else color = '#e74c3c';
            return {
              skill: skill.skill,
              color,
              rate: skill.rate
            };
          })
        });
      });
    }
    
    // Math Skills Insight 생성 (CSV 데이터 기반으로 동적 생성)
    const mathGrouped = {};
    domainSkillRows.filter(row => row.subject === 'Math').forEach(row => {
      if (!mathGrouped[row.domain]) mathGrouped[row.domain] = [];
      mathGrouped[row.domain].push(row);
    });
    
    // CSV에서 가져온 도메인별로 Math Skills Insight 생성
    Object.entries(mathGrouped).forEach(([domain, skills]) => {
      mathSkillsInsight.push({
        domain,
        skills: skills.map(skill => {
          let color = '#27ae60';
          if (skill.rate >= 80) color = '#27ae60';
          else if (skill.rate >= 60) color = '#f1c40f';
          else color = '#e74c3c';
          return {
            skill: skill.skill,
            color,
            rate: skill.rate
          };
        })
      });
    });



    // 최신 리포트 템플릿 읽기
    let html = await fs.readFile('live_report.html', 'utf-8');
    // JSON 데이터 삽입
    const reportData = {
      studentName: resultData.studentName,
      studentGrade: resultData.studentGrade || 'N/A',
      testDate: resultData.createdAt ? new Date(resultData.createdAt).toLocaleDateString('en-US') : '',
      code: resultData.code ? resultData.code : '-',
      score: Number.isFinite(totalScore) ? totalScore : 0,
      rwScore: Number.isFinite(rwScore) ? rwScore : 0,
      mathScore: Number.isFinite(mathScore) ? mathScore : 0,
      questionRows,
      domainSkillRows,
      rwSkillsInsight,
      mathSkillsInsight
    };
    // 로그 추가
    console.log('resultData:', resultData);
    console.log('questionRows:', questionRows);
    console.log('domainSkillRows:', domainSkillRows);
    console.log('reportData:', reportData);
    const dataScript = `<script>window.REPORT_DATA_JSON = ${JSON.stringify(reportData)};</script>`;
    html = html.replace('<!-- DATA SCRIPT -->', `<!-- DATA SCRIPT -->\n${dataScript}`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    } catch (error) {
        console.error('Error during Report page generation:', error);
        if (error && error.stack) console.error(error.stack);
        res.status(500).send('An error occurred.');
    }
});

// questions.csv를 UTF-8로 제공하는 라우트
app.get('/questions.csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.sendFile(path.join(__dirname, 'questions.csv'));
});

// 문제 목록 조회 API
app.get('/api/questions', async (req, res) => {
  try {
    const QUESTIONS_PATH = path.join(__dirname, 'questions.csv');
    
    // 파일이 없으면 빈 배열 반환
    let fileExists = true;
    try { await fs.access(QUESTIONS_PATH); } catch { fileExists = false; }
    if (!fileExists) {
      return res.json([]);
    }
    
    const csvData = await fs.readFile(QUESTIONS_PATH, 'utf-8');
    
    // csv-parse를 사용한 robust한 파싱
    const questions = [];
    const parser = parse(csvData, {
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true
    });
    
    let isFirstRow = true;
    for await (const record of parser) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // 헤더 스킵
      }
      
      if (record.length >= 9) {
        const answerValue = record[7] || '';
        
        // 주관식 문제 판별 - QuestionType 컬럼을 우선 확인
        let questionType = 'multiple_choice';
        if (record.length >= 10 && record[9]) {
          questionType = record[9].trim();
        } else {
          // QuestionType이 없으면 Answer 컬럼으로 판별
          const isShortAnswer = answerValue.includes(',') || answerValue.includes('|') || 
                                (record[3] && record[3].includes('/') && record[4] && record[4].includes('.'));
          questionType = isShortAnswer ? 'short_answer' : 'multiple_choice';
        }
        

        
        questions.push({
          number: parseInt(record[0]) || 0,
          stem: record[1] || '',
          prompt: record[2] || '',
          choices: questionType === 'short_answer' && answerValue.includes('|') 
            ? answerValue.split('|') 
            : questionType === 'short_answer' && answerValue.includes(',')
            ? answerValue.split(',').map(a => a.trim())
            : [record[3] || '', record[4] || '', record[5] || '', record[6] || ''],
          answer: questionType === 'multiple_choice' ? (answerValue ? answerValue.charCodeAt(0) - 65 : 0) : 0,
          subject: record[8] || 'RW',
          questionType: questionType
        });
      }
    }
    
    res.json(questions);
  } catch (e) {
    console.error('❌ 문제 목록 조회 실패:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 문제 추가 API
app.post('/api/questions', async (req, res) => {
  try {
    const { number, stem, prompt, choices, answer, subject, questionType } = req.body;
    

    
    // subject 필수값 검증
    if (!subject || (subject !== 'RW' && subject !== 'Math')) {
      console.log('❌ Subject 검증 실패:', subject);
      return res.status(400).json({ success: false, error: '과목(Subject) 값이 누락되었거나 올바르지 않습니다.' });
    }
    
    // questionType 필수값 검증
    if (!questionType || (questionType !== 'multiple_choice' && questionType !== 'short_answer')) {
      console.log('❌ QuestionType 검증 실패:', questionType);
      return res.status(400).json({ success: false, error: '문제 타입(QuestionType) 값이 누락되었거나 올바르지 않습니다.' });
    }
    
    const QUESTIONS_PATH = path.join(__dirname, 'questions.csv');
    // 파일이 없으면 헤더 생성
    let fileExists = true;
    try { await fs.access(QUESTIONS_PATH); } catch { fileExists = false; }
    if (!fileExists) {
      await fs.writeFile(QUESTIONS_PATH, 'Number,Passage,Question,OptionA,OptionB,OptionC,OptionD,Answer,Subject,QuestionType\n', 'utf-8');
    }
    // 새 문제 행 추가
    const newRow = [
      number,
      stem.replace(/\n/g, ' '),
      prompt.replace(/\n/g, ' '),
      // 4개 선택지 컬럼을 모두 채우기
      ...(questionType === 'multiple_choice' 
        ? choices.map(c => c.replace(/\n/g, ' '))
        : ['', '', '', ''] // 주관식은 선택지 컬럼을 비워둠
      ),
      questionType === 'multiple_choice' ? String.fromCharCode(65 + answer) : (choices.length > 0 ? choices.join('|') : ''),
      subject,
      questionType
    ];
    
    // CSV 형식에 맞게 데이터 이스케이프 처리
    const escapedRow = newRow.map(field => {
      if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
        // 콤마, 따옴표, 줄바꿈이 포함된 경우 따옴표로 감싸고 내부 따옴표는 이스케이프
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    });
    
    await fs.appendFile(QUESTIONS_PATH, `\n${escapedRow.join(',')}`);
    res.json({ success: true });
  } catch (e) {
    console.error('❌ 문제 저장 실패:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 관리자 검색 페이지 라우트 추가
app.get('/admin', async (req, res) => {
    // 비밀번호 확인
    const password = req.query.password;
    if (password !== 'missionto1600!') {
        // 비밀번호가 틀리거나 없으면 로그인 페이지 표시
        const loginHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Admin Login</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; background-color: #f4f7f6; padding: 40px; }
                .container { max-width: 400px; margin: auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                h1 { color: #2c3e50; margin-bottom: 30px; }
                input[type="password"] { width: 100%; padding: 12px; border: 1px solid #ccc; border-radius: 5px; font-size: 16px; box-sizing: border-box; margin-bottom: 20px; }
                button { width: 100%; padding: 12px; background: #071BE9; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; }
                button:hover { background: #0515c7; }
                .error { color: red; margin-bottom: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Admin Login</h1>
                <form method="GET" action="/admin">
                    <input type="password" name="password" placeholder="Enter password" required>
                    <button type="submit">Login</button>
                </form>
            </div>
        </body>
        </html>
        `;
        return res.send(loginHtml);
    }

    // 비밀번호가 맞으면 admin 페이지 표시
    const db = await firebaseDB.getAllData();
    // 문제/유닛 DB 파싱 (점수 실시간 계산용)
    const unitDb = await parseCsvFile(path.join(__dirname, 'Diagnostic DataBase - Unit DB.csv'));
    // 점수 계산 함수 (라이브 리포트와 동일)
    function calculateSATScore(questionRows, subject) {
      const subjectQuestions = questionRows.filter(q => q.subject === subject);
      if (subjectQuestions.length === 0) return 400;
      let totalWeightedScore = 0;
      let totalWeight = 0;
      for (const q of subjectQuestions) {
        let weight = 1;
        switch(q.difficulty?.toLowerCase()) {
          case 'easy': weight = 1; break;
          case 'medium': weight = 1.5; break;
          case 'hard': weight = 2; break;
          default: weight = 1;
        }
        let score = 0;
        switch(q.resultType) {
          case 'correct': score = 1; break;
          case 'trap': score = 0.5; break;
          case 'wrong': score = 0; break;
          default: score = 0;
        }
        totalWeightedScore += score * weight;
        totalWeight += weight;
      }
      const weightedAverage = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
      const satScore = Math.round((400 + (weightedAverage * 400)) / 10) * 10;
      return Math.max(400, Math.min(800, satScore));
    }
    // 정답 정규화 함수
    function normalizeAnswer(ans) {
      if (ans === undefined || ans === null) return '';
      if (Array.isArray(ans)) ans = ans[0] || '';
      ans = String(ans).trim().replace(/\s/g, '');
      if (/^\d+\/\d+$/.test(ans)) {
        const [a, b] = ans.split('/').map(Number);
        if (b !== 0) return (a / b).toString();
      }
      if (/^\d+(\.\d+)?%$/.test(ans)) {
        return (parseFloat(ans) / 100).toString();
      }
      return ans;
    }
    // 각 학생별 점수 실시간 계산
    const dbWithLiveScore = db.map(r => {
      // 문항별 정보 조합
      const answers = r.answers || {};
      const questionRows = unitDb.map(unit => {
        const key = `${unit.Section}-${unit.Unit}`;
        const subject = unit.Section;
        const number = unit.Unit;
        const correct = unit['Correct Answer'];
        const studentAnsRaw = answers[key] || '';
        const studentAns = Array.isArray(studentAnsRaw) ? studentAnsRaw[0] : studentAnsRaw;
        let resultType = 'wrong';
        let isCorrect = false;
        if (studentAns && correct) {
          const correctAnswers = String(correct).split(',').map(ans => normalizeAnswer(ans.trim()));
          const studentNorm = normalizeAnswer(studentAns);
          isCorrect = correctAnswers.some(ans => ans === studentNorm);
          if (isCorrect) resultType = 'correct';
        }
        return {
          subject,
          difficulty: unit.Difficulty,
          resultType
        };
      });
      const rwScore = calculateSATScore(questionRows, 'RW');
      const mathScore = calculateSATScore(questionRows, 'Math');
      const totalScore = rwScore + mathScore;
      return { ...r, score: totalScore, rwScore, mathScore };
    });
    let html = `
    <h2>Search by Student Code/Name/Grade</h2>
    <form method="GET" action="/admin/search" style="margin-bottom:24px;">
      <input type="text" name="q" placeholder="Code, Name, Grade, etc." style="padding:8px;font-size:1em;width:220px;">
      <input type="hidden" name="password" value="${password}">
      <button type="submit" style="padding:8px 18px;font-size:1em;">Search</button>
    </form>
    <div id="result"></div>
    <h3>All Submitted Students (${dbWithLiveScore.length})</h3>
    <table border="1" cellpadding="6" style="border-collapse:collapse;font-size:1em;">
      <tr><th>Code</th><th>Name</th><th>Grade</th><th>Score</th><th>RW</th><th>Math</th><th>Submitted At</th><th>Report</th></tr>
`;
    dbWithLiveScore.slice().reverse().forEach(r => {
      html += `<tr><td>${r.code || ''}</td><td>${r.studentName || ''}</td><td>${r.studentGrade || ''}</td><td>${r.score || ''}</td><td>${r.rwScore || ''}</td><td>${r.mathScore || ''}</td><td>${r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : ''}</td><td><a href="/report/${r.id}" target="_blank">View Report</a></td></tr>`;
    });
    html += '</table>';
    res.send(html);
});

app.get('/admin/search', async (req, res) => {
    // 검색 페이지에서도 비밀번호 확인
    const password = req.query.password;
    if (password !== 'missionto1600!') {
        return res.redirect('/admin');
    }

    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.send('<p>Please enter a search term.</p>');
    
    let results = [];
    // 코드로 검색
    if (q.length >= 3) {
        const codeResults = await firebaseDB.searchByCode(q.toUpperCase());
        results = results.concat(codeResults);
    }
    
    // 이름으로 검색
    const nameResults = await firebaseDB.searchByName(q);
    results = results.concat(nameResults);
    
    // 중복 제거
    const uniqueResults = results.filter((result, index, self) => 
        index === self.findIndex(r => r.id === result.id)
    );
    if (uniqueResults.length === 0) {
        return res.send(`<p>No results found.</p><p><a href="/admin?password=${password}">← Back to Admin</a></p>`);
    }
    let html = `<h3>Search Results (${uniqueResults.length})</h3><table border="1" cellpadding="6" style="border-collapse:collapse;font-size:1em;">`;
    html += '<tr><th>Code</th><th>Name</th><th>Grade</th><th>Score</th><th>Submitted At</th><th>Report</th></tr>';
    uniqueResults.forEach(r => {
        html += `<tr><td>${r.code || ''}</td><td>${r.studentName || ''}</td><td>${r.studentGrade || ''}</td><td>${r.score || ''}</td><td>${r.createdAt ? new Date(r.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : ''}</td><td><a href="/report/${r.id}" target="_blank">View Report</a></td></tr>`;
    });
    html += '</table>';
    html += `<p><a href="/admin?password=${password}">← Back to Admin</a></p>`;
    res.send(html);
});

// 4. Server Execution
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});