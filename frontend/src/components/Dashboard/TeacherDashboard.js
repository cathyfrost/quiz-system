// frontend/src/components/Dashboard/TeacherDashboard.js - 简化版，渐进式数据加载
import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import StatCard from "./StatCard";
import "./Dashboard.css";

const TeacherDashboard = ({
  onCreateQuiz,
  onEditQuiz,
  onViewQuiz,
  onGrading,
}) => {
  const { apiCall, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalQuizzes: 0,
      totalStudents: 0,
      averageScore: 0,
      pendingGrading: 0,
    },
    recentQuizzes: [],
    pendingGradingList: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError("");

    try {
      // 先尝试获取测验数据
      const quizzesResponse = await apiCall("/quiz");
      console.log("📊 测验数据响应:", quizzesResponse);

      let stats = {
        totalQuizzes: 0,
        totalStudents: 0,
        averageScore: 0,
        pendingGrading: 0,
      };
      let recentQuizzes = [];

      // 处理测验数据
      if (quizzesResponse.success && quizzesResponse.data) {
        const quizzes = quizzesResponse.data.quizzes || [];
        recentQuizzes = quizzes.slice(0, 5); // 最近5个测验

        stats.totalQuizzes = quizzes.length;

        // 计算总参与学生数和平均分
        let totalSubmissions = 0;
        let allScores = [];

        quizzes.forEach((quiz) => {
          if (quiz.submissions) {
            totalSubmissions += quiz.submissions;
          }
          // 如果有统计数据，添加到总分数组
          if (quiz.statistics && quiz.statistics.averageScore) {
            // 将每个测验的平均分按参与人数权重添加
            const submissions = quiz.submissions || 0;
            for (let i = 0; i < submissions; i++) {
              allScores.push(quiz.statistics.averageScore);
            }
          }
        });

        stats.totalStudents = totalSubmissions;
        stats.averageScore =
          allScores.length > 0
            ? Math.round(
                allScores.reduce((sum, score) => sum + score, 0) /
                  allScores.length
              )
            : 0;
      }

      // 尝试获取批改数据（如果失败不影响其他功能）
      try {
        const gradingResponse = await apiCall("/grading/stats");
        if (gradingResponse.success && gradingResponse.data) {
          stats.pendingGrading =
            gradingResponse.data.overview?.pendingGrading || 0;
        }
      } catch (gradingError) {
        console.warn("⚠️ 获取批改数据失败，将使用默认值:", gradingError);
        // 不设置错误，因为这不是关键功能
      }

      setDashboardData({
        stats,
        recentQuizzes,
        pendingGradingList: [],
      });
    } catch (error) {
      console.error("💥 加载仪表盘数据失败:", error);
      setError("部分数据加载失败，请刷新重试");

      // 即使出错也显示一些默认数据
      setDashboardData({
        stats: {
          totalQuizzes: 0,
          totalStudents: 0,
          averageScore: 0,
          pendingGrading: 0,
        },
        recentQuizzes: [],
        pendingGradingList: [],
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理各种操作
  const handleCreateQuiz = () => {
    if (onCreateQuiz) {
      onCreateQuiz();
    } else {
      console.log("🆕 创建新测验");
    }
  };

  const handleEditQuiz = (quiz) => {
    if (onEditQuiz) {
      onEditQuiz(quiz.id || quiz._id);
    } else {
      console.log("✏️ 编辑测验:", quiz.title);
    }
  };

  const handleViewQuiz = (quiz) => {
    if (onViewQuiz) {
      onViewQuiz(quiz.id || quiz._id);
    } else {
      console.log("👀 查看测验:", quiz.title);
    }
  };

  const handleGrading = () => {
    if (onGrading) {
      onGrading();
    } else {
      console.log("✏️ 进入批改页面");
    }
  };

  const handleQuizStatusChange = async (quiz, newStatus) => {
    try {
      const response = await apiCall(`/quiz/${quiz.id || quiz._id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.success) {
        // 刷新数据
        loadDashboardData();
      } else {
        setError(response.error || "状态更新失败");
      }
    } catch (error) {
      console.error("状态更新失败:", error);
      setError("状态更新失败");
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      draft: {
        label: "草稿",
        color: "#faad14",
        action: "open",
        actionLabel: "发布",
      },
      open: {
        label: "进行中",
        color: "#52c41a",
        action: "closed",
        actionLabel: "关闭",
      },
      closed: {
        label: "已结束",
        color: "#8c8c8c",
        action: "open",
        actionLabel: "重开",
      },
    };
    return configs[status] || configs.draft;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "未知时间";
    return new Date(dateString).toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      icon: "📝",
      title: "创建的测验",
      value: dashboardData.stats.totalQuizzes,
      subtitle: `共有 ${
        dashboardData.recentQuizzes.filter((q) => q.status === "open").length
      } 个正在进行`,
      color: "blue",
    },
    {
      icon: "👥",
      title: "总参与人次",
      value: dashboardData.stats.totalStudents,
      subtitle: "所有测验累计参与",
      color: "green",
    },
    {
      icon: "📊",
      title: "平均分数",
      value: dashboardData.stats.averageScore,
      subtitle: "所有测验综合平均",
      color: "orange",
    },
    {
      icon: "✏️",
      title: "待批改",
      value: dashboardData.stats.pendingGrading,
      subtitle:
        dashboardData.stats.pendingGrading > 0 ? "需要您的批改" : "暂无待批改",
      color: dashboardData.stats.pendingGrading > 0 ? "purple" : "green",
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1 className="dashboard-title">教师仪表板</h1>
        <p className="dashboard-subtitle">
          欢迎回来，{user?.name}！管理您的测验和查看学生表现
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
        {/* 最近的测验 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">📋 最近的测验</h2>
            <button
              onClick={handleCreateQuiz}
              className="action-button primary"
            >
              ➕ 创建测验
            </button>
          </div>

          <div className="quiz-list">
            {dashboardData.recentQuizzes.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>还没有创建测验</h3>
                <p>点击上方按钮创建您的第一个测验</p>
                <button
                  onClick={handleCreateQuiz}
                  className="action-button primary"
                >
                  开始创建
                </button>
              </div>
            ) : (
              dashboardData.recentQuizzes.map((quiz) => {
                const statusConfig = getStatusConfig(quiz.status);
                return (
                  <div key={quiz.id || quiz._id} className="quiz-item">
                    <div className="quiz-info">
                      <h3 className="quiz-title">{quiz.title}</h3>
                      <div className="quiz-stats">
                        <span className="quiz-stat">
                          👥 {quiz.submissions || 0} 人参与
                        </span>
                        <span className="quiz-stat">
                          📊 {quiz.questionCount || quiz.questions?.length || 0}{" "}
                          道题
                        </span>
                        <span className="quiz-stat">
                          📅 {formatDate(quiz.createdAt)}
                        </span>
                        <span className="quiz-stat">
                          ⏰{" "}
                          {quiz.settings?.timeLimit > 0
                            ? `${quiz.settings.timeLimit} 分钟`
                            : "不限时间"}
                        </span>
                      </div>
                    </div>
                    <div className="quiz-actions">
                      <span
                        className="quiz-status"
                        style={{ color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                      <button
                        onClick={() => handleViewQuiz(quiz)}
                        className="action-button secondary"
                      >
                        👀 查看
                      </button>
                      <button
                        onClick={() => handleEditQuiz(quiz)}
                        className="action-button secondary"
                      >
                        ✏️ 编辑
                      </button>
                      <button
                        onClick={() =>
                          handleQuizStatusChange(quiz, statusConfig.action)
                        }
                        className="action-button secondary"
                      >
                        {statusConfig.actionLabel}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 快速操作 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h2 className="section-title">🚀 快速操作</h2>
          </div>

          <div className="quick-actions">
            <div className="quick-action-card" onClick={handleCreateQuiz}>
              <div className="quick-action-icon">➕</div>
              <div className="quick-action-content">
                <h3>创建测验</h3>
                <p>快速创建一个新的在线测验</p>
                <button className="action-button primary">开始创建</button>
              </div>
            </div>

            {dashboardData.stats.pendingGrading > 0 && (
              <div className="quick-action-card" onClick={handleGrading}>
                <div className="quick-action-icon">✏️</div>
                <div className="quick-action-content">
                  <h3>批改答卷</h3>
                  <p>
                    有 {dashboardData.stats.pendingGrading} 份解答题等待批改
                  </p>
                  <button className="action-button warning">去批改</button>
                </div>
              </div>
            )}

            <div className="quick-action-card">
              <div className="quick-action-icon">📊</div>
              <div className="quick-action-content">
                <h3>查看分析</h3>
                <p>查看详细的数据分析报告</p>
                <button className="action-button secondary">查看报告</button>
              </div>
            </div>

            <div className="quick-action-card">
              <div className="quick-action-icon">📥</div>
              <div className="quick-action-content">
                <h3>导出数据</h3>
                <p>导出测验结果和统计数据</p>
                <button className="action-button secondary">导出</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
export { TeacherDashboard };
