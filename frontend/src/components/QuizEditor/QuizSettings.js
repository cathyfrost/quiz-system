// frontend/src/components/QuizEditor/QuizSettings.js
import React from "react";
import "./QuizEditor.css";

const QuizSettings = ({ settings = {}, onUpdate }) => {
  const handleChange = (field, value) => {
    onUpdate({ ...settings, [field]: value });
  };

  return (
    <div className="quiz-settings">
      <h3 className="settings-title">⚙️ 测验设置</h3>

      <div className="settings-grid">
        <div className="form-group">
          <label className="form-label">答题时长（分钟）</label>
          <input
            type="number"
            value={settings?.timeLimit || 0}
            onChange={(e) =>
              handleChange("timeLimit", parseInt(e.target.value) || 0)
            }
            className="form-input"
            placeholder="0表示无限制"
            min="0"
            max="180"
          />
          <small className="form-hint">设置为0表示不限制答题时间</small>
        </div>

        <div className="form-group">
          <label className="form-label">重复答题</label>
          <div className="checkbox-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings?.allowMultipleAttempts || false}
                onChange={(e) =>
                  handleChange("allowMultipleAttempts", e.target.checked)
                }
              />
              <span>允许多次参与</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">结果显示</label>
          <div className="checkbox-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings?.showResultsImmediately ?? true}
                onChange={(e) =>
                  handleChange("showResultsImmediately", e.target.checked)
                }
                disabled={settings?.requiresManualGrading}
              />
              <span>立即显示答题结果</span>
              {settings?.requiresManualGrading && (
                <small className="form-hint">包含解答题时将等待批改完成</small>
              )}
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings?.showCorrectAnswers || false}
                onChange={(e) =>
                  handleChange("showCorrectAnswers", e.target.checked)
                }
              />
              <span>显示正确答案</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">开始时间</label>
          <input
            type="datetime-local"
            value={settings?.openAt || ""}
            onChange={(e) => handleChange("openAt", e.target.value)}
            className="form-input"
          />
          <small className="form-hint">留空表示立即开始</small>
        </div>

        <div className="form-group">
          <label className="form-label">结束时间</label>
          <input
            type="datetime-local"
            value={settings?.closeAt || ""}
            onChange={(e) => handleChange("closeAt", e.target.value)}
            className="form-input"
          />
          <small className="form-hint">留空表示不限制结束时间</small>
        </div>

        <div className="form-group">
          <label className="form-label">高级选项</label>
          <div className="checkbox-group">
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings?.shuffleQuestions || false}
                onChange={(e) =>
                  handleChange("shuffleQuestions", e.target.checked)
                }
              />
              <span>打乱题目顺序</span>
            </label>
            <label className="checkbox-option">
              <input
                type="checkbox"
                checked={settings?.shuffleOptions || false}
                onChange={(e) =>
                  handleChange("shuffleOptions", e.target.checked)
                }
              />
              <span>打乱选项顺序</span>
            </label>
          </div>
        </div>
      </div>

      {/* 设置说明 */}
      <div className="settings-notice">
        <h4>📌 设置说明</h4>
        <ul>
          <li>
            <strong>解答题模式：</strong>
            如果测验包含解答题，系统将自动等待教师批改后显示最终成绩
          </li>
          <li>
            <strong>时间限制：</strong>学生必须在规定时间内完成并提交答案
          </li>
          <li>
            <strong>多次尝试：</strong>允许学生重新参与测验（仅记录最高分）
          </li>
          <li>
            <strong>题目顺序：</strong>打乱题目和选项顺序可以减少作弊可能
          </li>
        </ul>
      </div>
    </div>
  );
};

export default QuizSettings;
