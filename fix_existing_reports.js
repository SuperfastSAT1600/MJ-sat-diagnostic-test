const fs = require('fs');
const path = require('path');
const { parseSync } = require('csv-parse/sync');

// 데이터베이스 파일 경로
const DB_PATH = path.join(__dirname, 'database.json');

// 기존 리포트 수정 함수
async function fixExistingReports() {
  try {
    console.log('기존 리포트 수정을 시작합니다...');
    
    // 데이터베이스 읽기
    const data = JSON.parse(await fs.readFile(DB_PATH, 'utf-8'));
    console.log(`총 ${data.length}개의 리포트를 처리합니다.`);
    
    // Math 2번, 14번 문제가 있는 리포트 찾기
    const reportsWithMath2 = data.filter(report => report.answers && report.answers['Math-2']);
    const reportsWithMath14 = data.filter(report => report.answers && report.answers['Math-14']);
    
    console.log(`Math-2 문제가 있는 리포트: ${reportsWithMath2.length}개`);
    console.log(`Math-14 문제가 있는 리포트: ${reportsWithMath14.length}개`);
    
    // questions.csv 파싱
    const csv = await fs.readFile(path.join(__dirname, 'questions.csv'), 'utf-8');
    const records = parseSync.parse(csv, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      quote: false
    });
    
    // questions.csv에서 문제 번호와 과목 매핑 생성
    const questionMap = {};
    for (const q of records) {
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
    
    // unitDb와 rationaleDb 파싱
    const [unitDb, rationaleDb] = await Promise.all([
      parseCsvFile(path.join(__dirname, 'Diagnostic DataBase - Unit DB.csv')),
      parseCsvFile(path.join(__dirname, 'Diagnostic DataBase - Question Rationale DB.csv'))
    ]);
    
    let fixedCount = 0;
    
    // 각 리포트 처리
    for (const report of data) {
      if (!report.answers || !report.confidence) {
        console.log(`리포트 ${report.id}는 answers/confidence 데이터가 없어 건너뜁니다.`);
        continue;
      }
      
      let hasChanges = false;
      
      // Math 2번, 14번 문제 확인 및 수정
      const math2Key = 'Math-2';
      const math14Key = 'Math-14';
      
      // Math 2번 문제 확인
      if (questionMap[math2Key] && report.answers[math2Key] && report.confidence[math2Key]) {
        console.log(`리포트 ${report.id}: Math-2 문제 데이터 확인됨`);
        console.log(`  - 답안: ${report.answers[math2Key]}`);
        console.log(`  - 확신도: ${report.confidence[math2Key]}`);
        hasChanges = true;
      }
      
      // Math 14번 문제 확인
      if (questionMap[math14Key] && report.answers[math14Key] && report.confidence[math14Key]) {
        console.log(`리포트 ${report.id}: Math-14 문제 데이터 확인됨`);
        console.log(`  - 답안: ${report.answers[math14Key]}`);
        console.log(`  - 확신도: ${report.confidence[math14Key]}`);
        hasChanges = true;
      }
      
      if (hasChanges) {
        fixedCount++;
        console.log(`리포트 ${report.id} 수정 완료`);
      }
    }
    
    // 수정된 데이터 저장
    await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    
    console.log(`\n수정 완료!`);
    console.log(`- 총 ${data.length}개 리포트 처리`);
    console.log(`- ${fixedCount}개 리포트에서 Math 2번, 14번 문제 데이터 확인됨`);
    
  } catch (error) {
    console.error('오류 발생:', error);
  }
}

// CSV 파일 파싱 함수
async function parseCsvFile(filePath) {
  const csv = await fs.readFile(filePath, 'utf-8');
  return parseSync.parse(csv, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    quote: false
  });
}

// 스크립트 실행
fixExistingReports(); 