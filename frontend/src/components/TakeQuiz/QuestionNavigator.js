// frontend/src/components/TakeQuiz/QuestionNavigator.js
import React from 'react';

const QuestionNavigator = ({ questions, currentIndex, answers, onNavigate }) => {
  const getQuestionStatus = (index) => {
    if (answers.hasOwnProperty(index)) {
      return 'answered';
    }
    if (index === currentIndex) {
      return 'current';
    }
    return 'unanswered';
  };

  return (
    <div className="question-navigator">
      <div className="navigator-header">
        <h4>题目导航</h4>
        <div className="navigator-legend">
          <div className="legend-item">
            <span className="legend-dot answered"></span>
            <span>已答</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot current"></span>
            <span>当前</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot unanswered"></span>
            <span>未答</span>
          </div>
        </div>
      </div>

      <div className="navigator-grid">
        {questions.map((_, index) => {
          const status = getQuestionStatus(index);
          return (
            <button
              key={index}
              onClick={() => onNavigate(index)}
              className={`navigator-item ${status}`}
              title={`第${index + 1}题 - ${status === 'answered' ? '已答题' : status === 'current' ? '当前题目' : '未答题'}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="navigator-summary">
        <div className="summary-item">
          <span>总题数: {questions.length}</span>
        </div>
        <div className="summary-item">
          <span>已答: {Object.keys(answers).length}</span>
        </div>
        <div className="summary-item">
          <span>未答: {questions.length - Object.keys(answers).length}</span>
        </div>
      </div>
    </div>
  );
};

export default QuestionNavigator;