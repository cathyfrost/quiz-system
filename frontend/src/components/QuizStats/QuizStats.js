// frontend/src/components/QuizStats/QuizStats.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import "./QuizStats.css";

const QuizStats = ({ quizId, quizTitle, onBack }) => {
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [error, setError] = useState("");
  const [expandedStudents, setExpandedStudents] = useState(new Set());

  useEffect(() => {
    if (quizId) {
      loadQuizStats();
    }
  }, [quizId]);

  const loadQuizStats = async () => {
    setLoading(true);
    setError("");
    try {
      // 获取测验统计数据
      const statsResponse = await apiCall(`/quiz/stats/${quizId}`);
      // 获取测验详细答案数据
      const answersResponse = await apiCall(`/quiz/answers/${quizId}`);

      if (statsResponse.success && answersResponse.success) {
        setStats(statsResponse.data);
        setAnswers(answersResponse.data);
      } else {
        setError(
          statsResponse.error || answersResponse.error || "加载统计数据失败"
        );
      }
    } catch (error) {
      console.error("加载统计数据失败:", error);
      setError("网络错误，无法加载统计数据");
    } finally {
      setLoading(false);
    }
  };

  const calculateQuestionStats = (questionIndex) => {
    if (!answers || answers.length === 0) return null;

    const questionAnswers = answers
      .map((answer) =>
        answer.answers.find((a) => a.questionIndex === questionIndex)
      )
      .filter(Boolean);

    if (questionAnswers.length === 0) return null;

    const firstQuestion = questionAnswers[0];
    const isObjective = ["single", "multiple", "boolean"].includes(
      firstQuestion.questionType
    );

    if (isObjective) {
      // 客观题统计
      const correctCount = questionAnswers.filter((a) => a.isCorrect).length;
      const totalCount = questionAnswers.length;
      const correctRate =
        totalCount > 0 ? ((correctCount / totalCount) * 100).toFixed(1) : 0;

      // 选项分布统计
      const optionStats = {};
      questionAnswers.forEach((answer) => {
        if (answer.userAnswer) {
          if (firstQuestion.questionType === "multiple") {
            // 多选题
            const options = answer.userAnswer.split(",");
            options.forEach((option) => {
              optionStats[option] = (optionStats[option] || 0) + 1;
            });
          } else {
            // 单选题和判断题
            optionStats[answer.userAnswer] =
              (optionStats[answer.userAnswer] || 0) + 1;
          }
        }
      });

      return {
        type: "objective",
        correctCount,
        totalCount,
        correctRate,
        optionStats,
        questionType: firstQuestion.questionType,
      };
    } else {
      // 解答题统计
      const gradedCount = questionAnswers.filter(
        (a) => a.essayGrading && a.essayGrading.gradingStatus === "graded"
      ).length;
      const totalCount = questionAnswers.length;
      const averageScore =
        gradedCount > 0
          ? questionAnswers
              .filter(
                (a) =>
                  a.essayGrading && a.essayGrading.gradingStatus === "graded"
              )
              .reduce((sum, a) => sum + (a.essayGrading.teacherScore || 0), 0) /
            gradedCount
          : 0;

      return {
        type: "essay",
        gradedCount,
        totalCount,
        averageScore: averageScore.toFixed(1),
        pendingCount: totalCount - gradedCount,
      };
    }
  };

  const getScoreDistribution = () => {
    if (!answers || answers.length === 0) return {};

    const distribution = {
      excellent: 0, // 90-100
      good: 0, // 80-89
      average: 0, // 70-79
      poor: 0, // <70
    };

    answers.forEach((answer) => {
      const score = answer.score || 0;
      if (score >= 90) distribution.excellent++;
      else if (score >= 80) distribution.good++;
      else if (score >= 70) distribution.average++;
      else distribution.poor++;
    });

    return distribution;
  };

  // 添加切换展开状态的函数
  const toggleStudentExpansion = (answerId) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(answerId)) {
      newExpanded.delete(answerId);
    } else {
      newExpanded.add(answerId);
    }
    setExpandedStudents(newExpanded);
  };

  if (loading) {
    return (
      <div className="quiz-stats-loading">
        <div className="loading-spinner"></div>
        <p>加载统计数据中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-stats-error">
        <h3>❌ {error}</h3>
        <button onClick={onBack} className="btn btn-primary">
          返回测验列表
        </button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="quiz-stats-error">
        <h3>📊 暂无统计数据</h3>
        <p>还没有学生参与此测验</p>
        <button onClick={onBack} className="btn btn-primary">
          返回测验列表
        </button>
      </div>
    );
  }

  const scoreDistribution = getScoreDistribution();

  return (
    <div className="quiz-stats-container">
      {/* 头部 */}
      <div className="stats-header">
        <div className="stats-header-content">
          <button onClick={onBack} className="btn btn-secondary back-btn">
            ⬅️ 返回
          </button>
          <div className="stats-title-section">
            <h1>📊 测验统计</h1>
            <h2>{quizTitle}</h2>
          </div>
        </div>
        <button onClick={loadQuizStats} className="btn btn-primary">
          🔄 刷新数据
        </button>
      </div>

      {/* 概览统计 */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-number">{stats.totalSubmissions || 0}</div>
          <div className="stat-label">总参与人数</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.averageScore || 0}</div>
          <div className="stat-label">平均分数</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.questionCount || 0}</div>
          <div className="stat-label">题目数量</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">
            {stats.completionRate ? `${stats.completionRate}%` : "0%"}
          </div>
          <div className="stat-label">完成率</div>
        </div>
      </div>

      {/* 成绩分布 */}
      <div className="stats-section">
        <h3>🎯 成绩分布</h3>
        <div className="score-distribution">
          <div className="distribution-chart">
            <div className="distribution-bar">
              <div
                className="bar-segment excellent"
                style={{
                  width: `${
                    stats.totalSubmissions > 0
                      ? (scoreDistribution.excellent / stats.totalSubmissions) *
                        100
                      : 0
                  }%`,
                }}
              ></div>
              <div
                className="bar-segment good"
                style={{
                  width: `${
                    stats.totalSubmissions > 0
                      ? (scoreDistribution.good / stats.totalSubmissions) * 100
                      : 0
                  }%`,
                }}
              ></div>
              <div
                className="bar-segment average"
                style={{
                  width: `${
                    stats.totalSubmissions > 0
                      ? (scoreDistribution.average / stats.totalSubmissions) *
                        100
                      : 0
                  }%`,
                }}
              ></div>
              <div
                className="bar-segment poor"
                style={{
                  width: `${
                    stats.totalSubmissions > 0
                      ? (scoreDistribution.poor / stats.totalSubmissions) * 100
                      : 0
                  }%`,
                }}
              ></div>
            </div>
            <div className="distribution-legend">
              <div className="legend-item">
                <span className="legend-color excellent"></span>
                <span>优秀(90-100): {scoreDistribution.excellent}人</span>
              </div>
              <div className="legend-item">
                <span className="legend-color good"></span>
                <span>良好(80-89): {scoreDistribution.good}人</span>
              </div>
              <div className="legend-item">
                <span className="legend-color average"></span>
                <span>及格(70-79): {scoreDistribution.average}人</span>
              </div>
              <div className="legend-item">
                <span className="legend-color poor"></span>
                <span>待提高(0-69): {scoreDistribution.poor}人</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 题目详细统计 */}
      <div className="stats-section">
        <h3>📝 题目详细统计</h3>
        <div className="questions-stats">
          {stats.questions &&
            stats.questions.map((question, index) => {
              const questionStat = calculateQuestionStats(index);
              if (!questionStat) return null;

              return (
                <div key={index} className="question-stat-card">
                  <div className="question-stat-header">
                    <span className="question-number">第 {index + 1} 题</span>
                    <span className={`question-type ${question.type}`}>
                      {question.type === "single" && "🔘 单选题"}
                      {question.type === "multiple" && "☑️ 多选题"}
                      {question.type === "boolean" && "✅ 判断题"}
                      {question.type === "essay" && "📝 解答题"}
                    </span>
                  </div>

                  <div className="question-text">{question.question}</div>

                  {questionStat.type === "objective" ? (
                    <div className="objective-stats">
                      <div className="stats-summary">
                        <div className="summary-item">
                          <span className="summary-label">正确率:</span>
                          <span
                            className={`summary-value ${
                              questionStat.correctRate >= 80
                                ? "good"
                                : questionStat.correctRate >= 60
                                ? "average"
                                : "poor"
                            }`}
                          >
                            {questionStat.correctRate}%
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">答对人数:</span>
                          <span className="summary-value">
                            {questionStat.correctCount}/
                            {questionStat.totalCount}
                          </span>
                        </div>
                      </div>

                      <div className="stats-option-container">
                        <h4>选项分布:</h4>
                        {Object.entries(questionStat.optionStats).map(
                          ([option, count]) => {
                            const percentage = (
                              (count / questionStat.totalCount) *
                              100
                            ).toFixed(1);
                            return (
                              <div key={option} className="stats-option-item">
                                <span className="stats-option-label">
                                  {option}:
                                </span>
                                <div className="stats-option-bar">
                                  <div
                                    className="stats-option-fill"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                  <span className="stats-option-text">
                                    {count}人 ({percentage}%)
                                  </span>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="essay-stats">
                      <div className="stats-summary">
                        <div className="summary-item">
                          <span className="summary-label">已批改:</span>
                          <span className="summary-value">
                            {questionStat.gradedCount}/{questionStat.totalCount}
                          </span>
                        </div>
                        <div className="summary-item">
                          <span className="summary-label">平均分:</span>
                          <span className="summary-value">
                            {questionStat.averageScore}分
                          </span>
                        </div>
                        {questionStat.pendingCount > 0 && (
                          <div className="summary-item">
                            <span className="summary-label">待批改:</span>
                            <span className="summary-value pending">
                              {questionStat.pendingCount}份
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <div className="students-list">
        {answers.map((answer, index) => (
          <div key={answer._id || index} className="student-item">
            <div
              className="student-header"
              onClick={() => toggleStudentExpansion(answer._id)}
            >
              <div className="student-info">
                <span className="student-name">
                  {answer.user?.name || "匿名用户"}
                </span>
                <span className="student-email">
                  {answer.user?.email || ""}
                </span>
              </div>
              <div className="student-stats">
                <span className="student-score">{answer.score || 0}分</span>
                <span className="student-time">
                  用时: {Math.floor((answer.timeSpent || 0) / 60)}:
                  {((answer.timeSpent || 0) % 60).toString().padStart(2, "0")}
                </span>
                <span className={`student-status ${answer.status}`}>
                  {answer.status === "graded"
                    ? "✅ 已完成"
                    : answer.status === "partial_graded"
                    ? "⏳ 批改中"
                    : "📝 已提交"}
                </span>
                <button className="expand-btn">
                  {expandedStudents.has(answer._id) ? "🔼 收起" : "🔽 查看答案"}
                </button>
              </div>
            </div>

            {expandedStudents.has(answer._id) && (
              <div className="student-answers">
                {answer.answers.map((studentAnswer, qIndex) => {
                  const question = stats.questions[qIndex];
                  return (
                    <div key={qIndex} className="answer-detail">
                      <div className="answer-question">
                        <span className="answer-q-number">
                          第{qIndex + 1}题:
                        </span>
                        <span className="answer-q-text">
                          {question?.question}
                        </span>
                      </div>
                      <div className="answer-content">
                        <div className="student-answer-text">
                          <strong>学生答案:</strong>
                          <span
                            className={
                              studentAnswer.isCorrect
                                ? "correct-answer"
                                : "incorrect-answer"
                            }
                          >
                            {studentAnswer.userAnswer || "未作答"}
                          </span>
                        </div>
                        {studentAnswer.questionType !== "essay" && (
                          <div className="correct-answer-text">
                            <strong>正确答案:</strong>{" "}
                            {studentAnswer.correctAnswer}
                          </div>
                        )}
                        <div className="answer-score">
                          <strong>得分:</strong>{" "}
                          {studentAnswer.earnedPoints || 0}/
                          {studentAnswer.points || 1}分
                          {studentAnswer.isCorrect !== undefined && (
                            <span
                              className={`result-badge ${
                                studentAnswer.isCorrect
                                  ? "correct"
                                  : "incorrect"
                              }`}
                            >
                              {studentAnswer.isCorrect ? "✅" : "❌"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizStats;
