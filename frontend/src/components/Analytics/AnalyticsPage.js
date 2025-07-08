// frontend/src/components/Analytics/AnalyticsPage.js
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import StatCard from "../Dashboard/StatCard";
import QuizStats from "../QuizStats/QuizStats";
import "./Analytics.css";

const AnalyticsPage = () => {
  const { apiCall, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState({
    overview: {
      totalQuizzes: 0,
      totalStudents: 0,
      totalAnswers: 0,
      averageEngagement: 0,
    },
    recentActivity: [],
    topPerformingQuizzes: [],
    studentPerformance: {
      excellent: 0,
      good: 0,
      average: 0,
      poor: 0,
    },
    insights: [],
  });
  const [selectedTimeRange, setSelectedTimeRange] = useState("week");
  const [message, setMessage] = useState("");
  const [currentView, setCurrentView] = useState("analytics");
  const [selectedQuizForStats, setSelectedQuizForStats] = useState(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [selectedTimeRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setMessage("");

    try {
      console.log("📊 开始加载分析数据，时间范围:", selectedTimeRange);

      // 调用真实的API
      const response = await apiCall(
        `/stats/teacher/analytics?range=${selectedTimeRange}`
      );

      if (response.success) {
        const data = response.data;

        // 处理数据并生成洞察建议
        const processedData = {
          ...data,
          insights: [], // 重新生成洞察建议
        };

        // 1. 表现分析
        const totalStudents = data.studentPerformance
          ? data.studentPerformance.excellent +
            data.studentPerformance.good +
            data.studentPerformance.average +
            data.studentPerformance.poor
          : 0;

        const excellentRate =
          totalStudents > 0
            ? (data.studentPerformance.excellent / totalStudents) * 100
            : 0;

        if (excellentRate > 30) {
          processedData.insights.push({
            type: "positive",
            title: "表现优异",
            content: `有 ${excellentRate.toFixed(
              1
            )}% 的学生取得优秀成绩，教学效果显著。`,
          });
        } else if (excellentRate < 10 && totalStudents > 0) {
          processedData.insights.push({
            type: "warning",
            title: "需要关注",
            content: `仅有 ${excellentRate.toFixed(
              1
            )}% 的学生取得优秀成绩，建议调整教学策略。`,
          });
        }

        // 2. 异常检测建议
        if (data.anomalousAnswers && data.anomalousAnswers.length > 0) {
          processedData.insights.push({
            type: "warning",
            title: "异常答题检测",
            content: `发现 ${data.anomalousAnswers.length} 个可疑答题行为，建议进一步核实。`,
          });
        }

        // 3. 难度建议
        if (data.topPerformingQuizzes && data.topPerformingQuizzes.length > 0) {
          const avgDifficulty =
            data.topPerformingQuizzes.reduce(
              (sum, q) => sum + (q.difficultyScore || 0),
              0
            ) / data.topPerformingQuizzes.length;

          console.log(
            "📊 计算平均难度:",
            avgDifficulty,
            "测验数量:",
            data.topPerformingQuizzes.length
          );

          if (avgDifficulty > 0.7) {
            processedData.insights.push({
              type: "suggestion",
              title: "难度优化",
              content: "题目整体偏难，建议适当降低难度以提高学生参与度。",
            });
          } else if (avgDifficulty < 0.3) {
            processedData.insights.push({
              type: "suggestion",
              title: "难度优化",
              content: "题目相对简单，可适当增加挑战性以促进学生能力提升。",
            });
          } else if (avgDifficulty > 0) {
            processedData.insights.push({
              type: "positive",
              title: "难度适中",
              content: `当前题目难度适中（难度系数${avgDifficulty.toFixed(
                2
              )}），学生接受度良好。`,
            });
          }
        }

        // 4. 参与度分析
        if (data.overview && data.overview.averageEngagement < 50) {
          processedData.insights.push({
            type: "suggestion",
            title: "提升参与度",
            content: `当前参与度为 ${data.overview.averageEngagement}%，建议增加互动环节或调整测验形式。`,
          });
        } else if (data.overview && data.overview.averageEngagement > 80) {
          processedData.insights.push({
            type: "positive",
            title: "参与度良好",
            content: `学生参与度达到 ${data.overview.averageEngagement}%，保持良好的教学互动。`,
          });
        }

        // 5. 时间趋势分析
        if (data.recentActivity && data.recentActivity.length > 2) {
          const recentScores = data.recentActivity
            .filter((a) => a.participants > 0)
            .slice(-3)
            .map((a) => a.avgScore);

          if (recentScores.length >= 2) {
            const isDecreasing =
              recentScores[recentScores.length - 1] < recentScores[0] - 5; // 下降超过5分
            const isIncreasing =
              recentScores[recentScores.length - 1] > recentScores[0] + 5; // 上升超过5分

            if (isDecreasing) {
              processedData.insights.push({
                type: "warning",
                title: "成绩下降趋势",
                content: "最近几次测验平均分呈下降趋势，建议关注学生学习状态。",
              });
            } else if (isIncreasing) {
              processedData.insights.push({
                type: "positive",
                title: "成绩提升趋势",
                content: "最近几次测验平均分呈上升趋势，教学效果良好。",
              });
            }
          }
        }

        // 6. 时间范围特殊建议
        if (selectedTimeRange === "week") {
          if (data.overview.totalAnswers < 10) {
            processedData.insights.push({
              type: "suggestion",
              title: "增加测验频率",
              content: "本周测验活动较少，建议增加小测验以保持学生学习节奏。",
            });
          }
        }

        // 如果没有足够数据生成洞察，提供默认建议
        if (processedData.insights.length === 0) {
          processedData.insights.push({
            type: "suggestion",
            title: "数据收集中",
            content: "随着更多学生参与测验，系统将提供更详细的智能分析。",
          });
        }

        setAnalyticsData(processedData);
        console.log("✅ 分析数据加载完成:", {
          timeRange: selectedTimeRange,
          insights: processedData.insights.length,
          topQuizzes: processedData.topPerformingQuizzes.length,
          anomalous: processedData.anomalousAnswers.length,
        });
      } else {
        setMessage(response.error || "数据加载失败");
        console.error("❌ 加载分析数据失败:", response.error);
      }
    } catch (error) {
      console.error("💥 加载分析数据异常:", error);
      setMessage("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  const handleTimeRangeChange = (range) => {
    console.log("⏰ 切换时间范围:", selectedTimeRange, "->", range);
    setSelectedTimeRange(range);
  };

  const handleExportData = async () => {
    try {
      setMessage("正在生成报告，请稍候...");

      // 调用导出API
      const response = await fetch(
        `http://localhost:5000/api/stats/teacher/export-report?range=${selectedTimeRange}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("导出失败");
      }

      // 获取文件名
      const contentDisposition = response.headers.get("Content-Disposition");//获取HTTP响应头中的Content-Disposition字段
      let fileName = "教学数据分析报告.xlsx";
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match( //使用正则表达式匹配文件名
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (fileNameMatch) {
          fileName = decodeURIComponent(fileNameMatch[1].replace(/['"]/g, ""));
        }
      }

      // 下载文件
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage("📊 报告导出成功！");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("导出失败:", error);
      setMessage("导出失败，请稍后重试");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleViewQuizStats = (quiz) => {
    try {
      console.log("📊 查看测验统计:", quiz);

      const quizId = quiz.id || quiz._id;
      const quizTitle = quiz.title;

      if (!quizId) {
        console.error("❌ 测验ID不存在");
        setMessage("无法获取测验信息");
        return;
      }

      // 切换到测验统计视图
      setSelectedQuizForStats({
        id: quizId,
        title: quizTitle,
      });
      setCurrentView("quiz-stats");

      console.log("✅ 切换到测验统计视图:", { quizId, quizTitle });
    } catch (error) {
      console.error("💥 查看测验统计失败:", error);
      setMessage("跳转失败，请重试");
    }
  };

  const handleBackFromStats = () => {
    setCurrentView("analytics");
    setSelectedQuizForStats(null);
  };

  // 处理洞察数据
  const renderInsights = () => {
    if (!analyticsData.insights || analyticsData.insights.length === 0) {
      return (
        <div className="insight-card suggestion">
          <div className="insight-icon">💡</div>
          <div className="insight-content">
            <h4>数据收集中</h4>
            <p>随着更多学生参与测验，系统将提供更详细的智能分析。</p>
          </div>
        </div>
      );
    }

    return analyticsData.insights.map((insight, index) => (
      <div key={index} className={`insight-card ${insight.type}`}>
        <div className="insight-icon">
          {insight.type === "positive" && "📈"}
          {insight.type === "warning" && "⚠️"}
          {insight.type === "suggestion" && "💡"}
        </div>
        <div className="insight-content">
          <h4>{insight.title}</h4>
          <p>{insight.content}</p>
        </div>
      </div>
    ));
  };

  // 如果正在查看测验统计，显示QuizStats组件
  if (currentView === "quiz-stats" && selectedQuizForStats) {
    return (
      <QuizStats
        quizId={selectedQuizForStats.id}
        quizTitle={selectedQuizForStats.title}
        onBack={handleBackFromStats}
      />
    );
  }

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>加载分析数据中...</p>
      </div>
    );
  }

  const overviewStats = [
    {
      icon: "📝",
      title: "总测验数",
      value: analyticsData.overview.totalQuizzes,
      subtitle: "已创建的测验总数",
      color: "blue",
    },
    {
      icon: "👥",
      title: "参与学生",
      value: analyticsData.overview.totalStudents,
      subtitle: "累计参与学生数",
      color: "green",
    },
    {
      icon: "📊",
      title: "总答题数",
      value: analyticsData.overview.totalAnswers,
      subtitle: "所有测验答题总数",
      color: "orange",
    },
    {
      icon: "🎯",
      title: "参与度",
      value: `${analyticsData.overview.averageEngagement}%`,
      subtitle: "学生平均参与度",
      color: "purple",
    },
  ];

  return (
    <div className="analytics-page">
      {/* 头部 */}
      <div className="analytics-header">
        <div className="analytics-title-section">
          <h1>📊 数据分析</h1>
          <p>深入了解测验数据，优化教学效果</p>
        </div>

        <div className="analytics-controls">
          <div className="time-range-selector">
            {/* <button
              className={`time-btn ${
                selectedTimeRange === "week" ? "active" : ""
              }`}
              onClick={() => handleTimeRangeChange("week")}
            >
              本周
            </button>
            <button
              className={`time-btn ${
                selectedTimeRange === "month" ? "active" : ""
              }`}
              onClick={() => handleTimeRangeChange("month")}
            >
              本月
            </button>
            <button
              className={`time-btn ${
                selectedTimeRange === "quarter" ? "active" : ""
              }`}
              onClick={() => handleTimeRangeChange("quarter")}
            >
              本季度
            </button> */}
          </div>

          <button onClick={handleExportData} className="export-btn">
            📥 导出报告
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className="message info">
          {message}
          <button onClick={() => setMessage("")} className="message-close">
            ×
          </button>
        </div>
      )}

      {/* 概览统计 */}
      <div className="analytics-overview">
        {overviewStats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <div className="analytics-content">
        {/* 学生表现分布 */}
        <div className="analytics-section">
          <h3>🎯 学生表现分布</h3>
          <div className="performance-distribution">
            <div className="distribution-chart">
              <div className="distribution-bar">
                <div
                  className="bar-segment excellent"
                  style={{
                    width: `${
                      analyticsData.studentPerformance.excellent * 100
                    }%`,
                  }}
                  title={`优秀: ${analyticsData.studentPerformance.excellent}人`}
                ></div>
                <div
                  className="bar-segment good"
                  style={{
                    width: `${analyticsData.studentPerformance.good * 100}%`,
                  }}
                  title={`良好: ${analyticsData.studentPerformance.good}人`}
                ></div>
                <div
                  className="bar-segment average"
                  style={{
                    width: `${analyticsData.studentPerformance.average * 100}%`,
                  }}
                  title={`及格: ${analyticsData.studentPerformance.average}人`}
                ></div>
                <div
                  className="bar-segment poor"
                  style={{
                    width: `${analyticsData.studentPerformance.poor * 100}%`,
                  }}
                  title={`待提高: ${analyticsData.studentPerformance.poor}人`}
                ></div>
              </div>
              <div className="distribution-legend">
                <div className="legend-item">
                  <span className="legend-color excellent"></span>
                  <span>
                    优秀(90-100): {analyticsData.studentPerformance.excellent}人
                  </span>
                </div>
                <div className="legend-item">
                  <span className="legend-color good"></span>
                  <span>
                    良好(80-89): {analyticsData.studentPerformance.good}人
                  </span>
                </div>
                <div className="legend-item">
                  <span className="legend-color average"></span>
                  <span>
                    及格(70-79): {analyticsData.studentPerformance.average}人
                  </span>
                </div>
                <div className="legend-item">
                  <span className="legend-color poor"></span>
                  <span>
                    待提高(0-69): {analyticsData.studentPerformance.poor}人
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 最近活动趋势 */}
        <div className="analytics-section">
          <h3>📈 最近活动趋势</h3>
          <div className="activity-chart">
            <div className="chart-container">
              {analyticsData.recentActivity.map((activity, index) => {
                const maxParticipants = Math.max(
                  ...analyticsData.recentActivity.map((a) => a.participants)
                );
                const heightPercentage =
                  (activity.participants / maxParticipants) * 100;

                return (
                  <div key={index} className="activity-bar-container">
                    <div className="activity-info">
                      <div className="participants-count">
                        {activity.participants}
                      </div>
                      <div className="avg-score">{activity.avgScore}分</div>
                    </div>
                    <div
                      className="activity-bar"
                      style={{ height: `${heightPercentage}%` }}
                      title={`${activity.date}: ${activity.participants}人参与，平均分${activity.avgScore}`}
                    ></div>
                    <div className="activity-date">
                      {new Date(activity.date).toLocaleDateString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="chart-labels">
              <span className="chart-label">📊 参与人数</span>
              <span className="chart-label">🎯 平均分数</span>
            </div>
          </div>
        </div>

        {/* 热门测验排行 */}
        <div className="analytics-section">
          <h3>🔥 热门测验排行</h3>
          <div className="top-quizzes">
            {analyticsData.topPerformingQuizzes.map((quiz, index) => (
              <div key={index} className="quiz-rank-item">
                <div className="rank-number">{index + 1}</div>
                <div className="quiz-info">
                  <h4 className="quiz-title">{quiz.title}</h4>
                  <div className="quiz-stats">
                    <span className="participant-count">
                      👥 {quiz.participants}人
                    </span>
                    <span className="avg-score">📊 {quiz.avgScore}分</span>
                    <span className={`difficulty ${quiz.difficulty}`}>
                      {quiz.difficulty === "easy" && "🟢 简单"}
                      {quiz.difficulty === "medium" && "🟡 中等"}
                      {quiz.difficulty === "hard" && "🔴 困难"}
                    </span>
                  </div>
                </div>
                <div className="quiz-actions">
                  <button
                    className="action-btn2"
                    onClick={() => handleViewQuizStats(quiz)}
                  >
                    📊 查看详情
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI 洞察建议 */}
        <div className="analytics-section ai-insights">
          <h3>🤖 智能洞察建议</h3>
          <div className="insights-container">{renderInsights()}</div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
