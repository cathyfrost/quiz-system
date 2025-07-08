// frontend/src/components/Dashboard/StudentDashboard.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import StatCard from "./StatCard";
import "./Dashboard.css";

const StudentDashboard = ({ onTakeQuiz, onViewResult }) => {
  const { apiCall, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      completedQuizzes: 0,
      averageScore: 0,
      availableQuizzes: 0,
      bestScore: 0,
      totalTimeSpent: 0,
    },
    availableQuizzes: [],
    recentResults: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      // 获取可参与的测验
      const quizzesResponse = await apiCall("/quiz");
      console.log("📊 学生端测验数据:", quizzesResponse);

      let availableQuizzes = [];

      // 处理测验数据
      if (quizzesResponse.success && quizzesResponse.data) {
        const allQuizzes = quizzesResponse.data.quizzes || [];

        // 筛选可参与的测验（状态为open且在时间范围内）
        const now = new Date();
        availableQuizzes = allQuizzes
          .filter((quiz) => {
            if (quiz.status !== "open") return false;

            // 检查开始时间
            if (quiz.settings?.openAt) {
              const openTime = new Date(quiz.settings.openAt);
              if (now < openTime) return false;
            }

            // 检查结束时间
            if (quiz.settings?.closeAt) {
              const closeTime = new Date(quiz.settings.closeAt);
              if (now > closeTime) return false;
            }

            return true;
          })
          .slice(0, 5); // 最多显示5个
      }

      // 获取学生仪表盘统计数据
      try {
        const dashboardResponse = await apiCall("/stats/student/dashboard");
        console.log("📊 学生仪表盘数据:", dashboardResponse);

        if (dashboardResponse.success && dashboardResponse.data) {
          const { stats: realStats, recentResults: realResults } =
            dashboardResponse.data;

          // 使用真实的统计数据
          const stats = {
            completedQuizzes: realStats.completedQuizzes || 0,
            averageScore: realStats.averageScore || 0,
            availableQuizzes: availableQuizzes.length,
            bestScore: realStats.bestScore || 0,
            totalTimeSpent: realStats.totalTimeSpent || 0,
          };

          setDashboardData({
            stats,
            availableQuizzes: availableQuizzes.map((quiz) => ({
              id: quiz._id || quiz.id,
              title: quiz.title,
              description: quiz.description,
              questionCount: quiz.questions
                ? quiz.questions.length
                : quiz.questionCount || 0,
              settings: quiz.settings,
              status: quiz.status,
              submissions: quiz.submissions || 0,
            })),
            recentResults: realResults || [],
          });

          return; // 成功获取真实数据，直接返回
        }
      } catch (dashboardError) {
        console.warn("⚠️ 获取学生仪表盘数据失败，使用默认值:", dashboardError);
      }

      // 如果获取仪表盘数据失败，使用默认统计数据
      const defaultStats = {
        completedQuizzes: 0,
        averageScore: 0,
        availableQuizzes: availableQuizzes.length,
        bestScore: 0,
        totalTimeSpent: 0,
      };

      setDashboardData({
        stats: defaultStats,
        availableQuizzes: availableQuizzes.map((quiz) => ({
          id: quiz._id || quiz.id,
          title: quiz.title,
          description: quiz.description,
          questionCount: quiz.questions
            ? quiz.questions.length
            : quiz.questionCount || 0,
          settings: quiz.settings,
          status: quiz.status,
          submissions: quiz.submissions || 0,
        })),
        recentResults: [],
      });
    } catch (error) {
      console.error("💥 加载学生仪表盘数据失败:", error);
      setError("部分数据加载失败，请刷新重试");

      // 即使出错也显示一些默认数据
      setDashboardData({
        stats: {
          completedQuizzes: 0,
          averageScore: 0,
          availableQuizzes: 0,
          bestScore: 0,
          totalTimeSpent: 0,
        },
        availableQuizzes: [],
        recentResults: [],
      });
    } finally {
      setLoading(false);
    }
  };
  // 生成智能学习建议
  const generateSmartSuggestions = (stats) => {
    const suggestions = [];

    // 基于平均分的建议
    if (stats.averageScore < 60) {
      suggestions.push({
        icon: "📚",
        title: "基础知识巩固",
        description: `当前平均分${stats.averageScore}分，建议加强基础知识学习`,
        action: "开始学习",
      });
    } else if (stats.averageScore < 80) {
      suggestions.push({
        icon: "🎯",
        title: "错题专项训练",
        description: `平均分${stats.averageScore}分，重点复习错题提升成绩`,
        action: "错题练习",
      });
    } else {
      suggestions.push({
        icon: "🏆",
        title: "挑战高难度",
        description: `平均分${stats.averageScore}分表现优秀，可挑战更难题目`,
        action: "进阶练习",
      });
    }

    // 基于完成测验数量的建议
    if (stats.completedQuizzes < 3) {
      suggestions.push({
        icon: "🚀",
        title: "增加练习频率",
        description: `仅完成${stats.completedQuizzes}次测验，建议多参与练习`,
        action: "查看测验",
      });
    } else if (stats.completedQuizzes >= 10) {
      suggestions.push({
        icon: "📊",
        title: "学习数据分析",
        description: `已完成${stats.completedQuizzes}次测验，查看详细学习报告`,
        action: "查看报告",
      });
    }

    // 基于可参与测验数量的建议
    if (stats.availableQuizzes > 0) {
      suggestions.push({
        icon: "⏰",
        title: "及时参与测验",
        description: `有${stats.availableQuizzes}个测验等待参与，不要错过练习机会`,
        action: "立即参与",
      });
    } else {
      suggestions.push({
        icon: "✅",
        title: "保持学习节奏",
        description: "已完成所有可用测验，继续保持良好学习习惯",
        action: "复习巩固",
      });
    }

    // 基于最高分和平均分差距的建议
    const scoreDiff = stats.bestScore - stats.averageScore;
    if (scoreDiff > 20) {
      suggestions.push({
        icon: "⚖️",
        title: "稳定发挥训练",
        description: `最高分${stats.bestScore}分与平均分差距较大，建议提高稳定性`,
        action: "稳定训练",
      });
    }

    // 确保至少有3个建议
    while (suggestions.length < 3) {
      suggestions.push({
        icon: "📈",
        title: "持续进步",
        description: "保持当前学习状态，继续努力提升",
        action: "继续加油",
      });
    }

    return suggestions.slice(0, 3); // 只返回前3个建议
  };
  // 处理开始答题
  const handleTakeQuiz = (quiz) => {
    if (onTakeQuiz) {
      onTakeQuiz(quiz.id || quiz._id);
    } else {
      console.log("🚀 开始答题:", quiz.title);
    }
  };

  // 处理查看成绩
  const handleViewResult = (result) => {
    if (onViewResult) {
      onViewResult(result.id);
    } else {
      console.log("📊 查看成绩:", result.title);
    }
  };

  // 检查测验是否可以参与
  const canTakeQuiz = (quiz) => {
    const now = new Date();

    if (quiz.settings?.openAt) {
      const openTime = new Date(quiz.settings.openAt);
      if (now < openTime) return false;
    }

    if (quiz.settings?.closeAt) {
      const closeTime = new Date(quiz.settings.closeAt);
      if (now > closeTime) return false;
    }

    return true;
  };

  const getQuizUnavailableReason = (quiz) => {
    const now = new Date();

    if (quiz.settings?.openAt) {
      const openTime = new Date(quiz.settings.openAt);
      if (now < openTime) {
        return `将于 ${openTime.toLocaleString()} 开始`;
      }
    }

    if (quiz.settings?.closeAt) {
      const closeTime = new Date(quiz.settings.closeAt);
      if (now > closeTime) {
        return "已过期";
      }
    }

    return "暂不可用";
  };

  const getDifficultyLevel = (questionCount) => {
    if (questionCount <= 10)
      return { label: "简单", color: "#52c41a", icon: "🟢" };
    if (questionCount <= 20)
      return { label: "中等", color: "#faad14", icon: "🟡" };
    return { label: "困难", color: "#ff4d4f", icon: "🔴" };
  };

  const getScoreStatus = (score) => {
    if (score >= 90) return "excellent";
    if (score >= 80) return "good";
    if (score >= 70) return "average";
    return "poor";
  };

  const formatTimeSpent = (minutes) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分钟`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "未知时间";

    try {
      const date = new Date(dateString);

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        return "无效日期";
      }

      return date.toLocaleDateString("zh-CN", {
        month: "numeric",
        day: "numeric",
      });
    } catch (error) {
      console.error("日期格式化错误:", error);
      return "日期错误";
    }
  };

  if (loading) {
    return (
      <div className="dashboard loading">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载仪表盘数据中...</p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      icon: "✅",
      title: "已完成测验",
      value: dashboardData.stats.completedQuizzes,
      subtitle: `总计用时 ${formatTimeSpent(
        dashboardData.stats.totalTimeSpent
      )}`,
      color: "green",
    },
    {
      icon: "🏆",
      title: "我的平均分",
      value: dashboardData.stats.averageScore,
      subtitle:
        dashboardData.stats.averageScore > 80 ? "表现优秀！" : "继续加油！",
      color: "orange",
    },
    {
      icon: "📝",
      title: "可参与测验",
      value: dashboardData.stats.availableQuizzes,
      subtitle:
        dashboardData.stats.availableQuizzes > 0
          ? "等待您的参与"
          : "暂无新测验",
      color: "blue",
    },
    {
      icon: "⭐",
      title: "最高得分",
      value: dashboardData.stats.bestScore,
      subtitle: "个人最佳成绩",
      color: "purple",
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">学生仪表板</h1>
        <p className="dashboard-subtitle">
          欢迎回来，{user?.name}！查看您的学习进度和可参与的测验
        </p>
      </div>

      {error && (
        <div className="message error">
          {error}
          <button onClick={() => setError("")} className="message-close">
            ×
          </button>
        </div>
      )}

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="dashboard-content">
        {/* 可参与的测验 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">📝 可参与的测验</h2>
            <button
              onClick={() => window.location.reload()}
              className="action-button secondary"
            >
              🔄 刷新
            </button>
          </div>

          <div className="quiz-list">
            {dashboardData.availableQuizzes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>暂无可参与的测验</h3>
                <p>请耐心等待老师发布新的测验</p>
              </div>
            ) : (
              dashboardData.availableQuizzes.map((quiz) => {
                const canTake = canTakeQuiz(quiz);
                const difficulty = getDifficultyLevel(quiz.questionCount);

                return (
                  <div key={quiz.id} className="quiz-item">
                    <div className="quiz-info">
                      <h3 className="quiz-title">{quiz.title}</h3>
                      <div className="quiz-stats">
                        <span className="quiz-stat">
                          ❓ {quiz.questionCount} 道题
                        </span>
                        <span className="quiz-stat">
                          ⏰{" "}
                          {quiz.settings?.timeLimit > 0
                            ? `${quiz.settings.timeLimit} 分钟`
                            : "不限时间"}
                        </span>
                        <span className="quiz-stat">
                          👥 {quiz.submissions} 人已参与
                        </span>
                        <span
                          className="difficulty"
                          style={{ color: difficulty.color }}
                        >
                          {difficulty.icon} {difficulty.label}
                        </span>
                      </div>
                      {/* {quiz.description && (
                        <p className="quiz-description">{quiz.description}</p>
                      )} */}
                    </div>
                    <div className="quiz-actions">
                      {canTake ? (
                        <button
                          onClick={() => handleTakeQuiz(quiz)}
                          className="action-button primary"
                        >
                          🚀 开始答题
                        </button>
                      ) : (
                        <div className="quiz-unavailable">
                          <button className="action-button secondary" disabled>
                            暂不可用
                          </button>
                          <div className="unavailable-reason">
                            {getQuizUnavailableReason(quiz)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 最近成绩 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">📊 最近成绩</h2>
            <button className="action-button secondary">查看全部</button>
          </div>

          <div className="results-list">
            {dashboardData.recentResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>暂无成绩记录</h3>
                <p>完成测验后，成绩将在这里显示</p>
              </div>
            ) : (
              dashboardData.recentResults.map((result) => (
                <div
                  key={result.id}
                  className="result-item"
                  onClick={() => handleViewResult(result)}
                >
                  <div className="result-info">
                    <h3 className="result-title">{result.title}</h3>
                    <div className="result-details">
                      <span className="result-date">
                        📅 {formatDate(result.date)}
                      </span>
                      <span className="result-time">
                        ⏱️ 用时 {result.timeSpent}分钟
                      </span>
                      <span className="result-accuracy">
                        ✓ {result.correctRate || 0}% 正确率
                      </span>
                    </div>
                  </div>
                  <div className="result-score">
                    <span className={`score ${getScoreStatus(result.score)}`}>
                      {result.score}
                    </span>
                    <span className="score-label">分</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 学习建议 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">💡 智能学习建议</h2>
          </div>

          <div className="quick-actions">
            {generateSmartSuggestions(dashboardData.stats).map(
              (suggestion, index) => (
                <div key={index} className="quick-action-card">
                  <div className="quick-action-icon">{suggestion.icon}</div>
                  <div className="quick-action-content">
                    <h3>{suggestion.title}</h3>
                    <p>{suggestion.description}</p>
                    <button className="action-button secondary">
                      {suggestion.action}
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
export { StudentDashboard };
