const fs = require('fs').promises;
const { firebaseDB } = require('./firebase-server');

async function migrateToFirebase() {
    try {
        console.log('🚀 Starting migration to Firebase...');
        
        // 기존 database.json 읽기
        const databasePath = './database.json';
        const data = await fs.readFile(databasePath, 'utf-8');
        const existingData = JSON.parse(data);
        
        console.log(`📊 Found ${existingData.length} records to migrate`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // 각 레코드를 Firebase로 마이그레이션
        for (const record of existingData) {
            try {
                // 기존 ID를 originalId로 보존하고, Firebase 키를 ID로 사용
                const dataToSave = {
                    originalId: record.id, // 기존 UUID 보존
                    code: record.code || '',
                    studentName: record.studentName || '',
                    studentGrade: record.studentGrade || '',
                    score: record.score || 0,
                    rwScore: record.rwScore || 0,
                    mathScore: record.mathScore || 0,
                    createdAt: record.createdAt || new Date().toISOString(),
                    answers: record.answers || {},
                    confidence: record.confidence || {},
                    // 기존 데이터에 있던 추가 필드들도 보존
                    rw_results_table: record.rw_results_table || '',
                    rw_rationale_list: record.rw_rationale_list || '',
                    math_results_table: record.math_results_table || '',
                    math_rationale_list: record.math_rationale_list || '',
                    reportImageUrl: record.reportImageUrl || ''
                };
                
                // Firebase에 저장
                const firebaseKey = await firebaseDB.saveData(dataToSave);
                console.log(`✅ Migrated: ${record.studentName || 'Unknown'} (${record.id}) -> Firebase key: ${firebaseKey}`);
                successCount++;
                
                // 잠시 대기 (Firebase 요청 제한 방지)
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`❌ Failed to migrate record ${record.id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n🎉 Migration completed!');
        console.log(`✅ Successfully migrated: ${successCount} records`);
        console.log(`❌ Failed to migrate: ${errorCount} records`);
        
        // 마이그레이션 완료 후 Firebase에서 모든 데이터 확인
        console.log('\n📋 Verifying migrated data...');
        const allData = await firebaseDB.getAllData();
        console.log(`📊 Total records in Firebase: ${allData.length}`);
        
        // 샘플 데이터 출력
        if (allData.length > 0) {
            console.log('\n📝 Sample migrated record:');
            console.log(JSON.stringify(allData[0], null, 2));
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

// 스크립트 실행
migrateToFirebase(); 