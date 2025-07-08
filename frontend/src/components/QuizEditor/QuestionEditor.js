import React, { useState, useEffect, useCallback, useRef } from "react";
import "./QuizEditor.css";

const QuestionEditor = ({
  question,
  index,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  /* ---------- 本地状态 ---------- */
  const [localQuestion, setLocalQuestion] = useState(() => ({
    type: "single",
    question: "",
    options: ["", ""],
    correctAnswer: "",
    points: 1,
    essayConfig: {
      minWords: 50,
      maxWords: 500,
      rubric: "",
      sampleAnswer: "",
    },
    ...question,
  }));

  /* ---------- 同步到父组件 ---------- */
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onUpdateRef.current(index, localQuestion);
  }, [localQuestion, index]);

  /* ---------- 更新助手 ---------- */
  const handleUpdate = useCallback((field, value) => {
    setLocalQuestion((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleEssayConfigUpdate = useCallback((field, value) => {
    setLocalQuestion((prev) => ({
      ...prev,
      essayConfig: { ...prev.essayConfig, [field]: value },
    }));
  }, []);

  /* ---------- 选项操作 ---------- */
  const handleOptionChange = useCallback((optionIndex, value) => {
    setLocalQuestion((prev) => {
      const newOptions = [...prev.options];
      const oldVal = newOptions[optionIndex];
      newOptions[optionIndex] = value;

      let newCorrect = prev.correctAnswer;

      if (prev.type === "multiple") {
        const answers = new Set(
          (prev.correctAnswer || "")
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        );
        if (answers.has(oldVal)) {
          answers.delete(oldVal);
          if (value.trim()) answers.add(value);
        }
        newCorrect = [...answers].join(",");
      } else if (prev.type === "single" && prev.correctAnswer === oldVal) {
        newCorrect = value;
      }

      return { ...prev, options: newOptions, correctAnswer: newCorrect };
    });
  }, []);

  const addOption = useCallback(() => {
    if (localQuestion.options.length < 8) {
      handleUpdate("options", [...localQuestion.options, ""]);
    }
  }, [localQuestion.options, handleUpdate]);

  const removeOption = useCallback(
    (optionIndex) => {        //要删除选项的精确索引位置
      if (localQuestion.options.length <= 2) return; //至少保留2个选项

      setLocalQuestion((prev) => {
        const optionToRemove = prev.options[optionIndex];//确定要删除的选项内容
        const newOptions = prev.options.filter((_, i) => i !== optionIndex);//只保留索引不等于optionIndex的选项


        let newCorrect = prev.correctAnswer;
        if (prev.type === "multiple") {
          const answers = new Set(
            (prev.correctAnswer || "")
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          );
          answers.delete(optionToRemove);
          newCorrect = [...answers].join(",");
        } else if (prev.correctAnswer === optionToRemove) {
          newCorrect = "";  // 单选题：如果删除的是正确答案，清空正确答案
        }

        return { ...prev, options: newOptions, correctAnswer: newCorrect };
      });
    },
    [localQuestion.options.length]
  );

  const handleMultipleCorrectAnswer = useCallback((option, checked) => {
    setLocalQuestion((prev) => {
      const answers = new Set(
        (prev.correctAnswer || "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      );
      checked ? answers.add(option) : answers.delete(option);
      return { ...prev, correctAnswer: [...answers].join(",") };
    });
  }, []);

  const isOptionCorrect = (option) =>
    localQuestion.type === "single"
      ? localQuestion.correctAnswer === option
      : (localQuestion.correctAnswer || "").split(",").includes(option);

  /* ---------- 显示文字/图标 ---------- */
  const typeInfo = {
    single: { icon: "🔘", label: "单选题" },
    multiple: { icon: "☑️", label: "多选题" },
    boolean: { icon: "✅", label: "判断题" },
    essay: { icon: "📝", label: "解答题" },
  }[localQuestion.type] || { icon: "🔘", label: "单选题" };

  /* ---------- 渲染 ---------- */
  return (
    <div className="question-editor">
      {/* === 头部栏 === */}
      <div className="question-header">
        <div className="question-info">
          <span className="question-number">第 {index + 1} 题</span>
          <span className="question-type-badge">
            {typeInfo.icon} {typeInfo.label}
          </span>
          <span className="question-points">({localQuestion.points} 分)</span>
        </div>
        <div className="question-actions">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0}
            className="action-btn move-up"
            title="上移"
          >
            ↑
          </button>
          <button
            onClick={() => onMoveDown(index)}
            className="action-btn move-down"
            title="下移"
          >
            ↓
          </button>
          <button
            onClick={() => onDelete(index)}
            className="action-btn delete"
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* === 主体内容 === */}
      <div className="question-content">
        {/* 题目类型 & 分值 */}
        <div className="question-meta">
          {/* 题型选择 */}
          <div className="form-group">
            <label className="form-label">题目类型</label>
            <select
              value={localQuestion.type}
              onChange={(e) => {
                const newType = e.target.value;
                handleUpdate("type", newType);

                if (newType === "essay") {
                  handleUpdate("options", []);
                  handleUpdate("correctAnswer", "");
                } else if (localQuestion.type === "essay") {
                  handleUpdate("options", ["", ""]);
                  handleUpdate("correctAnswer", "");
                } else {
                  handleUpdate("correctAnswer", "");
                }
              }}
              className="form-select"
            >
              <option value="single">🔘 单选题</option>
              <option value="multiple">☑️ 多选题</option>
              <option value="boolean">✅ 判断题</option>
              <option value="essay">📝 解答题</option>
            </select>
          </div>

          {/* 分值 */}
          <div className="form-group">
            <label className="form-label">分值</label>
            <input
              type="number"
              value={localQuestion.points}
              onChange={(e) =>
                handleUpdate("points", parseInt(e.target.value, 10) || 1)
              }
              className="form-input points-input"
              min="1"
              max="20"
            />
          </div>
        </div>

        {/* 题干 */}
        <div className="form-group">
          <label className="form-label">题目内容</label>
          <textarea
            value={localQuestion.question}
            onChange={(e) => handleUpdate("question", e.target.value)}
            className="form-textarea question-textarea"
            placeholder="请输入题目内容..."
            rows="3"
          />
        </div>

        {/* === 根据题型渲染不同区域 === */}
        {/* 解答题 */}
        {localQuestion.type === "essay" && (
          <div className="essay-config">
            <h4 className="config-title">📝 解答题设置</h4>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">最少字数</label>
                <input
                  type="number"
                  value={localQuestion.essayConfig.minWords}
                  onChange={(e) =>
                    handleEssayConfigUpdate(
                      "minWords",
                      parseInt(e.target.value, 10) || 10
                    )
                  }
                  className="form-input"
                  min="10"
                  max="1000"
                />
              </div>

              <div className="form-group">
                <label className="form-label">最多字数</label>
                <input
                  type="number"
                  value={localQuestion.essayConfig.maxWords}
                  onChange={(e) =>
                    handleEssayConfigUpdate(
                      "maxWords",
                      parseInt(e.target.value, 10) || 50
                    )
                  }
                  className="form-input"
                  min="50"
                  max="2000"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">评分标准</label>
              <textarea
                value={localQuestion.essayConfig.rubric}
                onChange={(e) =>
                  handleEssayConfigUpdate("rubric", e.target.value)
                }
                className="form-textarea"
                placeholder="请输入评分标准..."
                rows="3"
              />
            </div>

            <div className="form-group">
              <label className="form-label">参考答案</label>
              <textarea
                value={localQuestion.essayConfig.sampleAnswer}
                onChange={(e) =>
                  handleEssayConfigUpdate("sampleAnswer", e.target.value)
                }
                className="form-textarea"
                placeholder="请输入参考答案..."
                rows="4"
              />
            </div>
          </div>
        )}

        {/* 判断题 */}
        {localQuestion.type === "boolean" && (
          <div className="form-group">
            <label className="form-label">正确答案</label>
            <div className="boolean-options">
              {["true", "false"].map((val) => (
                <label key={val} className="radio-option">
                  <input
                    type="radio"
                    name={`correct_${index}`}
                    value={val}
                    checked={localQuestion.correctAnswer === val}
                    onChange={(e) =>
                      handleUpdate("correctAnswer", e.target.value)
                    }
                  />
                  <span>{val === "true" ? "✅ 正确" : "❌ 错误"}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 单/多选题 */}
        {(localQuestion.type === "single" ||
          localQuestion.type === "multiple") && (
          <div className="form-group">
            <label className="form-label">选项设置</label>
            <div className="options-container">
              {localQuestion.options.map((option, optionIndex) => (
                <div key={optionIndex} className="option-item">
                  <div className="option-input-group">
                    <span className="option-prefix">
                      {String.fromCharCode(65 + optionIndex)}.
                    </span>

                    <input
                      type="text"
                      value={option}
                      onChange={(e) =>
                        handleOptionChange(optionIndex, e.target.value)
                      }
                      className="form-input option-input"
                      placeholder={`选项 ${String.fromCharCode(
                        65 + optionIndex
                      )}`}
                    />
                    <label className="correct-option">
                      <input
                        type={
                          localQuestion.type === "single" ? "radio" : "checkbox"
                        }
                        name={
                          localQuestion.type === "single"
                            ? `correct_${index}`
                            : undefined
                        }
                        checked={isOptionCorrect(option)}
                        onChange={(e) => {
                          if (localQuestion.type === "single") {
                            handleUpdate("correctAnswer", option);
                          } else {
                            handleMultipleCorrectAnswer(
                              option,
                              e.target.checked
                            );
                          }
                        }}
                        disabled={!option.trim()}
                      />
                      <span>✓ 正确答案</span>
                    </label>
                    {localQuestion.options.length > 2 && (
                      <button
                        onClick={() => removeOption(optionIndex)}
                        className="remove-option-btn"
                        title="删除选项"
                      >
                        ❌
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* 添加选项按钮 */}
              {localQuestion.options.length < 8 && (
                <button onClick={addOption} className="add-option-btn">
                  ➕ 添加选项
                </button>
              )}
            </div>

            {localQuestion.type === "multiple" && (
              <div className="form-hint">💡 多选题可勾选多个正确答案</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionEditor;
