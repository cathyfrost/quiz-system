// frontend/src/components/QuizManagement/QuizList.js - 修复答题跳转问题
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import QuizStats from "../QuizStats/QuizStats";
import "./QuizManagement.css";

const QuizList = ({ onEditQuiz, onCreateQuiz, onTakeQuiz }) => {
  const { user, apiCall } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [selectedQuizForStats, setSelectedQuizForStats] = useState(null);

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiCall("/quiz");
      if (response.success) {
        setQuizzes(response.data.quizzes || []);
      } else {
        setMessage("加载测验列表失败: " + (response.error || ""));
      }
    } catch (error) {
      console.error("加载测验列表失败:", error);
      setMessage("加载测验列表失败");
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const handleCreateQuiz = () => {
    if (onCreateQuiz) {
      onCreateQuiz();
    }
  };

  const handleEditQuiz = (quiz) => {
    if (onEditQuiz) {
      onEditQuiz(quiz.id || quiz._id);
    }
  };

  const handleTakeQuiz = (quiz) => {
    if (onTakeQuiz) {
      onTakeQuiz(quiz.id || quiz._id);
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    if (window.confirm("确定要删除这个测验吗？此操作不可恢复。")) {
      try {
        const response = await apiCall(`/quiz/${quizId}`, { method: "DELETE" });
        if (response.success) {
          setMessage("测验删除成功");
          loadQuizzes();
        } else {
          setMessage(response.error || "删除失败");
        }
      } catch (error) {
        console.error("删除测验失败:", error);
        setMessage("删除失败");
      }
    }
  };

  const handleStatusChange = async (quizId, newStatus) => {
    try {
      const response = await apiCall(`/quiz/${quizId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.success) {
        setMessage(`状态已更新为${newStatus === "open" ? "进行中" : "已关闭"}`);
        loadQuizzes();
      } else {
        setMessage(response.error || "状态更新失败");
      }
    } catch (error) {
      console.error("修改状态失败:", error);
      setMessage("状态更新失败");
    }
  };

  const handleViewStats = (quiz) => {
    setSelectedQuizForStats(quiz);
    setShowStats(true);
  };

  const handleBackFromStats = () => {
    setShowStats(false);
    setSelectedQuizForStats(null);
  };

  // 过滤测验
  const filteredQuizzes = quizzes.filter((quiz) => {
    const matchesSearch =
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quiz.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || quiz.status === statusFilter;

    // 学生只能看到开放的测验
    if (user?.role === "student") {
      return matchesSearch && quiz.status === "open";
    }

    return matchesSearch && matchesStatus;
  });

  // 如果正在查看统计，显示统计组件
  if (showStats && selectedQuizForStats) {
    return (
      <QuizStats
        quizId={selectedQuizForStats.id || selectedQuizForStats._id}
        quizTitle={selectedQuizForStats.title}
        onBack={handleBackFromStats}
      />
    );
  }

  return (
    <div className="quiz-list-container">
      <div className="quiz-list-header">
        <div className="header-left">
          <h1>📝 测验管理</h1>
          <p>
            {user?.role === "teacher"
              ? "管理您创建的测验，查看参与情况"
              : "参与可用的在线测验"}
          </p>
        </div>
        {user?.role === "teacher" && (
          <button onClick={handleCreateQuiz} className="btn btn-primary">
            ➕ 创建测验
          </button>
        )}
      </div>

      {/* 消息提示 */}
      {message && (
        <div
          className={`message ${
            message.includes("成功") ? "success" : "error"
          }`}
        >
          {message}
          <button className="message-close" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}

      {/* 搜索和筛选 */}
      <div className="quiz-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="搜索测验标题或描述..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        {user?.role === "teacher" && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-filter"
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="open">进行中</option>
            <option value="closed">已结束</option>
          </select>
        )}
      </div>

      {/* 测验列表 */}
      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      ) : filteredQuizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>
            {searchTerm || statusFilter !== "all"
              ? "没有找到符合条件的测验"
              : user?.role === "teacher"
              ? "还没有创建测验"
              : "暂无可参与的测验"}
          </h3>
          <p>
            {user?.role === "teacher" && !searchTerm && statusFilter === "all"
              ? "点击上方按钮创建您的第一个测验"
              : "请稍后再试或联系管理员"}
          </p>
        </div>
      ) : (
        <div className="quiz-grid">
          {filteredQuizzes.map((quiz) => (
            <QuizCard
              key={quiz.id || quiz._id}
              quiz={quiz}
              userRole={user?.role}
              onEdit={() => handleEditQuiz(quiz)}
              onDelete={() => handleDeleteQuiz(quiz.id || quiz._id)}
              onStatusChange={handleStatusChange}
              onTakeQuiz={() => handleTakeQuiz(quiz)}
              onViewStats={() => handleViewStats(quiz)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 测验卡片组件
const QuizCard = ({
  quiz,
  userRole,
  onEdit,
  onDelete,
  onStatusChange,
  onTakeQuiz,
  onViewStats,
}) => {
  const [showActions, setShowActions] = useState(false);

  const getStatusConfig = (status) => {
    const configs = {
      draft: { label: "草稿", color: "#faad14", icon: "📝" },
      open: { label: "进行中", color: "#52c41a", icon: "🟢" },
      closed: { label: "已结束", color: "#8c8c8c", icon: "🔴" },
    };
    return configs[status] || configs.draft;
  };

  const statusConfig = getStatusConfig(quiz.status);

  const handleTakeQuizClick = () => {
    if (onTakeQuiz) {
      onTakeQuiz();
    }
  };

  // 检查测验是否可以参与
  const canTakeQuiz = () => {
    if (quiz.status !== "open") return false;

    // 检查时间限制
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

  const getUnavailableReason = () => {
    if (quiz.status === "draft") return "测验尚未发布";
    if (quiz.status === "closed") return "测验已结束";

    const now = new Date();
    if (quiz.settings?.openAt) {
      const openTime = new Date(quiz.settings.openAt);
      if (now < openTime) {
        return `测验将于 ${openTime.toLocaleString()} 开始`;
      }
    }

    if (quiz.settings?.closeAt) {
      const closeTime = new Date(quiz.settings.closeAt);
      if (now > closeTime) {
        return "测验已过期";
      }
    }

    return "暂不可参与";
  };

  return (
    <div className="quiz-card" data-status={quiz.status}>
      <div className="quiz-card-header">
        <div className="quiz-status" style={{ color: statusConfig.color }}>
          {statusConfig.icon} {statusConfig.label}
        </div>
        {userRole === "teacher" && (
          <div className="quiz-actions">
            <button
              className="action-btn"
              onClick={() => setShowActions(!showActions)}
            >
              ⋮
            </button>
            {showActions && (
              <div className="actions-dropdown">
                <button onClick={onEdit} className="dropdown-item">
                  ✏️ 编辑
                </button>
                <div className="dropdown-divider"></div>
                <button
                  onClick={() =>
                    onStatusChange(
                      quiz.id || quiz._id,
                      quiz.status === "open" ? "closed" : "open"
                    )
                  }
                  className="dropdown-item"
                >
                  {quiz.status === "open" ? "⏸️ 关闭" : "▶️ 开启"}
                </button>
                <div className="dropdown-divider"></div>
                <button onClick={onDelete} className="dropdown-item danger">
                  🗑️ 删除
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="quiz-card-content">
        <h3 className="quiz-title">{quiz.title}</h3>
        {quiz.description && (
          <p className="quiz-description">{quiz.description}</p>
        )}

        <div className="quiz-meta">
          <div className="meta-item">
            <span className="meta-icon">❓</span>
            <span>
              {quiz.questionCount || quiz.questions?.length || 0} 道题
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-icon">⏰</span>
            <span>
              {quiz.settings?.timeLimit > 0
                ? `${quiz.settings.timeLimit} 分钟`
                : "不限时间"}
            </span>
          </div>
          <div className="meta-item">
            <span className="meta-icon">👥</span>
            <span>{quiz.submissions || 0} 人参与</span>
          </div>
        </div>
      </div>

      <div className="quiz-card-footer">
        {userRole === "student" ? (
          <div className="student-quiz-actions">
            {canTakeQuiz() ? (
              <button
                onClick={handleTakeQuizClick}
                className="btn btn-primary quiz-action-btn"
              >
                🚀 开始答题
              </button>
            ) : (
              <div className="quiz-unavailable">
                <button
                  className="btn btn-secondary quiz-action-btn"
                  disabled
                  title={getUnavailableReason()}
                >
                  暂不可用
                </button>
                <div className="unavailable-reason">
                  {getUnavailableReason()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="teacher-actions">
            <button onClick={onEdit} className="btn btn-secondary">
              编辑
            </button>
            <button onClick={onViewStats} className="btn btn-primary">
              查看统计
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizList;
