// frontend/src/components/TakeQuiz/QuizInterface.js - 修复版本
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import Timer from "./Timer";
import QuestionNavigator from "./QuestionNavigator";
import "./TakeQuiz.css";

const QuizInterface = ({ quizId, onComplete, onBack }) => {
  const { apiCall, user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeSpent, setTimeSpent] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (quizId) {
      loadQuiz();
      // 自动保存答案的定时器
      const saveInterval = setInterval(saveAnswersToLocal, 30000); // 30秒保存一次
      return () => clearInterval(saveInterval);
    }
  }, [quizId]);

  useEffect(() => {
    // 计时器
    const timer = setInterval(() => {
      setTimeSpent((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadQuiz = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiCall(`/quiz/detail?id=${quizId}`);
      if (response.success) {
        console.log("加载的测验数据:", response.data);
        setQuiz(response.data);
        // 加载本地保存的答案
        loadAnswersFromLocal(response.data.id || response.data._id);
      } else {
        setError(response.error || "加载测验失败");
      }
    } catch (error) {
      console.error("加载测验失败:", error);
      setError("网络错误，无法加载测验");
    } finally {
      setLoading(false);
    }
  };

  // 本地存储答案
  const saveAnswersToLocal = () => {
    if (quiz) {
      const quizIdentifier = quiz.id || quiz._id;
      localStorage.setItem(
        `quiz_${quizIdentifier}_answers`,
        JSON.stringify(answers)
      );
      localStorage.setItem(`quiz_${quizIdentifier}_time`, timeSpent.toString());
    }
  };

  const loadAnswersFromLocal = (quizIdentifier) => {
    const savedAnswers = localStorage.getItem(`quiz_${quizIdentifier}_answers`);
    const savedTime = localStorage.getItem(`quiz_${quizIdentifier}_time`);

    if (savedAnswers) {
      try {
        setAnswers(JSON.parse(savedAnswers));
      } catch (e) {
        console.error("解析本地答案失败:", e);
      }
    }
    if (savedTime) {
      setTimeSpent(parseInt(savedTime) || 0);
    }
  };

  const clearLocalStorage = () => {
    if (quiz) {
      const quizIdentifier = quiz.id || quiz._id;
      localStorage.removeItem(`quiz_${quizIdentifier}_answers`);
      localStorage.removeItem(`quiz_${quizIdentifier}_time`);
    }
  };

  // 更新答案
  const updateAnswer = (questionIndex, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  // 导航到题目
  const navigateToQuestion = (index) => {
    if (index >= 0 && index < quiz.questions.length) {
      setCurrentQuestionIndex(index);
    }
  };

  // 提交测验
  const submitQuiz = async () => {
    setLoading(true);
    try {
      // 准备提交数据
      const submissionData = quiz.questions.map((question, index) => {
        const userAnswer = answers[index] || "";
        return {
          questionIndex: index,
          questionType: question.type,
          userAnswer: userAnswer,
          correctAnswer: question.correctAnswer,
          points: question.points || 1,
          timeSpentOnQuestion: 0, // 暂时设为0，后续可以添加单题计时
        };
      });

      const payload = {
        quiz: quiz.id || quiz._id,
        user: user.id,
        answers: submissionData,
        timeSpent,
        totalQuestions: quiz.questions.length,
      };

      console.log("提交数据:", payload);

      const response = await apiCall("/quiz/submit", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.success) {
        setResult(response.data);
        setSubmitted(true);
        clearLocalStorage(); // 清除本地保存
      } else {
        setError(response.error || "提交失败");
      }
    } catch (error) {
      console.error("提交失败:", error);
      setError("网络错误，提交失败");
    } finally {
      setLoading(false);
      setShowSubmitConfirm(false);
    }
  };

  // 检查是否所有题目都已回答
  const getAnsweredCount = () => {
    return Object.keys(answers).length;
  };

  const getUnansweredQuestions = () => {
    return quiz.questions
      .map((_, index) => index)
      .filter((index) => !answers.hasOwnProperty(index));
  };

  // 时间到了自动提交
  const handleTimeUp = () => {
    if (!submitted) {
      submitQuiz();
    }
  };

  if (loading && !quiz) {
    return (
      <div className="quiz-loading">
        <div className="loading-spinner"></div>
        <p>加载测验中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-error">
        <h3>❌ {error}</h3>
        <button onClick={onBack} className="btn btn-primary">
          返回测验列表
        </button>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="quiz-error">
        <h3>测验不存在或已关闭</h3>
        <button onClick={onBack} className="btn btn-primary">
          返回测验列表
        </button>
      </div>
    );
  }

  // 已提交状态 - 显示结果
  if (submitted && result) {
    return <QuizResult result={result} quiz={quiz} onBack={onBack} />;
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];

  return (
    <div className="quiz-interface">
      {/* 头部信息 */}
      <div className="quiz-header">
        <div className="quiz-info">
          <button onClick={onBack} className="btn btn-secondary back-btn">
            ⬅️ 返回
          </button>
          <div className="quiz-header-content">
            <h1>{quiz.title}</h1>
            <div className="quiz-meta">
              <span>👤 {user?.name}</span>
              <span>📝 {quiz.questions.length} 题</span>
              <span>✅ 已答 {getAnsweredCount()}</span>
            </div>
          </div>
        </div>

        {quiz.settings?.timeLimit > 0 && (
          <Timer
            totalMinutes={quiz.settings.timeLimit}
            onTimeUp={handleTimeUp}
          />
        )}
      </div>

      <div className="quiz-body">
        {/* 题目导航器 */}
        <QuestionNavigator
          questions={quiz.questions}
          currentIndex={currentQuestionIndex}
          answers={answers}
          onNavigate={navigateToQuestion}
        />

        {/* 主答题区域 */}
        <div className="quiz-content">
          <div className="question-container">
            <div className="question-header">
              <span className="question-number">
                第 {currentQuestionIndex + 1} 题 / 共 {quiz.questions.length} 题
              </span>
              <span className="question-type">
                {currentQuestion.type === "single" && "🔘 单选题"}
                {currentQuestion.type === "multiple" && "☑️ 多选题"}
                {currentQuestion.type === "boolean" && "✅ 判断题"}
                {currentQuestion.type === "essay" && "📝 解答题"}
              </span>
            </div>

            <div className="question-content">
              <h3 className="question-text">{currentQuestion.question}</h3>

              <div className="answer-options">
                {currentQuestion.type === "boolean" ? (
                  <div className="boolean-options">
                    <label
                      className={`option-label ${
                        answers[currentQuestionIndex] === "true"
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question_${currentQuestionIndex}`}
                        value="true"
                        checked={answers[currentQuestionIndex] === "true"}
                        onChange={(e) =>
                          updateAnswer(currentQuestionIndex, e.target.value)
                        }
                      />
                      <span className="option-text3">✅ 正确</span>
                    </label>
                    <label
                      className={`option-label ${
                        answers[currentQuestionIndex] === "false"
                          ? "selected"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question_${currentQuestionIndex}`}
                        value="false"
                        checked={answers[currentQuestionIndex] === "false"}
                        onChange={(e) =>
                          updateAnswer(currentQuestionIndex, e.target.value)
                        }
                      />
                      <span className="option-text3">❌ 错误</span>
                    </label>
                  </div>
                ) : currentQuestion.type === "essay" ? (
                  <div className="essay-answer-area">
                    <div className="essay-limits">
                      {currentQuestion.essayConfig && (
                        <span>
                          字数要求：{currentQuestion.essayConfig.minWords || 50}{" "}
                          - {currentQuestion.essayConfig.maxWords || 500} 字
                        </span>
                      )}
                    </div>
                    <textarea
                      value={answers[currentQuestionIndex] || ""}
                      onChange={(e) =>
                        updateAnswer(currentQuestionIndex, e.target.value)
                      }
                      className="essay-textarea"
                      placeholder="请在此输入您的答案..."
                      rows="8"
                    />
                    <div className="essay-info">
                      <span>
                        当前字数: {(answers[currentQuestionIndex] || "").length}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="choice-options">
                    {currentQuestion.options.map((option, optionIndex) => {
                      const optionValue = option;
                      const isSelected =
                        currentQuestion.type === "single"
                          ? answers[currentQuestionIndex] === optionValue
                          : answers[currentQuestionIndex]
                              ?.split(",")
                              .includes(optionValue);

                      return (
                        <label
                          key={optionIndex}
                          className={`option-label ${
                            isSelected ? "selected" : ""
                          }`}
                        >
                          <input
                            type={
                              currentQuestion.type === "single"
                                ? "radio"
                                : "checkbox"
                            }
                            name={`question_${currentQuestionIndex}`}
                            value={optionValue}
                            checked={isSelected}
                            onChange={(e) => {
                              if (currentQuestion.type === "single") {
                                updateAnswer(
                                  currentQuestionIndex,
                                  e.target.value
                                );
                              } else {
                                const currentAnswers =
                                  answers[currentQuestionIndex]
                                    ?.split(",")
                                    .filter((a) => a) || [];
                                const newAnswers = e.target.checked
                                  ? [...currentAnswers, optionValue]
                                  : currentAnswers.filter(
                                      (a) => a !== optionValue
                                    );
                                updateAnswer(
                                  currentQuestionIndex,
                                  newAnswers.join(",")
                                );
                              }
                            }}
                          />
                          <span className="option-letter">
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="option-text2">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 导航按钮 */}
          <div className="question-navigation">
            <button
              onClick={() => navigateToQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="nav-btn prev-btn"
            >
              ⬅️ 上一题
            </button>

            <button
              onClick={() => navigateToQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex === quiz.questions.length - 1}
              className="nav-btn next-btn"
            >
              下一题 ➡️
            </button>
          </div>
        </div>
      </div>

      {/* 底部提交区域 */}
      <div className="quiz-footer">
        <div className="footer-info">
          <span>
            ⏱️ 已用时: {Math.floor(timeSpent / 60)}:
            {(timeSpent % 60).toString().padStart(2, "0")}
          </span>
          <span>
            📝 进度: {getAnsweredCount()}/{quiz.questions.length}
          </span>
        </div>

        <button
          onClick={() => setShowSubmitConfirm(true)}
          className="submit-btn"
          disabled={loading}
        >
          {loading ? "提交中..." : "提交测验"}
        </button>
      </div>

      {/* 提交确认对话框 */}
      {showSubmitConfirm && (
        <SubmitConfirmDialog
          answeredCount={getAnsweredCount()}
          totalCount={quiz.questions.length}
          unansweredQuestions={getUnansweredQuestions()}
          onConfirm={submitQuiz}
          onCancel={() => setShowSubmitConfirm(false)}
        />
      )}
    </div>
  );
};

// 提交确认对话框
const SubmitConfirmDialog = ({
  answeredCount,
  totalCount,
  unansweredQuestions,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="dialog-overlay">
      <div className="submit-dialog">
        <h3>确认提交测验</h3>

        <div className="submit-summary">
          <div className="summary-item">
            <span>📝 总题数:</span>
            <span>{totalCount}</span>
          </div>
          <div className="summary-item">
            <span>✅ 已答题:</span>
            <span>{answeredCount}</span>
          </div>
          {unansweredQuestions.length > 0 && (
            <div className="summary-item warning">
              <span>❓ 未答题:</span>
              <span>
                第 {unansweredQuestions.map((i) => i + 1).join(", ")} 题
              </span>
            </div>
          )}
        </div>

        {unansweredQuestions.length > 0 && (
          <div className="warning-message">
            ⚠️ 还有 {unansweredQuestions.length} 题未作答，提交后将无法修改
          </div>
        )}

        <div className="dialog-actions">
          <button onClick={onCancel} className="btn btn-secondary">
            取消
          </button>
          <button onClick={onConfirm} className="btn btn-primary">
            确认提交
          </button>
        </div>
      </div>
    </div>
  );
};

// 测验结果组件
const QuizResult = ({ result, quiz, onBack }) => {
  const getScoreLevel = (score) => {
    if (score >= 90)
      return { level: "excellent", text: "优秀", color: "#52c41a" };
    if (score >= 80) return { level: "good", text: "良好", color: "#1890ff" };
    if (score >= 70)
      return { level: "average", text: "及格", color: "#faad14" };
    return { level: "poor", text: "需要加强", color: "#ff4d4f" };
  };

  const scoreLevel = getScoreLevel(result.score);

  return (
    <div className="quiz-result">
      <div className="result-header">
        <h1>🎉 测验完成</h1>
        <p>{quiz.title}</p>
      </div>

      <div className="result-content">
        <div className="score-display">
          <div
            className="score-circle"
            style={{ borderColor: scoreLevel.color }}
          >
            <span className="score-number" style={{ color: scoreLevel.color }}>
              {result.score}
            </span>
            <span className="score-unit">分</span>
          </div>
          <div className="score-level" style={{ color: scoreLevel.color }}>
            {scoreLevel.text}
          </div>
        </div>

        <div className="result-stats">
          <div className="stat-item">
            <span className="stat-label">正确题数</span>
            <span className="stat-value">
              {result.correctCount || 0}/{result.totalQuestions}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">用时</span>
            <span className="stat-value">
              {Math.floor((result.timeSpent || 0) / 60)}:
              {((result.timeSpent || 0) % 60).toString().padStart(2, "0")}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">正确率</span>
            <span className="stat-value">
              {result.totalQuestions > 0
                ? ((result.correctCount / result.totalQuestions) * 100).toFixed(
                    1
                  )
                : 0}
              %
            </span>
          </div>
        </div>

        <div className="result-actions">
          <button onClick={onBack} className="btn btn-primary">
            返回测验列表
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuizInterface;
