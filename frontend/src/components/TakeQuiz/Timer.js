// frontend/src/components/TakeQuiz/Timer.js
import React, { useState, useEffect } from "react";

const Timer = ({ totalMinutes, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(totalMinutes * 60); // 转换为秒
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    // 最后5分钟显示警告
    setIsWarning(timeLeft <= 300);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const getTimeDisplay = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className={`timer ${isWarning ? "warning" : ""}`}>
      <div className="timer-icon">⏰</div>
      <div className="timer-content">
        <div className="timer-label">剩余时间</div>
        <div className="timer-display">{getTimeDisplay()}</div>
      </div>
      {isWarning && <div className="timer-warning">⚠️ 时间不足5分钟</div>}
    </div>
  );
};

export default Timer;
