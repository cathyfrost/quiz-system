import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import QuestionEditor from "./QuestionEditor";
import QuizSettings from "./QuizSettings";
import "./QuizEditor.css";

const QuizEditor = ({ quizId, onSave, onCancel }) => {
  const { apiCall } = useAuth();

  /* ---------- 状态 ---------- */
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [quizData, setQuizData] = useState({
    title: "",
    description: "",
    questions: [],
    settings: {
      timeLimit: 0,
      allowMultipleAttempts: false,
      showResultsImmediately: true,
      showCorrectAnswers: false,
      openAt: "",
      closeAt: "",
    },
  });

  /* ---------- 加载现有测验 ---------- */
  const loadQuizData = useCallback(async () => {
    if (!quizId) return;
    setLoading(true);
    try {
      const res = await apiCall(`/quiz/detail?id=${quizId}`);
      if (res.success) {
        setQuizData({
          ...res.data,
          settings: {
            timeLimit: 0,
            allowMultipleAttempts: false,
            showResultsImmediately: true,
            showCorrectAnswers: false,
            openAt: "",
            closeAt: "",
            ...res.data.settings,
          },
        });
      } else {
        setMessage(`加载测验失败：${res.error || "未知错误"}`);
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, quizId]);

  useEffect(() => {
    quizId ? loadQuizData() : addQuestion();
  }, [quizId, loadQuizData]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- 基本信息 ---------- */
  const updateBasicInfo = useCallback((field, value) => {
    setQuizData((prev) => ({ ...prev, [field]: value }));
  }, []);

  /* ---------- 题目操作 ---------- */
  const addQuestion = useCallback(() => {
    setQuizData((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        { type: "single", question: "", options: ["", ""], correctAnswer: "" },
      ],
    }));
  }, []);

  const updateQuestion = useCallback((idx, question) => {
    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? question : q)),
    }));
  }, []);

  const deleteQuestion = useCallback((idx) => {
    setQuizData((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  }, []);

  const moveQuestion = useCallback((idx, direction) => {
    setQuizData((prev) => {
      const list = [...prev.questions];
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= list.length) return prev;
      [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
      return { ...prev, questions: list };
    });
  }, []);

  /* ---------- 步骤校验 ---------- */
  const validateStep = (step) => {
    // 基本信息
    if (step === 0 && !quizData.title.trim()) {
      setMessage("请输入测验标题");
      return false;
    }
    // 题目校验
    if (step === 1) {
      if (quizData.questions.length === 0) {
        setMessage("请至少添加一道题目");
        return false;
      }
      for (let i = 0; i < quizData.questions.length; i++) {
        const q = quizData.questions[i];
        if (!q.question.trim()) return setMessage(`第 ${i + 1} 题内容不能为空`);
        if (
          q.type !== "boolean" &&
          q.type !== "essay" &&
          q.options.some((o) => !o.trim())
        )
          return setMessage(`第 ${i + 1} 题存在空选项`);
        if (
          (q.type === "essay" && !q.essayConfig?.sampleAnswer.trim()) ||
          (q.type !== "essay" && !q.correctAnswer)
        )
          return setMessage(`第 ${i + 1} 题未设置正确答案/参考答案`);
      }
    }
    setMessage("");
    return true;
  };

  /* ---------- 步骤导航 ---------- */
  const nextStep = () => {
    if (validateStep(currentStep))
      setCurrentStep((prev) => Math.min(prev + 1, 3));
  };
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  /* ---------- 保存 / 发布 ---------- */
  const saveQuiz = async (status = "draft") => {
    if (!validateStep(1)) return;

    setLoading(true);
    setMessage("");
    try {
      const payload = { ...quizData, status };
      const res = quizId
        ? await apiCall(`/quiz/${quizId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await apiCall("/quiz/create", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      if (res.success) {
        setMessage(status === "draft" ? "草稿保存成功" : "测验发布成功");
        setTimeout(() => onSave && onSave(res.data), 800);
      } else {
        setMessage(res.error || "保存失败");
      }
    } catch (e) {
      setMessage("保存失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 渲染步骤内容 ---------- */
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="step-content">
            <h3>基本信息设置</h3>
            <div className="form-group">
              <label className="form-label">测验标题 *</label>
              <input
                type="text"
                value={quizData.title}
                onChange={(e) => updateBasicInfo("title", e.target.value)}
                className="form-input"
                placeholder="请输入测验标题"
              />
            </div>
            <div className="form-group">
              <label className="form-label">测验描述</label>
              <textarea
                value={quizData.description}
                onChange={(e) => updateBasicInfo("description", e.target.value)}
                className="form-input"
                rows="4"
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="step-content">
            <div className="questions-header">
              <h3>编辑题目</h3>
              <button onClick={addQuestion} className="btn btn-primary">
                ➕ 添加题目
              </button>
            </div>
            <div className="questions-container">
              {quizData.questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  question={q}
                  index={i}
                  onUpdate={updateQuestion}
                  onDelete={deleteQuestion}
                  onMoveUp={() => moveQuestion(i, "up")}
                  onMoveDown={() => moveQuestion(i, "down")}
                />
              ))}
              {quizData.questions.length === 0 && (
                <div className="empty-questions">
                  还没有题目，点击上方按钮添加
                </div>
              )}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-content">
            <QuizSettings
              settings={quizData.settings}
              onUpdate={(settings) =>
                setQuizData((prev) => ({ ...prev, settings }))
              }
            />
          </div>
        );
      case 3:
        return (
          <div className="step-content">
            <h3>预览测验</h3>
            <div className="quiz-preview">
              <div className="preview-header">
                <h4>{quizData.title}</h4>
                {quizData.description && <p>{quizData.description}</p>}
                <div className="quiz-meta">
                  <span>📝 {quizData.questions.length} 题</span>
                  {quizData.settings.timeLimit > 0 && (
                    <span>⏱️ {quizData.settings.timeLimit} 分钟</span>
                  )}
                </div>
              </div>
              <div className="preview-questions">
                {quizData.questions.map((q, i) => (
                  <div key={i} className="preview-question">
                    <div className="question-title">
                      {i + 1}. {q.question}
                    </div>
                    <div className="question-options">
                      {q.type === "boolean"
                        ? "A. 正确　B. 错误"
                        : q.options.map((o, j) => (
                            <div key={j}>
                              {String.fromCharCode(65 + j)}. {o}
                            </div>
                          ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  /* ---------- 载入时骨架 ---------- */
  if (loading && quizId && !quizData.title) {
    return (
      <div className="quiz-editor-loading">
        <div className="loading-spinner" />
        <p>加载中...</p>
      </div>
    );
  }

  /* ---------- 返回 UI ---------- */
  const steps = [
    { title: "基本信息", icon: "📝" },
    { title: "编辑题目", icon: "❓" },
    { title: "测验设置", icon: "⚙️" },
    { title: "预览发布", icon: "👀" },
  ];

  return (
    <div className="quiz-editor">
      {/* 步骤指示器 */}
      <div className="steps-indicator">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`step-item ${
              i === currentStep ? "active" : i < currentStep ? "completed" : ""
            }`}
          >
            <div className="step-icon">{s.icon}</div>
            <div className="step-title">{s.title}</div>
          </div>
        ))}
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

      {/* 步骤内容 */}
      <div className="editor-content">{renderStep()}</div>

      {/* 底部按钮 */}
      <div className="editor-footer">
        <div className="footer-left">
          {currentStep > 0 && (
            <button onClick={prevStep} className="btn btn-secondary">
              ⬅️ 上一步
            </button>
          )}
        </div>

        <div className="footer-right">
          <button onClick={onCancel} className="btn btn-secondary">
            取消
          </button>

          {currentStep < steps.length - 1 ? (
            <button onClick={nextStep} className="btn btn-primary">
              下一步 ➡️
            </button>
          ) : (
            <div className="final-actions">
              <button
                onClick={() => saveQuiz("draft")}
                className="btn btn-secondary"
                disabled={loading}
              >
                {loading ? "保存中..." : "保存草稿"}
              </button>
              <button
                onClick={() => saveQuiz("open")}
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "发布中..." : "发布测验"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizEditor;
