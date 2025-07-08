// frontend/src/components/StudentResults/MyResults.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import StatCard from "../Dashboard/StatCard";
import "./MyResults.css";

const MyResults = () => {
  const { apiCall, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [resultsData, setResultsData] = useState({
    stats: {
      completedQuizzes: 0,
      averageScore: 0,
      bestScore: 0,
      totalTimeSpent: 0,
      recentStreak: 0,
    },
    quizResults: [],
    monthlyProgress: [],
    subjectStats: [],
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [error, setError] = useState("");

  useEffect(() => {
    loadResultsData();
  }, [selectedTimeRange, sortBy]);

  const loadResultsData = async () => {
    setLoading(true);
    setError("");

    try {
      // 获取学生仪表盘统计数据
      const dashboardResponse = await apiCall("/stats/student/dashboard");

      // 获取学生的测验记录
      const quizzesResponse = await apiCall("/quiz");

      if (dashboardResponse.success && quizzesResponse.success) {
        const { stats, recentResults } = dashboardResponse.data;

        // 处理测验结果数据
        const processedResults = recentResults.map((result) => ({
          id: result.id || result._id,
          title: result.title,
          score: result.score || 0,
          totalQuestions: result.totalQuestions || 0,
          correctAnswers: result.correctCount || 0,
          timeSpent: result.timeSpent || 0,
          submittedAt: result.submittedAt || result.date,
          status: result.status || "graded",
          difficulty: getDifficultyFromScore(result.score),
          subject: extractSubjectFromTitle(result.title),
          hasEssayQuestions: result.hasEssayQuestions || false,
          teacherComment: result.teacherComment || null,
        }));

        // 过滤和排序
        let filteredResults = [...processedResults];

        // 时间范围过滤
        if (selectedTimeRange !== "all") {
          const now = new Date();
          const filterDate = new Date();

          switch (selectedTimeRange) {
            case "week":
              filterDate.setDate(now.getDate() - 7);
              break;
            case "month":
              filterDate.setMonth(now.getMonth() - 1);
              break;
            case "quarter":
              filterDate.setMonth(now.getMonth() - 3);
              break;
          }

          filteredResults = filteredResults.filter(
            (result) => new Date(result.submittedAt) >= filterDate
          );
        }

        // 排序
        switch (sortBy) {
          case "recent":
            filteredResults.sort(
              (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
            );
            break;
          case "score-high":
            filteredResults.sort((a, b) => b.score - a.score);
            break;
          case "score-low":
            filteredResults.sort((a, b) => a.score - b.score);
            break;
          case "title":
            filteredResults.sort((a, b) => a.title.localeCompare(b.title));
            break;
        }

        // 生成月度进度和科目统计
        const monthlyProgress = generateMonthlyProgress(processedResults);
        const subjectStats = generateSubjectStats(processedResults);

        setResultsData({
          stats: {
            completedQuizzes: stats.completedQuizzes || 0,
            averageScore: stats.averageScore || 0,
            bestScore: stats.bestScore || 0,
            totalTimeSpent: stats.totalTimeSpent || 0,
            recentStreak: calculateStreak(processedResults),
          },
          quizResults: filteredResults,
          monthlyProgress,
          subjectStats,
        });
      } else {
        setError("获取成绩数据失败");
      }
    } catch (error) {
      console.error("加载成绩数据失败:", error);
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 添加辅助函数
  const getDifficultyFromScore = (score) => {
    if (score >= 85) return "easy";
    if (score >= 70) return "medium";
    return "hard";
  };

  const extractSubjectFromTitle = (title) => {
    if (title.includes("JavaScript") || title.includes("JS"))
      return "JavaScript";
    if (title.includes("React")) return "React";
    if (title.includes("HTML") || title.includes("CSS")) return "HTML/CSS";
    if (title.includes("Node")) return "Node.js";
    if (title.includes("算法") || title.includes("数据结构")) return "算法";
    return "综合";
  };

  const generateMonthlyProgress = (results) => {
    const monthlyData = {};

    results.forEach((result) => {
      const date = new Date(result.submittedAt);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { scores: [], count: 0 };
      }

      monthlyData[monthKey].scores.push(result.score);
      monthlyData[monthKey].count++;
    });

    return Object.keys(monthlyData)
      .sort()
      .slice(-5) // 最近5个月
      .map((monthKey) => {
        const [year, month] = monthKey.split("-");
        const data = monthlyData[monthKey];
        const average =
          data.scores.reduce((sum, score) => sum + score, 0) /
          data.scores.length;

        return {
          month: `${parseInt(month) + 1}月`,
          average: Math.round(average),
          count: data.count,
        };
      });
  };

  const generateSubjectStats = (results) => {
    const subjectData = {};

    results.forEach((result) => {
      const subject = result.subject;

      if (!subjectData[subject]) {
        subjectData[subject] = { scores: [], count: 0 };
      }

      subjectData[subject].scores.push(result.score);
      subjectData[subject].count++;
    });

    return Object.keys(subjectData).map((subject) => {
      const data = subjectData[subject];
      const average =
        data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length;
      const trend = calculateTrend(data.scores);

      return {
        subject,
        average: Math.round(average),
        count: data.count,
        trend,
      };
    });
  };

  const calculateStreak = (results) => {
    // 计算连续答题天数的简单逻辑
    const sortedResults = results.sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );

    if (sortedResults.length === 0) return 0;

    let streak = 1;
    const today = new Date();

    for (let i = 0; i < sortedResults.length - 1; i++) {
      const current = new Date(sortedResults[i].submittedAt);
      const next = new Date(sortedResults[i + 1].submittedAt);
      const diffDays = Math.abs(current - next) / (1000 * 60 * 60 * 24);

      if (diffDays <= 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const calculateTrend = (scores) => {
    if (scores.length < 2) return "stable";

    const recent = scores.slice(-3);
    const earlier = scores.slice(0, -3);

    if (earlier.length === 0) return "stable";

    const recentAvg =
      recent.reduce((sum, score) => sum + score, 0) / recent.length;
    const earlierAvg =
      earlier.reduce((sum, score) => sum + score, 0) / earlier.length;

    if (recentAvg > earlierAvg + 5) return "up";
    if (recentAvg < earlierAvg - 5) return "down";
    return "stable";
  };

  // 生成模拟数据 - 后续替换为真实API调用
  const generateMockResultsData = async () => {
    // 模拟API延迟
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const quizResults = [
      {
        id: "1",
        title: "JavaScript基础测试",
        score: 95,
        totalQuestions: 20,
        correctAnswers: 19,
        timeSpent: 1800, // 30分钟
        submittedAt: "2024-01-15T10:30:00Z",
        status: "graded",
        difficulty: "medium",
        subject: "JavaScript",
        hasEssayQuestions: true,
        teacherComment: "答题思路清晰，逻辑严密，继续保持！",
      },
      {
        id: "2",
        title: "HTML & CSS 综合练习",
        score: 88,
        totalQuestions: 15,
        correctAnswers: 13,
        timeSpent: 1200,
        submittedAt: "2024-01-12T14:45:00Z",
        status: "graded",
        difficulty: "easy",
        subject: "HTML/CSS",
        hasEssayQuestions: false,
      },
      {
        id: "3",
        title: "React Hooks 深入理解",
        score: 92,
        totalQuestions: 25,
        correctAnswers: 23,
        timeSpent: 2400,
        submittedAt: "2024-01-10T16:20:00Z",
        status: "graded",
        difficulty: "hard",
        subject: "React",
        hasEssayQuestions: true,
        teacherComment: "对Hooks的理解很深入，实例分析得很好。",
      },
      {
        id: "4",
        title: "数据结构与算法",
        score: 76,
        totalQuestions: 18,
        correctAnswers: 14,
        timeSpent: 3600,
        submittedAt: "2024-01-08T09:15:00Z",
        status: "graded",
        difficulty: "hard",
        subject: "算法",
        hasEssayQuestions: true,
        teacherComment: "基础概念掌握良好，但在复杂算法应用上还需加强练习。",
      },
      {
        id: "5",
        title: "Node.js 后端开发",
        score: 0,
        totalQuestions: 22,
        correctAnswers: 0,
        timeSpent: 0,
        submittedAt: "2024-01-05T11:00:00Z",
        status: "partial_graded",
        difficulty: "medium",
        subject: "Node.js",
        hasEssayQuestions: true,
        teacherComment: null,
      },
    ];

    // 过滤和排序
    let filteredResults = [...quizResults];

    // 时间范围过滤
    if (selectedTimeRange !== "all") {
      const now = new Date();
      const filterDate = new Date();

      switch (selectedTimeRange) {
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case "quarter":
          filterDate.setMonth(now.getMonth() - 3);
          break;
      }

      filteredResults = filteredResults.filter(
        (result) => new Date(result.submittedAt) >= filterDate
      );
    }

    // 排序
    switch (sortBy) {
      case "recent":
        filteredResults.sort(
          (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
        );
        break;
      case "score-high":
        filteredResults.sort((a, b) => b.score - a.score);
        break;
      case "score-low":
        filteredResults.sort((a, b) => a.score - b.score);
        break;
      case "title":
        filteredResults.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    // 计算统计数据
    const completedResults = filteredResults.filter(
      (r) => r.status === "graded"
    );
    const averageScore =
      completedResults.length > 0
        ? Math.round(
            completedResults.reduce((sum, r) => sum + r.score, 0) /
              completedResults.length
          )
        : 0;
    const bestScore =
      completedResults.length > 0
        ? Math.max(...completedResults.map((r) => r.score))
        : 0;
    const totalTimeSpent = Math.round(
      completedResults.reduce((sum, r) => sum + r.timeSpent, 0) / 60
    ); // 转换为分钟

    // 生成月度进度数据
    const monthlyProgress = [
      { month: "9月", average: 82, count: 3 },
      { month: "10月", average: 87, count: 5 },
      { month: "11月", average: 89, count: 4 },
      { month: "12月", average: 91, count: 6 },
      { month: "1月", average: 88, count: 5 },
    ];

    // 科目统计
    const subjectStats = [
      { subject: "JavaScript", average: 90, count: 8, trend: "up" },
      { subject: "React", average: 87, count: 5, trend: "up" },
      { subject: "HTML/CSS", average: 85, count: 6, trend: "stable" },
      { subject: "算法", average: 78, count: 4, trend: "down" },
      { subject: "Node.js", average: 82, count: 3, trend: "up" },
    ];

    return {
      stats: {
        completedQuizzes: completedResults.length,
        averageScore,
        bestScore,
        totalTimeSpent,
        recentStreak: 5, // 连续答题天数
      },
      quizResults: filteredResults,
      monthlyProgress,
      subjectStats,
    };
  };

  const getScoreColor = (score) => {
    if (score >= 90) return "#52c41a";
    if (score >= 80) return "#1890ff";
    if (score >= 70) return "#faad14";
    return "#ff4d4f";
  };

  const getScoreLevel = (score) => {
    if (score >= 90) return { level: "优秀", icon: "🏆" };
    if (score >= 80) return { level: "良好", icon: "👍" };
    if (score >= 70) return { level: "及格", icon: "✅" };
    return { level: "需提高", icon: "💪" };
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case "easy":
        return "#52c41a";
      case "medium":
        return "#faad14";
      case "hard":
        return "#ff4d4f";
      default:
        return "#8c8c8c";
    }
  };

  const getDifficultyLabel = (difficulty) => {
    switch (difficulty) {
      case "easy":
        return "🟢 简单";
      case "medium":
        return "🟡 中等";
      case "hard":
        return "🔴 困难";
      default:
        return "未知";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}小时${remainingMinutes}分钟`;
    }
    return `${minutes}分${remainingSeconds}秒`;
  };

  if (loading) {
    return (
      <div className="my-results-loading">
        <div className="loading-spinner"></div>
        <p>加载成绩数据中...</p>
      </div>
    );
  }

  const stats = [
    {
      icon: "📝",
      title: "完成测验",
      value: resultsData.stats.completedQuizzes,
      subtitle: "累计完成的测验数量",
      color: "blue",
    },
    {
      icon: "📊",
      title: "平均分数",
      value: resultsData.stats.averageScore,
      subtitle: `最高分 ${resultsData.stats.bestScore} 分`,
      color: "orange",
    },
    {
      icon: "⏱️",
      title: "学习时长",
      value: `${resultsData.stats.totalTimeSpent}`,
      subtitle: "总学习时间（分钟）",
      color: "purple",
    },
    {
      icon: "🔥",
      title: "连续学习",
      value: `${resultsData.stats.recentStreak}`,
      subtitle: "连续答题天数",
      color: "green",
    },
  ];

  return (
    <div className="my-results">
      {/* 头部 */}
      <div className="results-header">
        <div className="header-content">
          <h1>📈 我的成绩</h1>
          <p>查看您的学习进度和测验成绩</p>
        </div>

        <div className="header-controls">
          {/* <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="filter-select"
          >
            <option value="all">全部时间</option>
            <option value="week">最近一周</option>
            <option value="month">最近一月</option>
            <option value="quarter">最近三月</option>
          </select> */}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="recent">最新优先</option>
            <option value="score-high">分数从高到低</option>
            <option value="score-low">分数从低到高</option>
            <option value="title">按标题排序</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="message error">
          {error}
          <button onClick={() => setError("")} className="message-close">
            ×
          </button>
        </div>
      )}

      {/* 统计概览 */}
      <div className="stats-overview">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="results-content">
        {/* 月度进度趋势 */}
        <div className="results-section">
          <h3>📈 学习进度趋势</h3>
          <div className="progress-chart">
            <div className="chart-container">
              {resultsData.monthlyProgress.map((month, index) => {
                const maxScore = Math.max(
                  ...resultsData.monthlyProgress.map((m) => m.average)
                );
                const heightPercentage = (month.average / maxScore) * 100;

                return (
                  <div key={index} className="progress-bar-container">
                    <div className="progress-info">
                      <div className="month-score">{month.average}分</div>
                      <div className="month-count">{month.count}次</div>
                    </div>
                    <div
                      className="progress-bar"
                      style={{ height: `${heightPercentage}%` }}
                      title={`${month.month}: 平均${month.average}分，${month.count}次测验`}
                    ></div>
                    <div className="month-label">{month.month}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 测验成绩列表 */}
        <div className="results-section">
          <h3>📋 测验记录</h3>
          <div className="quiz-results-list">
            {resultsData.quizResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h4>暂无成绩记录</h4>
                <p>完成测验后，成绩将在这里显示</p>
              </div>
            ) : (
              resultsData.quizResults.map((result) => {
                const scoreLevel = getScoreLevel(result.score);
                const isCompleted = result.status === "graded";

                return (
                  <div
                    key={result.id}
                    className={`result-item ${!isCompleted ? "pending" : ""}`}
                  >
                    <div className="result-main">
                      <div className="result-header">
                        <h4 className="result-title">{result.title}</h4>
                        <div className="result-badges">
                          <span
                            className="difficulty-badge"
                            style={{
                              color: getDifficultyColor(result.difficulty),
                            }}
                          >
                            {getDifficultyLabel(result.difficulty)}
                          </span>
                          {result.hasEssayQuestions && (
                            <span className="essay-badge">📝 含解答题</span>
                          )}
                        </div>
                      </div>

                      <div className="result-details">
                        {/* <div className="detail-row">
                          <span className="detail-label">科目:</span>
                          <span className="detail-value">{result.subject}</span>
                        </div> */}
                        <div className="detail-row">
                          <span className="detail-label">完成时间:</span>
                          <span className="detail-value">
                            {formatDate(result.submittedAt)}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">答题用时:</span>
                          <span className="detail-value">
                            {formatTime(result.timeSpent)}
                          </span>
                        </div>
                        <div className="detail-row">
                          {/* <span className="detail-label">正确率:</span>
                          <span className="detail-value">
                            {result.totalQuestions > 0
                              ? `${Math.round(
                                  (result.correctAnswers /
                                    result.totalQuestions) *
                                    100
                                )}%`
                              : "0%"}{" "}
                            ({result.correctAnswers || 0}/
                            {result.totalQuestions || 0})
                          </span> */}
                        </div>
                      </div>

                      {result.teacherComment && (
                        <div className="teacher-comment">
                          <div className="comment-header">
                            <span className="comment-icon">💬</span>
                            <span className="comment-label">教师评语:</span>
                          </div>
                          <p className="comment-text">
                            {result.teacherComment}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="result-score">
                      {isCompleted ? (
                        <>
                          <div
                            className="score-circle"
                            style={{ borderColor: getScoreColor(result.score) }}
                          >
                            <span
                              className="score-number"
                              style={{ color: getScoreColor(result.score) }}
                            >
                              {result.score}
                            </span>
                          </div>
                          <div className="score-level">
                            <span className="level-icon">
                              {scoreLevel.icon}
                            </span>
                            <span className="level-text">
                              {scoreLevel.level}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="pending-score">
                          <div className="pending-icon">⏳</div>
                          <div className="pending-text">
                            {result.status === "partial_graded"
                              ? "批改中"
                              : "待批改"}
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

        {/* 学习建议
        <div className="results-section">
          <h3>💡 学习建议</h3>
          <div className="learning-suggestions">
            <div className="suggestion-item">
              <div className="suggestion-icon">🎯</div>
              <div className="suggestion-content">
                <h4>保持优势科目</h4>
                <p>JavaScript 和 React 表现优秀，继续深入学习高级特性。</p>
              </div>
            </div>
            
            <div className="suggestion-item">
              <div className="suggestion-icon">💪</div>
              <div className="suggestion-content">
                <h4>重点提升算法</h4>
                <p>算法科目有提升空间，建议多做练习题和复习基础概念。</p>
              </div>
            </div>
            
            <div className="suggestion-item">
              <div className="suggestion-icon">📚</div>
              <div className="suggestion-content">
                <h4>均衡发展</h4>
                <p>建议在保持强项的同时，加强薄弱环节的学习。</p>
              </div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default MyResults;
