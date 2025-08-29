import { useState, useEffect } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import './App.css';

function App() {
  type Question = {
    number: number;
    stem: string;
    prompt: string;
    choices: string[];
    answer: number;
    subject: string;
    questionType: 'multiple_choice' | 'short_answer';
  };
  const [questionNumber, setQuestionNumber] = useState(1);
  const [stem, setStem] = useState('');
  const [prompt, setPrompt] = useState('');
  const [choices, setChoices] = useState(['', '', '', '']);
  const [answer, setAnswer] = useState(0);
  const [subject, setSubject] = useState('RW');
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'short_answer'>('multiple_choice');
  const [shortAnswerAnswers, setShortAnswerAnswers] = useState<string[]>(['']);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [openAccordion, setOpenAccordion] = useState<{ RW: boolean; Math: boolean }>({ RW: true, Math: false });

  useEffect(() => {
    fetch('/api/questions')
      .then(res => res.json())
      .then(data => {
        console.log('=== Received question list from frontend ===');
        console.log('Total questions:', data.length);
        console.log('Math questions:', data.filter((q: Question) => q.subject === 'Math'));
        console.log('RW questions:', data.filter((q: Question) => q.subject === 'RW'));
        console.log('========================');
        setQuestions(data);
      })
      .catch(error => {
        console.error('Failed to load question list:', error);
      });
  }, []);

  const handleChoiceChange = (value: string, idx: number) => {
    const newChoices = [...choices];
    newChoices[idx] = value;
    setChoices(newChoices);
  };

  const handleShortAnswerChange = (value: string, idx: number) => {
    const newAnswers = [...shortAnswerAnswers];
    newAnswers[idx] = value;
    setShortAnswerAnswers(newAnswers);
  };

  const addShortAnswer = () => {
    setShortAnswerAnswers([...shortAnswerAnswers, '']);
  };

  const removeShortAnswer = (idx: number) => {
    if (shortAnswerAnswers.length > 1) {
      const newAnswers = shortAnswerAnswers.filter((_, i) => i !== idx);
      setShortAnswerAnswers(newAnswers);
    }
  };

  const handleSave = async () => {
    const payload = {
      number: questionNumber,
      stem,
      prompt,
      choices: questionType === 'short_answer' ? shortAnswerAnswers : choices,
      answer,
      subject,
      questionType
    };
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert('Question saved!');
      // Immediately refresh question list
      fetch('/api/questions')
        .then(res => res.json())
        .then(data => setQuestions(data));
    } else {
      alert('Save failed!');
    }
  };



  const handleAccordion = (subj: 'RW' | 'Math') => {
    setOpenAccordion(prev => ({ ...prev, [subj]: !prev[subj] }));
  };

  const grouped: { RW: Question[]; Math: Question[] } = { RW: [], Math: [] };
  questions.forEach(q => {
    if (q.subject === 'Math') grouped.Math.push(q);
    else grouped.RW.push(q);
  });
  
  // Debug: Check grouped question count
  console.log('=== Grouped question count ===');
  console.log('RW question count:', grouped.RW.length);
  console.log('Math question count:', grouped.Math.length);
  console.log('Math question numbers:', grouped.Math.map(q => q.number));
  console.log('========================');

  const editorInit = {
    height: 300,
    menubar: false,
    plugins: [
      'table', 'lists', 'link', 'image', 'code'
    ],
    toolbar:
      'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright | bullist numlist | table | image | code',
    // 이미지 업로드 설정 - 메인 서버로 변경
    images_upload_url: 'http://localhost:3000/api/upload-image',
    images_upload_handler: function (blobInfo: any) {
      return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('image', blobInfo.blob(), blobInfo.filename());
        
        fetch('http://localhost:3000/api/upload-image', {
          method: 'POST',
          body: formData
        })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            resolve(result.url);
          } else {
            reject('Image upload failed');
          }
        })
        .catch(error => {
          reject(error);
        });
      });
    },
    // 이미지 관련 설정
    image_title: true,
    automatic_uploads: true,
    file_picker_types: 'image',
    // HTML 정리 설정
    cleanup: true,
    verify_html: true,
    // 줄바꿈 처리
    forced_root_block: 'p',
    remove_linebreaks: false,
    convert_newlines_to_brs: true,
    // 이미지 크기 조정
    image_advtab: true,
    image_dimensions: true,
    image_class_list: [
      {title: 'Responsive', value: 'img-fluid'}
    ]
  };

  return (
    <div className="container" style={{ maxWidth: 700, margin: '40px auto' }}>
      <h2>Register Question</h2>
      <div style={{ marginBottom: 24 }}>
        <label>Question Number</label>
        <input
          type="number"
          min={1}
          value={questionNumber}
          onChange={e => setQuestionNumber(Number(e.target.value))}
          style={{ width: 120, marginLeft: 12 }}
        />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label>Subject</label>
        <select value={subject} onChange={e => setSubject(e.target.value)} style={{ width: 120, marginLeft: 12 }}>
          <option value="RW">RW</option>
          <option value="Math">Math</option>
        </select>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label>Question Type</label>
        <select 
          value={questionType} 
          onChange={e => {
            const newType = e.target.value as 'multiple_choice' | 'short_answer';
            setQuestionType(newType);
            // Reset state when question type changes
            if (newType === 'short_answer') {
              setShortAnswerAnswers(['']);
            } else {
              setChoices(['', '', '', '']);
              setAnswer(0);
            }
          }} 
          style={{ width: 150, marginLeft: 12 }}
        >
          <option value="multiple_choice">Multiple Choice (4 options)</option>
          <option value="short_answer">Short Answer</option>
        </select>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label>Stem</label>
        <Editor apiKey="wqahejbc90a8ng6fw18qt7pr8xclmzkxjtvjocpn87pdntbh" value={stem} onEditorChange={setStem} init={editorInit} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label>Prompt</label>
        <Editor apiKey="wqahejbc90a8ng6fw18qt7pr8xclmzkxjtvjocpn87pdntbh" value={prompt} onEditorChange={setPrompt} init={editorInit} />
      </div>
      {questionType === 'multiple_choice' && (
      <div style={{ marginBottom: 24 }}>
        <label>Choices</label>
        {choices.map((choice, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <input
              type="radio"
              name="answer"
              checked={answer === idx}
              onChange={() => setAnswer(idx)}
              style={{ marginRight: 8 }}
            />
            <Editor
              apiKey="wqahejbc90a8ng6fw18qt7pr8xclmzkxjtvjocpn87pdntbh"
              value={choice}
              onEditorChange={(val: string) => handleChoiceChange(val, idx)}
              init={editorInit}
            />
          </div>
        ))}
      </div>
      )}
      
      {questionType === 'short_answer' && (
        <div style={{ marginBottom: 24 }}>
          <label>Answer (Multiple answers possible)</label>
          {shortAnswerAnswers.map((answer, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <input
                type="text"
                value={answer}
                onChange={(e) => handleShortAnswerChange(e.target.value, idx)}
                style={{ flex: 1, padding: '8px', fontSize: '1em', marginRight: '8px' }}
                placeholder={`Enter answer ${idx + 1}`}
              />
              {shortAnswerAnswers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeShortAnswer(idx)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#ff4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addShortAnswer}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9em'
            }}
          >
            + Add Answer
          </button>
        </div>
      )}
      <button type="button" onClick={handleSave}>Save</button>
      
      {/* Question list display */}
      <div style={{ marginTop: 50 }}>
        <h2>Registered Question List</h2>
        
        {/* RW Questions */}
        <div style={{ marginBottom: 30 }}>
          <h3 onClick={() => handleAccordion('RW')} style={{ cursor: 'pointer', color: '#2c3e50' }}>
            📚 RW Questions ({grouped.RW.length} items) {openAccordion.RW ? '▼' : '▶'}
          </h3>
          {openAccordion.RW && (
            <div style={{ marginLeft: 20 }}>
              {grouped.RW.map((q, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  padding: 15, 
                  marginBottom: 10, 
                  borderRadius: 5,
                  backgroundColor: '#f9f9f9'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 5 }}>
                    Question {q.number} (RW) - {q.questionType === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666', marginBottom: 5 }}>
                    Stem: {q.stem.substring(0, 100)}...
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666', marginBottom: 5 }}>
                    Prompt: {q.prompt.substring(0, 100)}...
                  </div>
                  {q.questionType === 'short_answer' && (
                    <div style={{ fontSize: '0.9em', color: '#007bff' }}>
                      Answer: {q.choices.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Math Questions */}
        <div style={{ marginBottom: 30 }}>
          <h3 onClick={() => handleAccordion('Math')} style={{ cursor: 'pointer', color: '#2c3e50' }}>
            🧮 Math Questions ({grouped.Math.length} items) {openAccordion.Math ? '▼' : '▶'}
          </h3>
          {openAccordion.Math && (
            <div style={{ marginLeft: 20 }}>
              {grouped.Math.map((q, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid #ddd', 
                  padding: 15, 
                  marginBottom: 10, 
                  borderRadius: 5,
                  backgroundColor: '#f9f9f9'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 5 }}>
                    Question {q.number} (Math) - {q.questionType === 'multiple_choice' ? 'Multiple Choice' : 'Short Answer'}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666', marginBottom: 5 }}>
                    Stem: {q.stem.substring(0, 100)}...
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666', marginBottom: 5 }}>
                    Prompt: {q.prompt.substring(0, 100)}...
                  </div>
                  {q.questionType === 'short_answer' && (
                    <div style={{ fontSize: '0.9em', color: '#007bff' }}>
                      Answer: {q.choices.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
