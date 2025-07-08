// frontend/src/components/Grading/GradingInterface.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Grading.css';

const GradingInterface = () => {
  const { apiCall, user } = useAuth();
  const [pendingList, setPendingList] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [gradingDetail, setGradingDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gradingStats, setGradingStats] = useState(null);
  const [message, setMessage] = useState('');
  const [currentView, setCurrentView] = useState('pending'); // 'pending', 'grading', 'stats'

  useEffect(() => {
    loadPendingList();
    loadGradingStats();
  }, []);

  const loadPendingList = async () => {
    try {
      console.log('🔍 开始加载待批改列表...');
      setLoading(true);
      setMessage('');
      
      const response = await apiCall('/grading/pending');
      console.log('📋 待批改列表响应:', response);
      
      if (response.success) {
        setPendingList(response.data.pendingAnswers || []);
        console.log('✅ 成功加载待批改列表，数量:', response.data.pendingAnswers?.length || 0);
      } else {
        console.error('❌ 加载待批改列表失败:', response.error);
        setMessage('加载待批改列表失败: ' + (response.error || ''));
      }
    } catch (error) {
      console.error('💥 加载待批改列表异常:', error);
      setMessage('加载待批改列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadGradingStats = async () => {
    try {
      console.log('📊 开始加载批改统计...');
      const response = await apiCall('/grading/stats');
      console.log('📈 批改统计响应:', response);
      
      if (response.success) {
        setGradingStats(response.data);
        console.log('✅ 成功加载批改统计');
      } else {
        console.error('❌ 加载批改统计失败:', response.error);
      }
    } catch (error) {
      console.error('💥 加载批改统计异常:', error);
    }
  };

  const loadGradingDetail = async (answerId) => {
    try {
      console.log('=== 🎯 开始批改流程 ===');
      console.log('📝 answerId:', answerId);
      console.log('👤 当前用户:', user);
      console.log('📱 当前视图:', currentView);
      
      if (!answerId) {
        console.error('❌ answerId 为空');
        setMessage('无效的答案ID');
        return;
      }

      setLoading(true);
      setMessage('');
      
      const response = await apiCall(`/grading/detail/${answerId}`);
      console.log('📖 批改详情响应:', response);
      
      if (response.success) {
        console.log('✅ 成功获取批改详情');
        console.log('📋 题目数量:', response.data.questions?.length || 0);
        
        setGradingDetail(response.data);
        setSelectedAnswer(answerId);
        setCurrentView('grading');
        
        console.log('🔄 切换到批改视图');
      } else {
        console.error('❌ 获取批改详情失败:', response.error);
        setMessage(response.error || '加载批改详情失败');
      }
    } catch (error) {
      console.error('💥 加载批改详情异常:', error);
      setMessage('加载批改详情失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const gradeEssayQuestion = async (questionIndex, score, comment) => {
    try {
      console.log('✏️ 开始批改解答题:', { questionIndex, score, comment });
      
      if (!selectedAnswer) {
        console.error('❌ 没有选中的答案');
        setMessage('请先选择要批改的答案');
        return;
      }

      const response = await apiCall('/grading/grade-essay', {
        method: 'POST',
        body: JSON.stringify({
          answerId: selectedAnswer,
          questionIndex,
          score,
          comment
        })
      });

      console.log('📝 批改响应:', response);

      if (response.success) {
        setMessage('批改成功');
        console.log('✅ 批改成功，重新加载详情');
        // 重新加载详情
        await loadGradingDetail(selectedAnswer);
        // 刷新待批改列表
        await loadPendingList();
      } else {
        console.error('❌ 批改失败:', response.error);
        setMessage(response.error || '批改失败');
      }
    } catch (error) {
      console.error('💥 批改异常:', error);
      setMessage('批改失败: ' + error.message);
    }
  };

  const renderStatsView = () => {
    if (!gradingStats) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载统计数据中...</p>
        </div>
      );
    }

    return (
      <div className="grading-stats">
        <h2>📊 批改统计</h2>
        
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-number">{gradingStats.overview.totalSubmissions || 0}</div>
            <div className="stat-label">总提交数</div>
          </div>
          <div className="stat-card urgent">
            <div className="stat-number">{gradingStats.overview.pendingGrading || 0}</div>
            <div className="stat-label">待批改</div>
          </div>
          <div className="stat-card success">
            <div className="stat-number">{gradingStats.overview.fullyGraded || 0}</div>
            <div className="stat-label">已完成</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {gradingStats.overview.averageScore ? gradingStats.overview.averageScore.toFixed(1) : 0}
            </div>
            <div className="stat-label">平均分</div>
          </div>
        </div>

        <div className="quiz-stats-table">
          <h3>各测验批改情况</h3>
          <table>
            <thead>
              <tr>
                <th>测验名称</th>
                <th>总提交</th>
                <th>待批改</th>
                <th>平均分</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {(gradingStats.quizStats || []).map((quiz, index) => (
                <tr key={index}>
                  <td>{quiz.quizTitle}</td>
                  <td>{quiz.submissions}</td>
                  <td className={quiz.pending > 0 ? 'urgent' : ''}>{quiz.pending}</td>
                  <td>{quiz.averageScore}</td>
                  <td>
                    {quiz.pending > 0 && (
                      <button 
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setCurrentView('pending');
                          loadPendingList();
                        }}
                      >
                        去批改
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPendingView = () => (
    <div className="pending-grading">
      <div className="grading-header">
        <h2>📝 待批改列表</h2>
        <button 
          onClick={() => {
            console.log('🔄 手动刷新待批改列表');
            loadPendingList();
          }}
          className="btn btn-secondary"
          disabled={loading}
        >
          🔄 刷新
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      ) : pendingList.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>没有待批改的答案</h3>
          <p>所有解答题都已批改完成</p>
        </div>
      ) : (
        <div className="pending-list">
          {pendingList.map((item) => (
            <div key={item._id} className="pending-item">
              <div className="pending-info">
                <h4 className="quiz-title">{item.quizTitle}</h4>
                <div className="student-info">
                  <span className="student-name">👤 {item.studentName}</span>
                  <span className="student-email">{item.studentEmail}</span>
                </div>
                <div className="grading-meta">
                  <span className="submit-time">
                    📅 提交时间: {new Date(item.submittedAt).toLocaleString()}
                  </span>
                  <span className="objective-score">
                    📊 客观题: {item.objectiveScore || 0}分
                  </span>
                </div>
              </div>
              
              <div className="grading-progress">
                <div className="progress-info">
                  <span>解答题批改进度</span>
                  <span>{item.gradedEssayCount || 0}/{item.essayQuestionCount || 0}</span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${item.essayQuestionCount > 0 ? ((item.gradedEssayCount || 0) / item.essayQuestionCount) * 100 : 0}%` 
                    }}
                  ></div>
                </div>
              </div>

              <div className="pending-actions">
                <button 
                  onClick={() => {
                    console.log('🎯 点击开始批改按钮');
                    console.log('📝 item._id:', item._id);
                    console.log('📋 item 数据:', item);
                    loadGradingDetail(item._id);
                  }}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? '加载中...' : '开始批改'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGradingView = () => {
    if (!gradingDetail) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载批改详情中...</p>
        </div>
      );
    }

    console.log('🎨 渲染批改视图:', gradingDetail);

    return (
      <div className="grading-detail">
        <div className="grading-header">
          <button 
            onClick={() => {
              console.log('⬅️ 返回待批改列表');
              setCurrentView('pending');
              setSelectedAnswer(null);
              setGradingDetail(null);
            }}
            className="btn btn-secondary"
          >
            ⬅️ 返回列表
          </button>
          <div className="grading-title">
            <h2>{gradingDetail.quiz.title}</h2>
            <p>学生: {gradingDetail.student.name} ({gradingDetail.student.email})</p>
          </div>
        </div>

        <div className="grading-summary">
          <div className="summary-item">
            <span>提交时间</span>
            <span>{new Date(gradingDetail.submittedAt).toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span>答题用时</span>
            <span>{Math.floor((gradingDetail.timeSpent || 0) / 60)}分{(gradingDetail.timeSpent || 0) % 60}秒</span>
          </div>
          <div className="summary-item">
            <span>客观题得分</span>
            <span>{gradingDetail.objectiveScore || 0}分</span>
          </div>
          <div className="summary-item">
            <span>批改进度</span>
            <span>{gradingDetail.gradingProgress || 0}%</span>
          </div>
        </div>

        <div className="questions-grading">
          {(gradingDetail.questions || []).map((question, index) => (
            <QuestionGradingItem
              key={index}
              question={question}
              onGrade={(score, comment) => gradeEssayQuestion(index, score, comment)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grading-interface">
      {/* 导航栏 */}
      <div className="grading-nav">
        <button 
          className={`nav-btn ${currentView === 'pending' ? 'active' : ''}`}
          onClick={() => {
            console.log('🔄 切换到待批改视图');
            setCurrentView('pending');
          }}
        >
          📝 待批改
          {gradingStats?.overview.pendingGrading > 0 && (
            <span className="badge">{gradingStats.overview.pendingGrading}</span>
          )}
        </button>
        <button 
          className={`nav-btn ${currentView === 'stats' ? 'active' : ''}`}
          onClick={() => {
            console.log('🔄 切换到统计视图');
            setCurrentView('stats');
          }}
        >
          📊 统计
        </button>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className={`message ${message.includes('成功') ? 'success' : 'error'}`}>
          {message}
          <button onClick={() => setMessage('')} className="message-close">×</button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="grading-content">
        {currentView === 'pending' && renderPendingView()}
        {currentView === 'grading' && renderGradingView()}
        {currentView === 'stats' && renderStatsView()}
      </div>
    </div>
  );
};

// 题目批改组件
const QuestionGradingItem = ({ question, onGrade }) => {
  const [score, setScore] = useState(question.essay?.grading?.teacherScore || 0);
  const [comment, setComment] = useState(question.essay?.grading?.teacherComment || '');
  const [isGrading, setIsGrading] = useState(false);

  console.log('🎯 渲染题目批改组件:', question);

  const handleGrade = async () => {
    if (score < 0 || score > question.points) {
      alert(`分数必须在0-${question.points}之间`);
      return;
    }

    console.log('✏️ 提交批改:', { score, comment });
    setIsGrading(true);
    try {
      await onGrade(score, comment);
    } finally {
      setIsGrading(false);
    }
  };

  if (question.questionType !== 'essay') {
    // 客观题显示
    return (
      <div className="objective-question">
        <div className="question-header">
          <span className="question-number">第{question.questionIndex + 1}题</span>
          <span className="question-type">
            {question.questionType === 'single' ? '单选题' : 
             question.questionType === 'multiple' ? '多选题' : '判断题'}
          </span>
          <span className={`auto-score ${question.objective?.isCorrect ? 'correct' : 'incorrect'}`}>
            {question.objective?.isCorrect ? '✅ 正确' : '❌ 错误'}
            ({question.objective?.earnedPoints || 0}/{question.points}分)
          </span>
        </div>
        
        <div className="question-content">
          <p className="question-text">{question.questionText}</p>
          <div className="answer-comparison">
            <div className="student-answer">
              <strong>学生答案:</strong> {question.userAnswer || '未作答'}
            </div>
            <div className="correct-answer">
              <strong>正确答案:</strong> {question.objective?.correctAnswer}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 解答题批改
  const isGraded = question.essay?.grading?.gradingStatus === 'graded';
  const wordCount = question.userAnswer ? question.userAnswer.length : 0;

  return (
    <div className="essay-question">
      <div className="question-header">
        <span className="question-number">第{question.questionIndex + 1}题</span>
        <span className="question-type">📝 解答题</span>
        <span className="question-points">({question.points}分)</span>
        <span className={`grading-status ${isGraded ? 'graded' : 'pending'}`}>
          {isGraded ? '✅ 已批改' : '⏳ 待批改'}
        </span>
      </div>

      <div className="question-content">
        <div className="question-text">
          <h4>题目:</h4>
          <p>{question.questionText}</p>
        </div>

        {question.essay?.config?.rubric && (
          <div className="grading-rubric">
            <h4>评分标准:</h4>
            <p>{question.essay.config.rubric}</p>
          </div>
        )}

        <div className="student-answer-section">
          <div className="answer-header">
            <h4>学生答案:</h4>
            <span className="word-count">
              字数: {wordCount} 
              {question.essay?.config && (
                <span> (要求: {question.essay.config.minWords}-{question.essay.config.maxWords}字)</span>
              )}
            </span>
          </div>
          <div className="student-answer-content">
            {question.userAnswer ? (
              <div className="answer-text">{question.userAnswer}</div>
            ) : (
              <div className="no-answer">学生未作答</div>
            )}
          </div>

          
        </div>

        {question.essay?.config?.sampleAnswer && (
          <div className="sample-answer">
            <h4>参考答案:</h4>
            <div className="sample-content">{question.essay.config.sampleAnswer}</div>
          </div>
        )}

        <div className="grading-section">
          <div className="score-input">
            <label>分数:</label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(parseFloat(e.target.value) || 0)}
              min="0"
              max={question.points}
              step="0.5"
              disabled={isGrading}
            />
            <span>/ {question.points}分</span>
          </div>

          <div className="comment-input">
            <label>评语:</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请输入评语和建议..."
              rows="3"
              disabled={isGrading}
            />
          </div>

          <button 
            onClick={handleGrade}
            className={`grade-btn ${isGraded ? 'update' : 'grade'}`}
            disabled={isGrading}
          >
            {isGrading ? '批改中...' : isGraded ? '更新批改' : '确定批改'}
          </button>

          {isGraded && question.essay?.grading?.gradedAt && (
            <div className="grading-info">
              <p>批改时间: {new Date(question.essay.grading.gradedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradingInterface;