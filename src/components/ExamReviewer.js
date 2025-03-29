import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';

const ExamReviewer = () => {
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [stats, setStats] = useState({
    attempted: 0,
    correct: 0,
    incorrect: 0,
  });
  // 篩選條件
  const [filters, setFilters] = useState({
    examTitle: '',
    subject: '',
    questionType: '選擇題', // 預設選擇題
  });
  // 獲取不同的篩選選項
  const [filterOptions, setFilterOptions] = useState({
    examTitles: [],
    subjects: [],
    questionTypes: [],
  });
  // 學習模式
  const [mode, setMode] = useState('test'); // test, review (已移除 practice 模式)
  const [reviewWrongOnly, setReviewWrongOnly] = useState(false);
  const [wrongQuestions, setWrongQuestions] = useState([]);
  const [questionStats, setQuestionStats] = useState({}); // 記錄每個題目的錯誤次數
  const [markedQuestions, setMarkedQuestions] = useState([]); // 標記為"不會"的題目
  const [showMarkedOnly, setShowMarkedOnly] = useState(false); // 是否只顯示標記的題目
  const [notes, setNotes] = useState({}); // 儲存每個題目的筆記
  const [currentNote, setCurrentNote] = useState(''); // 當前題目的筆記
  const [showNoteEditor, setShowNoteEditor] = useState(false); // 是否顯示筆記編輯器
  const [showNoteSection, setShowNoteSection] = useState(false); // 是否顯示筆記區域
  const [tags, setTags] = useState({}); // 儲存題目的標籤 {questionId: [tag1, tag2, ...]}
  const [currentTag, setCurrentTag] = useState(''); // 當前輸入的標籤
  const [allTags, setAllTags] = useState([]); // 所有已使用的標籤列表
  const [selectedTag, setSelectedTag] = useState(''); // 當前選擇的篩選標籤
  const [testResults, setTestResults] = useState([]);
  const [tagSearchQuery, setTagSearchQuery] = useState(''); // 標籤搜尋查詢
  const [filteredTags, setFilteredTags] = useState([]); // 經過篩選的標籤
  // 從CSV載入資料
  useEffect(() => {
    const loadData = async () => {
      try {
        // 替換為fetch API (VS Code開發用)
        const response = await fetch('/questions_with_answers.csv');
        const text = await response.text();
        
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data;
            setQuestions(data);
            
            // 取得篩選選項
            const examTitles = [...new Set(data.map(row => row['考試標題']))];
            const subjects = [...new Set(data.map(row => row['科目']))];
            const questionTypes = [...new Set(data.map(row => row['題型']))];
            
            setFilterOptions({
              examTitles,
              subjects,
              questionTypes,
            });
            
            // 默認篩選選擇題
            const defaultFiltered = data.filter(q => q['題型'] === '選擇題');
            setFilteredQuestions(defaultFiltered);
            setLoading(false);
          },
          error: (error) => {
            console.error('Error parsing CSV:', error);
            setLoading(false);
          }
        });
      } catch (error) {
        console.error('Error reading file:', error);
        setLoading(false);
      }
    };
    loadData();
  }, []);
  // 當前題目變更時載入筆記
  useEffect(() => {
    if (filteredQuestions.length > 0 && currentQuestionIndex < filteredQuestions.length) {
      const currentQuestion = filteredQuestions[currentQuestionIndex];
      const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
      setCurrentNote(notes[questionId] || '');
    }
  }, [currentQuestionIndex, filteredQuestions, notes]);
  // 當全部標籤更新或搜尋查詢變更時，更新過濾後的標籤
  useEffect(() => {
    if (tagSearchQuery.trim() === '') {
      setFilteredTags(allTags);
    } else {
      const filtered = allTags.filter(tag => 
        tag.toLowerCase().includes(tagSearchQuery.toLowerCase())
      );
      setFilteredTags(filtered);
    }
  }, [allTags, tagSearchQuery]);
  // 套用篩選
  useEffect(() => {
    if (questions.length > 0) {
      let filtered = [...questions];
      
      if (filters.examTitle) {
        filtered = filtered.filter(q => q['考試標題'] === filters.examTitle);
      }
      
      if (filters.subject) {
        filtered = filtered.filter(q => q['科目'] === filters.subject);
      }
      
      if (filters.questionType) {
        filtered = filtered.filter(q => q['題型'] === filters.questionType);
      }
      
      // 按標籤篩選
      if (selectedTag) {
        filtered = filtered.filter(q => {
          const questionId = `${q['考試標題']}_${q['科目']}_${q['題號']}`;
          const questionTags = tags[questionId] || [];
          return questionTags.includes(selectedTag);
        });
      }
      
      // 在複習模式下根據篩選條件處理
      if (mode === 'review') {
        // 只顯示標記為"不會"的題目
        if (showMarkedOnly) {
          filtered = filtered.filter(q => markedQuestions.some(mq => 
            mq['題號'] === q['題號'] && 
            mq['考試標題'] === q['考試標題'] && 
            mq['科目'] === q['科目']
          ));
        } 
        // 只顯示錯誤的題目
        else if (reviewWrongOnly) {
          filtered = filtered.filter(q => wrongQuestions.some(wq => 
            wq['題號'] === q['題號'] && 
            wq['考試標題'] === q['考試標題'] && 
            wq['科目'] === q['科目']
          ));
        }
        
        // 在複習模式下，根據錯誤次數排序（錯誤次數多的優先顯示）
        filtered.sort((a, b) => {
          const aId = `${a['考試標題']}_${a['科目']}_${a['題號']}`;
          const bId = `${b['考試標題']}_${b['科目']}_${b['題號']}`;
          
          // 檢查是否為標記的題目
          const aIsMarked = markedQuestions.some(mq => 
            mq['題號'] === a['題號'] && 
            mq['考試標題'] === a['考試標題'] && 
            mq['科目'] === a['科目']
          );
          
          const bIsMarked = markedQuestions.some(mq => 
            mq['題號'] === b['題號'] && 
            mq['考試標題'] === b['考試標題'] && 
            mq['科目'] === b['科目']
          );
          
          // 標記的題目優先
          if (aIsMarked && !bIsMarked) return -1;
          if (!aIsMarked && bIsMarked) return 1;
          
          const aWrongCount = questionStats[aId]?.wrongCount || 0;
          const bWrongCount = questionStats[bId]?.wrongCount || 0;
          
          // 接著按錯誤次數降序排序
          if (bWrongCount !== aWrongCount) {
            return bWrongCount - aWrongCount;
          }
          
          // 如果錯誤次數相同，按最後嘗試時間排序（最近的優先）
          const aLastAttempted = questionStats[aId]?.lastAttempted || '';
          const bLastAttempted = questionStats[bId]?.lastAttempted || '';
          
          return bLastAttempted.localeCompare(aLastAttempted);
        });
      } else if (mode === 'practice') {
        // 隨機排序題目 (僅在練習模式)
        filtered = _.shuffle(filtered);
      }
      
      setFilteredQuestions(filtered);
      
      // 不要在測驗模式下重置當前題目索引，只在其他情況下重置
      if (mode !== 'test' || currentQuestionIndex === undefined) {
        setCurrentQuestionIndex(0);
      }
      
      setShowAnswer(false);
      setSelectedAnswer('');
      setShowNoteSection(false); // 重置筆記區域為隱藏狀態
    }
  }, [filters, questions, mode, reviewWrongOnly, wrongQuestions, questionStats, markedQuestions, showMarkedOnly, selectedTag, tags]);
  // 檢查答案
  const checkAnswer = () => {
    if (!selectedAnswer || showAnswer) return;
    
    // 儲存當前題號，以便檢查是否發生了意外的題目變更
    const startIndex = currentQuestionIndex;
    
    const currentQuestion = filteredQuestions[currentQuestionIndex];
    const isCorrect = selectedAnswer === currentQuestion['答案'];
    
    setStats({
      attempted: stats.attempted + 1,
      correct: isCorrect ? stats.correct + 1 : stats.correct,
      incorrect: !isCorrect ? stats.incorrect + 1 : stats.incorrect,
    });
    
    // 如果答錯，加入錯題集並更新錯誤次數統計
    if (!isCorrect) {
      // 加入錯題集
      setWrongQuestions(prev => {
        // 檢查是否已經在錯題集中
        const alreadyExists = prev.some(q => 
          q['題號'] === currentQuestion['題號'] && 
          q['考試標題'] === currentQuestion['考試標題'] && 
          q['科目'] === currentQuestion['科目']
        );
        
        // 如果不在錯題集中，才加入
        return alreadyExists ? prev : [...prev, currentQuestion];
      });
      
      // 更新題目統計
      setQuestionStats(prev => {
        // 創建一個唯一的題目識別碼
        const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
        
        // 更新該題目的錯誤次數
        return {
          ...prev,
          [questionId]: {
            wrongCount: (prev[questionId]?.wrongCount || 0) + 1,
            lastAttempted: new Date().toISOString()
          }
        };
      });
    }
    
    // 在測驗模式下，記錄結果
    if (mode === 'test') {
      setTestResults(prev => [...prev, {
        question: currentQuestion,
        selectedAnswer,
        isCorrect
      }]);
    }
    
    setShowAnswer(true);
    
    // 確保題目不會變更 - 在這裡明確地重設回原始索引
    if (currentQuestionIndex !== startIndex) {
      setCurrentQuestionIndex(startIndex);
    }
    
    // 顯示答案正確與否的提示
    const message = isCorrect 
      ? '答案正確！請按「下一題」繼續'
      : '答案錯誤！請按「下一題」繼續';
    const style = isCorrect ? 'bg-green-500' : 'bg-red-500';
    
    // 建立提示元素
    const feedback = document.createElement('div');
    feedback.className = `fixed top-4 right-4 ${style} text-white px-4 py-2 rounded shadow-lg`;
    feedback.textContent = message;
    document.body.appendChild(feedback);
    
    // 2秒後移除提示
    setTimeout(() => {
      document.body.removeChild(feedback);
      
      // 測驗模式中不要自動做任何動作，讓使用者自己決定下一步
      // 但要確保題目不會變更 - 再次檢查索引是否仍然正確
      if (currentQuestionIndex !== startIndex) {
        setCurrentQuestionIndex(startIndex);
      }
    }, 2000);
  };
// 處理選擇答案的邏輯
  const handleOptionClick = (option) => {
    // 如果已經顯示答案，則不做任何事
    if (showAnswer) return;
    
    // 如果點擊的是已選擇的選項，則直接確認答案
    if (selectedAnswer === option) {
      checkAnswer();
    } else {
      // 否則，選擇該選項
      setSelectedAnswer(option);
    }
  };
  // 下一題
  const nextQuestion = () => {
    if (currentQuestionIndex < filteredQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowAnswer(false);
      setSelectedAnswer('');
      setShowNoteSection(false); // 關閉筆記區域
    } else if (mode === 'test') {
      // 測驗結束
      alert(`測驗完成!\n正確: ${stats.correct}\n錯誤: ${stats.incorrect}\n正確率: ${((stats.correct / stats.attempted) * 100).toFixed(2)}%`);
    }
  };

  // 上一題
  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowAnswer(false);
      setSelectedAnswer('');
      setShowNoteSection(false); // 關閉筆記區域
    }
  };
  
  // 重設
  const resetQuiz = () => {
    setCurrentQuestionIndex(0);
    setShowAnswer(false);
    setSelectedAnswer('');
    setStats({
      attempted: 0,
      correct: 0,
      incorrect: 0,
    });
    setTestResults([]);
    setShowNoteSection(false); // 關閉筆記區域
    
    // 在練習模式下重新隨機排序題目
    if (mode === 'practice') {
      setFilteredQuestions(_.shuffle(filteredQuestions));
    }
  };
  // 切換學習模式
  const changeMode = (newMode) => {
    setMode(newMode);
    resetQuiz();
  };
  // 標記題目為"不會"
  const markQuestion = () => {
    const currentQuestion = filteredQuestions[currentQuestionIndex];
    
    // 檢查是否已經被標記
    const isAlreadyMarked = markedQuestions.some(q => 
      q['題號'] === currentQuestion['題號'] && 
      q['考試標題'] === currentQuestion['考試標題'] && 
      q['科目'] === currentQuestion['科目']
    );
    
    if (isAlreadyMarked) {
      // 如果已經標記，則取消標記
      setMarkedQuestions(prev => 
        prev.filter(q => 
          !(q['題號'] === currentQuestion['題號'] && 
          q['考試標題'] === currentQuestion['考試標題'] && 
          q['科目'] === currentQuestion['科目'])
        )
      );
      
      // 顯示取消標記的提示
      const feedback = document.createElement('div');
      feedback.className = `fixed top-4 right-4 bg-gray-500 text-white px-4 py-2 rounded shadow-lg`;
      feedback.textContent = '已取消標記「不會」';
      document.body.appendChild(feedback);
      
      setTimeout(() => {
        document.body.removeChild(feedback);
      }, 2000);
      
    } else {
      // 如果未標記，則添加標記
      setMarkedQuestions(prev => [...prev, currentQuestion]);
      
      // 顯示已標記的提示
      const feedback = document.createElement('div');
      feedback.className = `fixed top-4 right-4 bg-purple-500 text-white px-4 py-2 rounded shadow-lg`;
      feedback.textContent = '已標記為「不會」';
      document.body.appendChild(feedback);
      
      setTimeout(() => {
        document.body.removeChild(feedback);
      }, 2000);
    }
  };
  
  // 保存筆記
  const saveNote = () => {
    const currentQuestion = filteredQuestions[currentQuestionIndex];
    const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
    
    // 儲存筆記
    setNotes(prev => ({
      ...prev,
      [questionId]: currentNote
    }));
    
    // 顯示保存成功的提示
    const feedback = document.createElement('div');
    feedback.className = `fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg`;
    feedback.textContent = '筆記已保存';
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
    
    // 關閉編輯器
    setShowNoteEditor(false);
  };
  
  // 添加標籤
  const addTag = () => {
    if (!currentTag.trim()) return;
    
    const currentQuestion = filteredQuestions[currentQuestionIndex];
    const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
    
    // 檢查標籤是否已存在
    const existingTags = tags[questionId] || [];
    if (existingTags.includes(currentTag.trim())) {
      // 顯示標籤已存在的提示
      const feedback = document.createElement('div');
      feedback.className = `fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded shadow-lg`;
      feedback.textContent = '此標籤已存在';
      document.body.appendChild(feedback);
      
      setTimeout(() => {
        document.body.removeChild(feedback);
      }, 2000);
      
      return;
    }
    
    // 添加新標籤
    const newTags = [...existingTags, currentTag.trim()];
    setTags(prev => ({
      ...prev,
      [questionId]: newTags
    }));
    
    // 更新所有標籤列表
    if (!allTags.includes(currentTag.trim())) {
      setAllTags(prev => [...prev, currentTag.trim()].sort());
    }
    
    // 清空輸入框
    setCurrentTag('');
    
    // 顯示添加成功的提示
    const feedback = document.createElement('div');
    feedback.className = `fixed top-4 right-4 bg-blue-500 text-white px-4 py-2 rounded shadow-lg`;
    feedback.textContent = `標籤「${currentTag.trim()}」已添加`;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  };
  
  // 移除標籤
  const removeTag = (tagToRemove) => {
    // 確認是否要刪除標籤
    if (!window.confirm(`確定要刪除標籤「${tagToRemove}」嗎？`)) {
      return; // 用戶取消刪除
    }

    const currentQuestion = filteredQuestions[currentQuestionIndex];
    const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
    
    // 從題目中移除標籤
    const existingTags = tags[questionId] || [];
    const newTags = existingTags.filter(tag => tag !== tagToRemove);
    
    setTags(prev => ({
      ...prev,
      [questionId]: newTags
    }));
    
    // 顯示移除成功的提示
    const feedback = document.createElement('div');
    feedback.className = `fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg`;
    feedback.textContent = `標籤「${tagToRemove}」已移除`;
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
    
    // 如果沒有其他題目使用此標籤，也從全局標籤列表中移除
    let tagStillInUse = false;
    Object.values(tags).forEach(tagList => {
      if (tagList.includes(tagToRemove)) {
        tagStillInUse = true;
      }
    });
    
    if (!tagStillInUse) {
      setAllTags(prev => prev.filter(tag => tag !== tagToRemove));
      setFilteredTags(prev => prev.filter(tag => tag !== tagToRemove));
      
      // 如果當前篩選的就是這個標籤，清除篩選
      if (selectedTag === tagToRemove) {
        setSelectedTag('');
      }
    }
  };
  
  // 匯出筆記
  const exportNotes = () => {
    // 準備匯出的資料
    const exportData = [];
    
    // 遍歷所有有筆記的題目
    Object.keys(notes).forEach(questionId => {
      // 解析題目ID
      const [examTitle, subject, questionNumber] = questionId.split('_');
      
      // 找到對應的題目
      const question = questions.find(q => 
        q['考試標題'] === examTitle && 
        q['科目'] === subject && 
        q['題號'] === questionNumber
      );
      
      if (question) {
        // 獲取題目的標籤
        const questionTags = tags[questionId] || [];
        
        exportData.push({
          考試標題: examTitle,
          科目: subject,
          題號: questionNumber,
          題目: question['題目'],
          答案: question['答案'],
          筆記: notes[questionId],
          標籤: questionTags.join(', '),
          錯誤次數: (questionStats[questionId]?.wrongCount || 0),
          是否標記為不會: markedQuestions.some(q => 
            q['題號'] === questionNumber && 
            q['考試標題'] === examTitle && 
            q['科目'] === subject
          ) ? '是' : '否'
        });
      }
    });
    
    // 如果沒有筆記，顯示提示
    if (exportData.length === 0) {
      alert('沒有可匯出的筆記');
      return;
    }
    
    // 轉換成CSV格式
    let csv = '考試標題,科目,題號,題目,答案,筆記,標籤,錯誤次數,是否標記為不會\n';
    
    exportData.forEach(row => {
      // 處理CSV中的特殊字元
      const processField = (field) => {
        if (field === undefined || field === null) return '';
        const str = String(field);
        // 如果包含逗號、換行符或雙引號，則需要用雙引號包圍並處理內部的雙引號
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      
      csv += `${processField(row.考試標題)},${processField(row.科目)},${processField(row.題號)},${processField(row.題目)},${processField(row.答案)},${processField(row.筆記)},${processField(row.標籤)},${processField(row.錯誤次數)},${processField(row.是否標記為不會)}\n`;
    });
    
    // 創建下載連結
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', '證券分析師考題筆記.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 顯示匯出成功的提示
    const feedback = document.createElement('div');
    feedback.className = `fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg`;
    feedback.textContent = '筆記已匯出為CSV檔案';
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  };

  // 點擊顯示的標籤，篩選相同標籤的題目
  const filterByTag = (tagName) => {
    setSelectedTag(tagName);
    // 滾動到頁面頂部
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">載入中...</div>;
  }
  // 當前問題
  const currentQuestion = filteredQuestions[currentQuestionIndex];
  const progress = `${currentQuestionIndex + 1} / ${filteredQuestions.length}`;
  
  // 如果沒有符合條件的題目
  if (!currentQuestion) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">證券分析師考古題複習系統</h1>
        
        <div className="mb-6 flex flex-wrap gap-4">
          <select 
            className="border p-2 rounded"
            value={mode}
            onChange={(e) => changeMode(e.target.value)}
          >
            <option value="test">測驗模式</option>
            <option value="review">複習模式</option>
          </select>
          
          <select 
            className="border p-2 rounded"
            value={filters.examTitle}
            onChange={(e) => setFilters({...filters, examTitle: e.target.value})}
          >
            <option value="">所有考試</option>
            {filterOptions.examTitles.map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
          
          <select 
            className="border p-2 rounded"
            value={filters.subject}
            onChange={(e) => setFilters({...filters, subject: e.target.value})}
          >
            <option value="">所有科目</option>
            {filterOptions.subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          
          <select 
            className="border p-2 rounded"
            value={filters.questionType}
            onChange={(e) => setFilters({...filters, questionType: e.target.value})}
          >
            <option value="">所有題型</option>
            {filterOptions.questionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          {/* 標籤篩選 */}
          {allTags.length > 0 && (
            <select 
              className="border p-2 rounded"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">所有標籤</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
          
          {mode === 'review' && (
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={reviewWrongOnly}
                onChange={() => {
                  setReviewWrongOnly(!reviewWrongOnly);
                  if (!reviewWrongOnly) setShowMarkedOnly(false); // 取消標記顯示
                }}
                className="mr-2"
              />
              只顯示錯題
            </label>
          )}
          
          {mode === 'review' && (
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={showMarkedOnly}
                onChange={() => {
                  setShowMarkedOnly(!showMarkedOnly);
                  if (!showMarkedOnly) setReviewWrongOnly(false); // 取消錯題顯示
                }}
                className="mr-2"
              />
              只顯示標記為「不會」的題目
            </label>
          )}
        </div>
        
        <div className="bg-yellow-100 p-4 rounded-lg text-center">
          沒有符合條件的題目，請調整篩選條件
        </div>
      </div>
    );
  }
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">證券分析師考古題複習系統</h1>
      
      <div className="mb-6 flex justify-between items-center">
        <div className="flex flex-wrap gap-4">
          <select 
            className="border p-2 rounded"
            value={mode}
            onChange={(e) => changeMode(e.target.value)}
          >
            <option value="test">測驗模式</option>
            <option value="review">複習模式</option>
          </select>
          
          <select 
            className="border p-2 rounded"
            value={filters.examTitle}
            onChange={(e) => setFilters({...filters, examTitle: e.target.value})}
          >
            <option value="">所有考試</option>
            {filterOptions.examTitles.map(title => (
              <option key={title} value={title}>{title}</option>
            ))}
          </select>
          
          <select 
            className="border p-2 rounded"
            value={filters.subject}
            onChange={(e) => setFilters({...filters, subject: e.target.value})}
          >
            <option value="">所有科目</option>
            {filterOptions.subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          
          <select 
            className="border p-2 rounded"
            value={filters.questionType}
            onChange={(e) => setFilters({...filters, questionType: e.target.value})}
          >
            <option value="">所有題型</option>
            {filterOptions.questionTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          
          {/* 標籤篩選 */}
          {allTags.length > 0 && (
            <select 
              className="border p-2 rounded"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="">所有標籤</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          )}
        </div>
        
        {/* 筆記匯出按鈕 */}
        <button 
          className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
          onClick={exportNotes}
        >
          匯出筆記
        </button>
      </div>
      
      {mode === 'review' && (
        <div className="flex flex-col gap-2 bg-blue-50 p-3 rounded-lg mb-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={reviewWrongOnly}
                onChange={() => {
                  setReviewWrongOnly(!reviewWrongOnly);
                  if (!reviewWrongOnly) setShowMarkedOnly(false); // 取消標記顯示
                }}
                className="mr-2"
              />
              只顯示錯題
            </label>
            
            <div className="text-sm text-gray-700">
              {wrongQuestions.length > 0 ? (
                `總共有 ${wrongQuestions.length} 道錯題`
              ) : (
                '目前沒有錯題記錄'
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input 
                type="checkbox" 
                checked={showMarkedOnly}
                onChange={() => {
                  setShowMarkedOnly(!showMarkedOnly);
                  if (!showMarkedOnly) setReviewWrongOnly(false); // 取消錯題顯示
                }}
                className="mr-2"
              />
              只顯示標記為「不會」的題目
            </label>
            
            <div className="text-sm text-gray-700">
              {markedQuestions.length > 0 ? (
                `總共有 ${markedQuestions.length} 道標記為「不會」的題目`
              ) : (
                '目前沒有標記的題目'
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-4 flex justify-between items-center">
        <div>
          <span className="font-semibold">{currentQuestion['考試標題']}</span> | 
          <span className="ml-2">{currentQuestion['科目']}</span> | 
          <span className="ml-2">第 {currentQuestion['題號']} 題</span>
          
          {/* 顯示錯誤次數 */}
          {(() => {
            const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
            const stats = questionStats[questionId];
            if (stats && stats.wrongCount > 0) {
              return (
                <span className="ml-2 text-red-500 font-medium">
                  已錯誤 {stats.wrongCount} 次
                </span>
              );
            }
            return null;
          })()}
          
          {/* 顯示是否標記為"不會" */}
          {markedQuestions.some(q => 
            q['題號'] === currentQuestion['題號'] && 
            q['考試標題'] === currentQuestion['考試標題'] && 
            q['科目'] === currentQuestion['科目']
          ) && (
            <span className="ml-2 text-purple-500 font-medium">
              ★ 已標記為不會
            </span>
          )}
          
          {/* 顯示題目標籤 */}
          {(() => {
            const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
            const questionTags = tags[questionId] || [];
            if (questionTags.length > 0) {
              return (
                <div className="mt-1 flex flex-wrap gap-1">
                  {questionTags.map(tag => (
                    <span 
                      key={tag}
                      className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-200"
                      onClick={() => filterByTag(tag)}
                      title="點擊標籤篩選相同標籤的題目"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              );
            }
            return null;
          })()}
        </div>
        <div className="text-right">
          <span className="bg-blue-100 px-3 py-1 rounded-full text-sm">{progress}</span>
        </div>
      </div>
      
      <div className="mb-6 bg-white p-6 rounded-lg shadow-md">
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">題目：</h2>
          <p className="text-left">{currentQuestion['題目']}</p>
        </div>
        
        {/* 功能按鈕移到這裡：標記為不會和顯示筆記按鈕 */}
        <div className="flex gap-2 mb-4 justify-between">
          <div className="flex gap-2">
            {/* 標記為"不會"按鈕 */}
            <button 
              className={`px-4 py-2 rounded ${
                markedQuestions.some(q => 
                  q['題號'] === currentQuestion['題號'] && 
                  q['考試標題'] === currentQuestion['考試標題'] && 
                  q['科目'] === currentQuestion['科目']
                )
                  ? 'bg-purple-500 text-white hover:bg-purple-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={markQuestion}
            >
              {markedQuestions.some(q => 
                q['題號'] === currentQuestion['題號'] && 
                q['考試標題'] === currentQuestion['考試標題'] && 
                q['科目'] === currentQuestion['科目']
              )
                ? '取消標記"不會"'
                : '標記為"不會"'}
            </button>
          
            {/* 筆記顯示/隱藏按鈕 */}
            <button 
              className={`px-4 py-2 rounded ${
                showNoteSection
                  ? 'bg-teal-500 text-white hover:bg-teal-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setShowNoteSection(!showNoteSection)}
            >
              {showNoteSection ? '隱藏筆記' : '顯示筆記'}
            </button>
          </div>
          
          {/* 標籤管理區域移到右側 */}
          <div className="flex items-center gap-2">
            {/* 標籤管理 */}
            <div className="inline-flex items-center gap-2">
              <input
                type="text"
                className="border p-1 rounded text-sm w-24"
                placeholder="新增標籤"
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTag()}
              />
              <button
                className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600"
                onClick={addTag}
              >
                +
              </button>
            </div>
            
            {/* 標籤搜尋 */}
            <div className="ml-2">
              <input
                type="text"
                className="border p-1 rounded text-sm w-48"
                placeholder="搜尋標籤"
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        {/* 筆記區域移到選項前面 - 如果顯示的話 */}
        {showNoteSection && (
          <div className="mb-4 pt-2 pb-4 border-t border-b">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">我的筆記：</h3>
              <button 
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                onClick={() => setShowNoteEditor(!showNoteEditor)}
              >
                {showNoteEditor ? '取消編輯' : '編輯筆記'}
              </button>
            </div>
            
            {showNoteEditor ? (
              <div className="mt-2">
                <textarea 
                  className="w-full p-2 border rounded min-h-[100px] text-left"
                  value={currentNote}
                  onChange={(e) => setCurrentNote(e.target.value)}
                  placeholder="在此輸入筆記..."
                ></textarea>
                <div className="mt-2 text-right">
                  <button 
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 text-sm"
                    onClick={saveNote}
                  >
                    保存筆記
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 rounded min-h-[50px] whitespace-pre-wrap text-left">
                {currentNote ? currentNote : <span className="text-gray-400">尚無筆記</span>}
              </div>
            )}
          </div>
        )}
        
        {/* 題目標籤顯示區 */}
        <div className="mb-4">
          {/* 題目標籤管理區 */}
          <div className="flex flex-wrap gap-1 mb-2">
            {(() => {
              const questionId = `${currentQuestion['考試標題']}_${currentQuestion['科目']}_${currentQuestion['題號']}`;
              const questionTags = tags[questionId] || [];
              return questionTags.length > 0 ? (
                <>
                  <span className="text-sm font-medium mr-1">標籤：</span>
                  {questionTags.map(tag => (
                    <span 
                      key={tag}
                      className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-200 mb-1"
                      onClick={() => removeTag(tag)}
                      title="點擊移除標籤"
                    >
                      {tag} ×
                    </span>
                  ))}
                </>
              ) : null;
            })()}
          </div>
          
          {/* 顯示篩選後的標籤 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {filteredTags.length > 0 && tagSearchQuery.trim() !== '' && (
              <>
                <span className="text-sm font-medium mr-1">符合的標籤：</span>
                {filteredTags.map(tag => (
                  <span 
                    key={tag}
                    className="inline-flex items-center bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-blue-200"
                    onClick={() => filterByTag(tag)}
                  >
                    {tag}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
        
        {currentQuestion['題型'] === '選擇題' ? (
          <div className="space-y-2">
            {['A', 'B', 'C', 'D'].map(option => (
              currentQuestion[`選項${option}`] && (
                <div 
                  key={option}
                  className={`p-3 rounded-lg cursor-pointer border ${
                    selectedAnswer === option 
                      ? showAnswer 
                        ? selectedAnswer === currentQuestion['答案'] 
                          ? 'bg-green-100 border-green-500' 
                          : 'bg-red-100 border-red-500'
                        : 'bg-blue-100 border-blue-500'
                      : showAnswer && option === currentQuestion['答案']
                        ? 'bg-green-100 border-green-500'
                        : 'hover:bg-gray-100'
                  }`}
                  onClick={() => handleOptionClick(option)}
                >
                  <div className="text-left">
                    <span className="font-bold mr-2">{option}.</span>
                    {currentQuestion[`選項${option}`]}
                  </div>
                </div>
              )
            ))}
          </div>
        ) : (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">申論題：</h3>
            <div className="mt-4">
              <button 
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2"
                onClick={() => setShowAnswer(!showAnswer)}
              >
                {showAnswer ? '隱藏答案' : '顯示答案'}
              </button>
            </div>
          </div>
        )}
        
        {showAnswer && currentQuestion['題型'] === '申論題' && (
          <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-semibold mb-2">參考答案：</h3>
            <p className="text-left whitespace-pre-line">{currentQuestion['答案']}</p>
          </div>
        )}
      </div>
      
      <div className="flex flex-col gap-4">
        {/* 第一行：導航按鈕（確認答案、上一題、下一題）放在最上方，靠右對齊 */}
        <div className="flex items-center justify-end bg-gray-100 p-3 rounded-lg">
          <div className="flex">
            {/* 確認答案按鈕 */}
            {currentQuestion['題型'] === '選擇題' && !showAnswer ? (
              <button 
                className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-blue-200 disabled:cursor-not-allowed mr-2"
                onClick={checkAnswer}
                disabled={!selectedAnswer}
              >
                確認答案
              </button>
            ) : null}

            {/* 上一題按鈕 */}
            <button 
              className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-indigo-200 disabled:cursor-not-allowed mr-2"
              onClick={prevQuestion}
              disabled={currentQuestionIndex === 0}
            >
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 010 1.414L9.414 10l3.293 3.293a1 1 01-1.414 1.414l-4-4a1 1 010-1.414l4-4a1 1 011.414 0z" clipRule="evenodd" />
                </svg>
                上一題
              </div>
            </button>

            {/* 下一題按鈕 */}
            <button 
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              onClick={nextQuestion}
            >
              <div className="flex items-center">
                下一題
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 010-1.414L10.586 10 7.293 6.707a1 1 011.414-1.414l4 4a1 1 010 1.414l-4 4a1 1 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>
        
        {/* 統計資訊與重新開始按鈕 */}
        <div className="flex flex-wrap gap-2 mb-2 justify-between">          
          {/* 統計資訊 */}
          <div>
            {stats.attempted > 0 && (
              <div className="text-sm mt-2">
                已答: {stats.attempted} | 正確: {stats.correct} | 錯誤: {stats.incorrect} | 
                正確率: {((stats.correct / stats.attempted) * 100).toFixed(2)}%
              </div>
            )}
          </div>
          
          {/* 重新開始按鈕 */}
          <button 
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            onClick={resetQuiz}
          >
            重新開始
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamReviewer;