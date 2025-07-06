const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');

// 1. Server Configuration
const app = express();
const port = 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const REPORTS_DIR = path.join(__dirname, 'reports');

// 2. Middleware Configuration
app.use(express.static(path.join(__dirname))); 
app.use(express.urlencoded({ extended: true }));

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

        // --- Virtual scoring logic ---
        const rwScore = 400 + Math.round(Math.random() * 300);
        const mathScore = 400 + Math.round(Math.random() * 300);
        const totalScore = rwScore + mathScore;
        
        // --- Prepare report data ---
        const reportData = {
            id: resultId,
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
        await fs.mkdir(REPORTS_DIR, { recursive: true });
        const pdfFileName = `report_${resultId}.pdf`;
        const pdfPath = path.join(REPORTS_DIR, pdfFileName);

        const templateHtml = await fs.readFile('report_template.html', 'utf-8');
        let finalHtml = templateHtml;
        for (const key in reportData) {
            finalHtml = finalHtml.replace(new RegExp('{{' + key + '}}', 'g'), reportData[key]);
        }

        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.emulateMediaType('screen');
        await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();
        console.log(`✅ PDF report generation completed: ${pdfFileName}`);
        
        // --- Save results to DB ---
        const db = await readDB();
        db.push({
            id: reportData.id,
            studentName: reportData.studentName,
            studentGrade: reportData.studentGrade,
            score: reportData.score,
            rwScore: reportData.rwScore,
            mathScore: reportData.mathScore,
            createdAt: reportData.createdAt
        });
        await writeDB(db);
        console.log(`Test results saved to DB. ID: ${resultId}`);

        // --- Show only 'next action guidance' page to student ---
        res.sendFile(path.join(__dirname, 'landing.html'));

    } catch (error) {
        console.error('Error during Submit processing:', error);
        if(browser) await browser.close();
        res.status(500).send('An error occurred.');
    }
});

// Role 3: Show dynamic report page
app.get('/report/:id', async (req, res) => {
    try {
        const db = await readDB();
        const resultId = req.params.id;
        const resultData = db.find(r => r.id === resultId);

        if (!resultData) {
            return res.status(404).send('<h1>Report not found.</h1>');
        }

        let reportHtml = await fs.readFile('live_report.html', 'utf-8');

        reportHtml = reportHtml.replace(/{{studentName}}/g, resultData.studentName);
        reportHtml = reportHtml.replace(/{{testDate}}/g, new Date(resultData.createdAt).toLocaleDateString());
        reportHtml = reportHtml.replace(/{{weakestSkill}}/g, 'Information Comprehension');
        reportHtml = reportHtml.replace('{{report_data_json}}', JSON.stringify(resultData));
        
        res.send(reportHtml);

    } catch (error) {
        console.error('Error during Report page generation:', error);
        res.status(500).send('An error occurred.');
    }
});

// questions.csv를 UTF-8로 제공하는 라우트
app.get('/questions.csv', (req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.sendFile(path.join(__dirname, 'questions.csv'));
});


// 4. Server Execution
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});