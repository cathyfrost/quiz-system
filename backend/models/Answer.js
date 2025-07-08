// backend/models/Answer.js - 修复批改逻辑的完整版本
const mongoose = require("mongoose");

const answerDetailSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
    },
    questionType: {
      type: String,
      enum: ["single", "multiple", "boolean", "essay"],
      required: true,
    },
    userAnswer: {
      type: String,
      default: "",
    },
    correctAnswer: {
      type: String,
      required: function () {
        return this.questionType !== "essay";
      },
    },
    // 客观题自动判分
    isCorrect: {
      type: Boolean,
      required: function () {
        return this.questionType !== "essay";
      },
    },
    points: {
      type: Number,
      default: 1,
    },
    earnedPoints: {
      type: Number,
      default: 0,
    },
    timeSpentOnQuestion: {
      type: Number,
      default: 0,
    },
    // 解答题专用字段
    essayGrading: {
      teacherScore: {
        type: Number,
        min: 0,
      },
      teacherComment: {
        type: String,
        trim: true,
        default: "",
      },
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      gradedAt: {
        type: Date,
      },
      rubricScores: [
        {
          criterion: String,
          score: Number,
          maxScore: Number,
          comment: String,
        },
      ],
      // 批改状态
      gradingStatus: {
        type: String,
        enum: ["pending", "graded", "needs_review"],
        default: function () {
          return this.questionType === "essay" ? "pending" : "graded";
        },
      },
    },
  },
  {
    _id: false,
  }
);

const answerSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: [answerDetailSchema],
    // 评分信息
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    earnedPoints: {
      type: Number,
      default: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    // 分类评分
    objectiveScore: {
      type: Number,
      default: 0, // 客观题得分
    },
    essayScore: {
      type: Number,
      default: 0, // 解答题得分
    },
    // 时间信息
    timeSpent: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    // 批改信息
    gradingInfo: {
      requiresGrading: {
        type: Boolean,
        default: false,
      },
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      gradedAt: {
        type: Date,
      },
      gradingProgress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      teacherComments: {
        type: String,
        trim: true,
        default: "",
      },
    },
    // 考试环境信息
    environment: {
      userAgent: String,
      ipAddress: String,
      screenResolution: String,
      timeZone: String,
    },
    // ML分析结果
    mlAnalysis: {
      suspiciousActivity: {
        type: Boolean,
        default: false,
      },
      suspiciousReasons: [String],
      timePattern: {
        type: String,
        enum: ["normal", "too_fast", "too_slow", "irregular"],
        default: "normal",
      },
      confidenceLevel: {
        type: Number,
        min: 0,
        max: 1,
        default: 0,
      },
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    // 状态管理
    status: {
      type: String,
      enum: ["in_progress", "submitted", "partial_graded", "graded", "review"],
      default: "submitted",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// 复合索引
answerSchema.index({ quiz: 1, user: 1, attemptNumber: 1 }, { unique: true });
answerSchema.index({ quiz: 1, submittedAt: -1 });
answerSchema.index({ user: 1, submittedAt: -1 });
answerSchema.index({ status: 1, "gradingInfo.requiresGrading": 1 });
answerSchema.index({ "gradingInfo.gradedBy": 1, "gradingInfo.gradedAt": -1 });

// 虚拟字段
answerSchema.virtual("correctRate").get(function () {
  return this.totalQuestions > 0
    ? Math.round((this.correctCount / this.totalQuestions) * 100)
    : 0;
});

answerSchema.virtual("grade").get(function () {
  const score = this.score;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
});

answerSchema.virtual("needsGrading").get(function () {
  return this.answers.some(
    (a) =>
      a.questionType === "essay" &&
      (!a.essayGrading || a.essayGrading.gradingStatus === "pending")
  );
});

answerSchema.virtual("essayQuestionCount").get(function () {
  return this.answers.filter((a) => a.questionType === "essay").length;
});

answerSchema.virtual("gradedEssayCount").get(function () {
  return this.answers.filter(
    (a) =>
      a.questionType === "essay" &&
      a.essayGrading &&
      a.essayGrading.gradingStatus === "graded"
  ).length;
});

// 保存前的中间件：计算分数和状态
answerSchema.pre("save", function (next) {
  console.log("保存前中间件执行，状态:", this.status);

  // 分别计算客观题和解答题
  let objectiveCount = 0;
  let objectiveCorrect = 0;
  let objectivePoints = 0;
  let objectiveEarnedPoints = 0;

  let essayCount = 0;
  let essayPoints = 0;
  let essayEarnedPoints = 0;
  let essayGraded = 0;

  this.answers.forEach((answer) => {
    if (answer.questionType === "essay") {
      essayCount++;
      essayPoints += answer.points || 1;
      if (
        answer.essayGrading &&
        answer.essayGrading.gradingStatus === "graded"
      ) {
        essayGraded++;
        essayEarnedPoints += answer.essayGrading.teacherScore || 0;
      }
    } else {
      objectiveCount++;
      objectivePoints += answer.points || 1;
      if (answer.isCorrect) {
        objectiveCorrect++;
        objectiveEarnedPoints += answer.points || 1;
      }
    }
  });

  // 更新统计信息
  this.correctCount = objectiveCorrect;
  this.totalQuestions = this.answers.length;

  // 计算分数
  this.totalPoints = objectivePoints + essayPoints;
  this.earnedPoints = objectiveEarnedPoints + essayEarnedPoints;

  // 客观题得分
  this.objectiveScore =
    objectivePoints > 0
      ? Math.round((objectiveEarnedPoints / objectivePoints) * 100)
      : 0;

  // 解答题得分
  this.essayScore =
    essayPoints > 0 ? Math.round((essayEarnedPoints / essayPoints) * 100) : 0;

  // 总分计算
  this.score =
    this.totalPoints > 0
      ? Math.round((this.earnedPoints / this.totalPoints) * 100)
      : 0;

  // 更新批改状态
  if (essayCount > 0) {
    this.gradingInfo.requiresGrading = true;
    this.gradingInfo.gradingProgress = Math.round(
      (essayGraded / essayCount) * 100
    );

    if (essayGraded === essayCount) {
      this.status = "graded";
    } else if (essayGraded > 0) {
      this.status = "partial_graded";
    } else {
      this.status = "submitted";
    }
  } else {
    this.gradingInfo.requiresGrading = false;
    this.gradingInfo.gradingProgress = 100;
    this.status = "graded";
  }

  console.log("批改状态更新:", {
    essayCount,
    essayGraded,
    requiresGrading: this.gradingInfo.requiresGrading,
    gradingProgress: this.gradingInfo.gradingProgress,
    status: this.status,
  });

  next();
});

// 静态方法：获取待批改列表
answerSchema.statics.getPendingGrading = function (
  teacherId,
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;

  return this.aggregate([
    {
      $lookup: {
        from: "quizzes",
        localField: "quiz",
        foreignField: "_id",
        as: "quizInfo",
      },
    },
    {
      $unwind: "$quizInfo",
    },
    {
      $match: {
        "quizInfo.creator": mongoose.Types.ObjectId(teacherId),
        "gradingInfo.requiresGrading": true,
        status: { $in: ["submitted", "partial_graded"] },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    {
      $unwind: "$userInfo",
    },
    {
      $project: {
        quizTitle: "$quizInfo.title",
        userName: "$userInfo.name",
        userEmail: "$userInfo.email",
        submittedAt: 1,
        "gradingInfo.gradingProgress": 1,
        essayQuestionCount: {
          $size: {
            $filter: {
              input: "$answers",
              cond: { $eq: ["$this.questionType", "essay"] },
            },
          },
        },
        status: 1,
      },
    },
    {
      $sort: { submittedAt: 1 }, // 最早提交的优先批改
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);
};

// 实例方法：批改解答题
answerSchema.methods.gradeEssayQuestion = function (
  questionIndex,
  score,
  comment,
  gradedBy
) {
  const answer = this.answers[questionIndex];

  if (!answer || answer.questionType !== "essay") {
    throw new Error("题目不存在或不是解答题");
  }

  // 确保essayGrading对象存在
  if (!answer.essayGrading) {
    answer.essayGrading = {};
  }

  answer.essayGrading.teacherScore = score;
  answer.essayGrading.teacherComment = comment;
  answer.essayGrading.gradedBy = gradedBy;
  answer.essayGrading.gradedAt = new Date();
  answer.essayGrading.gradingStatus = "graded";
  answer.earnedPoints = score;

  return this.save();
};

// 实例方法：添加整体评语
answerSchema.methods.addTeacherComments = function (comments, gradedBy) {
  this.gradingInfo.teacherComments = comments;
  this.gradingInfo.gradedBy = gradedBy;
  this.gradingInfo.gradedAt = new Date();

  return this.save();
};

// 实例方法：获取批改详情
answerSchema.methods.getGradingDetails = function () {
  const essayQuestions = this.answers.filter((a) => a.questionType === "essay");

  return {
    totalEssayQuestions: essayQuestions.length,
    gradedEssayQuestions: essayQuestions.filter(
      (a) => a.essayGrading && a.essayGrading.gradingStatus === "graded"
    ).length,
    pendingEssayQuestions: essayQuestions.filter(
      (a) => !a.essayGrading || a.essayGrading.gradingStatus === "pending"
    ).length,
    objectiveScore: this.objectiveScore,
    essayScore: this.essayScore,
    overallScore: this.score,
    gradingProgress: this.gradingInfo.gradingProgress,
    requiresGrading: this.gradingInfo.requiresGrading,
    isFullyGraded: this.status === "graded",
  };
};

// 实例方法：检查是否需要批改
answerSchema.methods.checkGradingNeeded = function () {
  const essayQuestions = this.answers.filter((a) => a.questionType === "essay");

  if (essayQuestions.length === 0) {
    this.gradingInfo.requiresGrading = false;
    this.gradingInfo.gradingProgress = 100;
    this.status = "graded";
    return false;
  }

  const gradedEssays = essayQuestions.filter(
    (a) => a.essayGrading && a.essayGrading.gradingStatus === "graded"
  );

  this.gradingInfo.requiresGrading = true;
  this.gradingInfo.gradingProgress = Math.round(
    (gradedEssays.length / essayQuestions.length) * 100
  );

  if (gradedEssays.length === essayQuestions.length) {
    this.status = "graded";
    return false;
  } else if (gradedEssays.length > 0) {
    this.status = "partial_graded";
    return true;
  } else {
    this.status = "submitted";
    return true;
  }
};

module.exports = mongoose.model("Answer", answerSchema);
