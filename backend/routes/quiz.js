// backend/routes/quiz.js - 修复解答题批改问题的完整版本
const express = require("express");
const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const User = require("../models/User");
const Answer = require("../models/Answer");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

console.log("📁 Loading quiz routes with MongoDB...");

// 获取所有测验（分页、搜索、筛选）
router.get("/", authMiddleware, async (req, res) => {
  try {
    console.log("📋 Get quizzes request");

    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      creator = "",
    } = req.query;

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 构建查询条件
    const query = {};

    // 学生只能看到开放的测验
    if (currentUser.role === "student") {
      query.status = "open";

      // 检查时间限制
      const now = new Date();
      query.$or = [
        { "settings.openAt": { $exists: false } },
        { "settings.openAt": null },
        { "settings.openAt": { $lte: now } },
      ];
      query.$and = [
        {
          $or: [
            { "settings.closeAt": { $exists: false } },
            { "settings.closeAt": null },
            { "settings.closeAt": { $gte: now } },
          ],
        },
      ];
    } else {
      // 教师可以看到自己创建的所有测验
      if (currentUser.role === "teacher") {
        query.creator = currentUser._id;
      }

      // 状态筛选
      if (status) {
        query.status = status;
      }
    }

    // 创建者筛选（管理员功能）
    if (creator && currentUser.role === "admin") {
      query.creator = creator;
    }

    // 搜索功能
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;

    // 执行查询
    const quizzes = await Quiz.find(query)
      .populate("creator", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Quiz.countDocuments(query);

    // 为每个测验添加提交统计
    const quizzesWithStats = await Promise.all(
      quizzes.map(async (quiz) => {
        const submissionCount = await Answer.countDocuments({ quiz: quiz._id });

        const quizObj = quiz.toObject();
        return {
          ...quizObj,
          questionCount: quiz.questionCount,
          submissions: submissionCount,
        };
      })
    );

    res.json({
      success: true,
      data: {
        quizzes: quizzesWithStats,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: skip + limit < total,
          totalCount: total,
        },
      },
    });
  } catch (error) {
    console.error("Get quizzes error:", error);
    res.status(500).json({
      success: false,
      error: "获取测验列表失败",
    });
  }
});

// 创建测验
router.post("/create", authMiddleware, async (req, res) => {
  try {
    console.log("📝 Create quiz request");

    const {
      title,
      description,
      questions,
      settings,
      status = "draft",
    } = req.body;

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 检查权限
    if (currentUser.role !== "teacher" && currentUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "只有教师可以创建测验",
      });
    }

    // 创建新测验
    const newQuiz = new Quiz({
      title,
      description: description || "",
      creator: currentUser._id,
      status,
      questions: questions || [],
      settings: {
        timeLimit: settings?.timeLimit || 0,
        allowMultipleAttempts: settings?.allowMultipleAttempts || false,
        showResultsImmediately: settings?.showResultsImmediately || true,
        showCorrectAnswers: settings?.showCorrectAnswers || false,
        openAt: settings?.openAt || null,
        closeAt: settings?.closeAt || null,
        shuffleQuestions: settings?.shuffleQuestions || false,
        shuffleOptions: settings?.shuffleOptions || false,
      },
    });

    await newQuiz.save();

    // 更新教师统计
    if (currentUser.role === "teacher") {
      await currentUser.updateTeachingStats();
    }

    console.log("✅ Quiz created:", newQuiz._id, "Status:", newQuiz.status);

    res.status(201).json({
      success: true,
      message: "测验创建成功",
      data: {
        id: newQuiz._id,
        title: newQuiz.title,
        questionCount: newQuiz.questionCount,
        status: newQuiz.status,
        createdAt: newQuiz.createdAt,
      },
    });
  } catch (error) {
    console.error("Create quiz error:", error);

    // 处理验证错误
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      error: "创建测验失败",
    });
  }
});

// 获取测验详情
router.get("/detail", authMiddleware, async (req, res) => {
  try {
    const quizId = req.query.id;
    console.log("📖 Get quiz detail:", quizId);

    if (!quizId) {
      return res.status(400).json({
        success: false,
        error: "请提供测验ID",
      });
    }

    const quiz = await Quiz.findById(quizId).populate("creator", "name email");

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 检查访问权限
    const isCreator =
      quiz.creator._id.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";
    const isStudent = currentUser.role === "student";

    if (isStudent) {
      // 学生访问：检查测验是否可以参与
      if (quiz.status !== "open") {
        return res.status(400).json({
          success: false,
          error: "测验未开放",
        });
      }

      // 检查时间限制
      const now = new Date();
      if (quiz.settings?.openAt && new Date(quiz.settings.openAt) > now) {
        return res.status(400).json({
          success: false,
          error: "测验尚未开始",
        });
      }

      if (quiz.settings?.closeAt && new Date(quiz.settings.closeAt) < now) {
        return res.status(400).json({
          success: false,
          error: "测验已结束",
        });
      }

      // 返回安全的测验数据（不包含答案）
      const safeQuizData = {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions.map((q) => ({
          type: q.type,
          question: q.question,
          options: q.options,
          points: q.points,
          essayConfig: q.essayConfig,
          // 不包含 correctAnswer
        })),
        settings: quiz.settings,
        status: quiz.status,
      };

      res.json({
        success: true,
        data: safeQuizData,
      });
    } else if (isCreator || isAdmin) {
      // 教师/管理员：返回完整数据
      res.json({
        success: true,
        data: quiz,
      });
    } else {
      return res.status(403).json({
        success: false,
        error: "无权访问此测验",
      });
    }
  } catch (error) {
    console.error("Get quiz detail error:", error);
    res.status(500).json({
      success: false,
      error: "获取测验详情失败",
    });
  }
});

// 提交答案 - 修复解答题批改问题
router.post("/submit", authMiddleware, async (req, res) => {
  try {
    console.log("📝 Quiz submission request");

    const { quiz, answers, timeSpent, totalQuestions } = req.body;

    if (!quiz || !answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: "请提供完整的答题信息",
      });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 检查学生权限
    if (currentUser.role !== "student") {
      return res.status(403).json({
        success: false,
        error: "只有学生可以提交答案",
      });
    }

    // 查找测验
    const quizDoc = await Quiz.findById(quiz);
    if (!quizDoc) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    // 检查测验状态
    if (quizDoc.status !== "open") {
      return res.status(400).json({
        success: false,
        error: "测验已关闭或尚未开始",
      });
    }

    // 检查是否已经提交过
    const existingAnswer = await Answer.findOne({
      quiz: quiz,
      user: currentUser._id,
    });

    if (existingAnswer && !quizDoc.settings.allowMultipleAttempts) {
      return res.status(400).json({
        success: false,
        error: "您已经提交过此测验",
      });
    }

    // 检查测验是否包含解答题
    const hasEssayQuestions = quizDoc.questions.some((q) => q.type === "essay");
    console.log("测验是否包含解答题:", hasEssayQuestions);

    // 计算分数
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;
    let objectivePoints = 0;
    let objectiveEarnedPoints = 0;
    let essayPoints = 0;

    const processedAnswers = answers.map((answer, index) => {
      const question = quizDoc.questions[index];
      if (!question) return answer;

      const questionPoints = question.points || 1;
      totalPoints += questionPoints;

      let isCorrect = false;
      let questionEarnedPoints = 0;

      // 根据题目类型判断正确性
      if (question.type === "essay") {
        // 解答题设置为待批改状态
        essayPoints += questionPoints;
        return {
          questionIndex: index,
          questionType: "essay",
          userAnswer: answer.userAnswer || "",
          points: questionPoints,
          earnedPoints: 0, // 解答题初始得分为0，等待批改
          timeSpentOnQuestion: 0,
          attachments: answer.attachments || [], // 包含附件数据
          essayGrading: {
            gradingStatus: "pending",
            teacherScore: null,
            teacherComment: "",
            gradedBy: null,
            gradedAt: null,
          },
        };
      } else {
        // 客观题自动评分
        objectivePoints += questionPoints;

        if (question.type === "single" || question.type === "boolean") {
          // 单选题和判断题
          isCorrect = answer.userAnswer === question.correctAnswer;
        } else if (question.type === "multiple") {
          // 多选题
          const userAnswers = answer.userAnswer
            ? answer.userAnswer.split(",").sort()
            : [];
          const correctAnswers = question.correctAnswer
            ? question.correctAnswer.split(",").sort()
            : [];
          isCorrect =
            JSON.stringify(userAnswers) === JSON.stringify(correctAnswers);
        }

        if (isCorrect) {
          correctCount++;
          questionEarnedPoints = questionPoints;
          objectiveEarnedPoints += questionPoints;
        }

        return {
          questionIndex: index,
          questionType: question.type,
          userAnswer: answer.userAnswer || "",
          correctAnswer: question.correctAnswer,
          isCorrect,
          points: questionPoints,
          earnedPoints: questionEarnedPoints,
          timeSpentOnQuestion: 0,
          attachments: answer.attachments || [],
        };
      }
    });

    // 计算客观题得分
    const objectiveScore =
      objectivePoints > 0
        ? Math.round((objectiveEarnedPoints / objectivePoints) * 100)
        : 0;

    // 暂时只计算客观题的总分，解答题得分等批改后更新
    earnedPoints = objectiveEarnedPoints;
    const currentScore =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    // 创建答案记录
    const answerData = {
      quiz: quiz,
      user: currentUser._id,
      answers: processedAnswers,
      score: currentScore, // 当前分数（仅客观题）
      totalPoints,
      earnedPoints,
      correctCount,
      totalQuestions: totalQuestions || quizDoc.questions.length,
      objectiveScore, // 客观题得分
      essayScore: 0, // 解答题得分初始为0
      timeSpent: timeSpent || 0,
      startedAt: new Date(Date.now() - (timeSpent || 0) * 1000),
      submittedAt: new Date(),
      // 批改信息
      gradingInfo: {
        requiresGrading: hasEssayQuestions,
        gradingProgress: hasEssayQuestions ? 0 : 100,
        gradedBy: null,
        gradedAt: null,
        teacherComments: "",
      },
      status: hasEssayQuestions ? "submitted" : "graded",
    };

    console.log("答案数据:", {
      hasEssayQuestions,
      requiresGrading: answerData.gradingInfo.requiresGrading,
      status: answerData.status,
    });

    let answerDoc;
    if (existingAnswer && quizDoc.settings.allowMultipleAttempts) {
      // 更新现有答案
      Object.assign(existingAnswer, answerData);
      answerDoc = await existingAnswer.save();
    } else {
      // 创建新答案
      answerDoc = new Answer(answerData);
      await answerDoc.save();
    }

    // 更新用户学习统计
    if (currentUser.role === "student") {
      await currentUser.updateLearningStats({
        score: currentScore,
        timeSpent: timeSpent || 0,
      });
    }

    // 更新测验统计
    quizDoc.statistics.totalSubmissions =
      (quizDoc.statistics.totalSubmissions || 0) + 1;
    quizDoc.statistics.lastSubmissionAt = new Date();

    // 如果有解答题，更新待批改数量
    if (hasEssayQuestions) {
      quizDoc.statistics.pendingGrading =
        (quizDoc.statistics.pendingGrading || 0) + 1;
    }

    // 更新平均分
    const allAnswers = await Answer.find({ quiz: quiz });
    const totalScore = allAnswers.reduce(
      (sum, answer) => sum + answer.score,
      0
    );
    quizDoc.statistics.averageScore =
      allAnswers.length > 0 ? Math.round(totalScore / allAnswers.length) : 0;

    await quizDoc.save();

    console.log("✅ Quiz submitted successfully:", {
      user: currentUser.name,
      quiz: quizDoc.title,
      score: currentScore,
      hasEssayQuestions,
      requiresGrading: hasEssayQuestions,
    });

    res.json({
      success: true,
      message: "答案提交成功",
      data: {
        id: answerDoc._id,
        score: currentScore,
        correctCount,
        totalQuestions: totalQuestions || quizDoc.questions.length,
        timeSpent: timeSpent || 0,
        earnedPoints,
        totalPoints,
        submittedAt: answerDoc.submittedAt,
        status: answerDoc.status,
        requiresGrading: hasEssayQuestions,
        message: hasEssayQuestions
          ? "包含解答题，等待教师批改后显示最终成绩"
          : "测验完成",
      },
    });
  } catch (error) {
    console.error("Submit quiz error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      error: "提交答案失败",
    });
  }
});

// 更新测验
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const quizId = req.params.id;
    const { title, description, questions, settings, status } = req.body;

    console.log("✏️ Update quiz:", quizId, "New status:", status);

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 检查权限
    const isCreator = quiz.creator.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权修改此测验",
      });
    }

    // 检查是否有人已经作答
    const hasSubmissions = (await Answer.countDocuments({ quiz: quizId })) > 0;
    if (quiz.status === "open" && hasSubmissions && questions) {
      return res.status(400).json({
        success: false,
        error: "测验已有人作答，无法修改题目",
      });
    }

    // 更新测验数据
    if (title) quiz.title = title;
    if (description !== undefined) quiz.description = description;
    if (status) quiz.status = status;

    if (settings) {
      quiz.settings = { ...quiz.settings.toObject(), ...settings };
    }

    if (questions && (!hasSubmissions || quiz.status === "draft")) {
      quiz.questions = questions;
    }

    await quiz.save();

    console.log("✅ Quiz updated:", quiz.title, "New status:", quiz.status);

    res.json({
      success: true,
      message: "测验更新成功",
      data: {
        id: quiz._id,
        title: quiz.title,
        questionCount: quiz.questionCount,
        status: quiz.status,
        updatedAt: quiz.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update quiz error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        error: errors.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      error: "更新测验失败",
    });
  }
});

// 修改测验状态
router.put("/:id/status", authMiddleware, async (req, res) => {
  try {
    const quizId = req.params.id;
    const { status } = req.body;

    console.log("🔄 Update quiz status:", { quizId, status });

    if (!["draft", "open", "closed"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "无效的状态值",
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 检查权限
    const isCreator = quiz.creator.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权修改此测验",
      });
    }

    quiz.status = status;
    await quiz.save();

    console.log("✅ Status updated:", quiz.title, "New status:", status);

    res.json({
      success: true,
      message: "状态更新成功",
      data: {
        id: quiz._id,
        status: quiz.status,
      },
    });
  } catch (error) {
    console.error("Update quiz status error:", error);
    res.status(500).json({
      success: false,
      error: "状态更新失败",
    });
  }
});

// 删除测验
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const quizId = req.params.id;
    console.log("🗑️ Delete quiz:", quizId);

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    // 检查权限
    const isCreator = quiz.creator.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权删除此测验",
      });
    }

    // 删除相关的答案记录
    await Answer.deleteMany({ quiz: quizId });

    // 删除测验
    await Quiz.findByIdAndDelete(quizId);

    console.log("✅ Quiz deleted:", quiz.title);

    res.json({
      success: true,
      message: "测验删除成功",
    });
  } catch (error) {
    console.error("Delete quiz error:", error);
    res.status(500).json({
      success: false,
      error: "删除测验失败",
    });
  }
});

// 获取测验统计数据
router.get("/:id/stats", authMiddleware, async (req, res) => {
  try {
    const quizId = req.params.id;
    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(401).json({
        success: false,
        error: "用户未找到",
      });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    // 检查权限
    const isCreator = quiz.creator.toString() === currentUser._id.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权查看此测验统计",
      });
    }

    // 获取所有答卷
    const answers = await Answer.find({ quiz: quizId }).populate(
      "user",
      "name email"
    );

    // 基础统计
    const totalSubmissions = answers.length;
    const completedAnswers = answers.filter(
      (a) => a.status === "graded" || a.status === "submitted"
    );
    const pendingGrading = answers.filter(
      (a) => a.status === "submitted" || a.status === "partial_graded"
    ).length;

    // 分数统计
    const scores = completedAnswers
      .map((a) => a.score)
      .filter((s) => s !== undefined);
    const averageScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    // 分数分布
    const scoreRanges = {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 80 && s < 90).length,
      average: scores.filter((s) => s >= 70 && s < 80).length,
      poor: scores.filter((s) => s < 70).length,
    };

    // 题目统计
    const questionStats = quiz.questions.map((question, index) => {
      const questionAnswers = answers
        .map((a) => a.answers[index])
        .filter(Boolean);

      if (question.type === "essay") {
        const gradedCount = questionAnswers.filter(
          (qa) => qa.essayGrading && qa.essayGrading.gradingStatus === "graded"
        ).length;
        const avgScore =
          questionAnswers
            .filter(
              (qa) =>
                qa.essayGrading && qa.essayGrading.gradingStatus === "graded"
            )
            .reduce((sum, qa) => sum + (qa.essayGrading.teacherScore || 0), 0) /
          (gradedCount || 1);

        return {
          questionIndex: index,
          questionText: question.question.substring(0, 50) + "...",
          type: question.type,
          totalAnswers: questionAnswers.length,
          gradedAnswers: gradedCount,
          averageScore: Math.round(avgScore * 100) / 100,
        };
      } else {
        const correctCount = questionAnswers.filter(
          (qa) => qa.isCorrect
        ).length;
        const correctRate =
          questionAnswers.length > 0
            ? (correctCount / questionAnswers.length) * 100
            : 0;

        // 选项分布（对于选择题）
        const optionStats = {};
        if (question.type !== "boolean") {
          question.options.forEach((option) => {
            optionStats[option] = questionAnswers.filter(
              (qa) =>
                qa.userAnswer === option || qa.userAnswer?.includes(option)
            ).length;
          });
        } else {
          optionStats["正确"] = questionAnswers.filter(
            (qa) => qa.userAnswer === "true"
          ).length;
          optionStats["错误"] = questionAnswers.filter(
            (qa) => qa.userAnswer === "false"
          ).length;
        }

        return {
          questionIndex: index,
          questionText: question.question.substring(0, 50) + "...",
          type: question.type,
          totalAnswers: questionAnswers.length,
          correctCount,
          correctRate: Math.round(correctRate),
          optionStats,
        };
      }
    });

    // 最近提交
    const recentSubmissions = answers
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 10)
      .map((a) => ({
        studentName: a.user.name,
        score: a.score,
        submittedAt: a.submittedAt,
        status: a.status,
      }));

    res.json({
      success: true,
      data: {
        basic: {
          totalSubmissions,
          pendingGrading,
          averageScore,
          maxScore,
          minScore,
        },
        scoreDistribution: scoreRanges,
        questionStats,
        recentSubmissions,
        quiz: {
          title: quiz.title,
          questionCount: quiz.questions.length,
          createdAt: quiz.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("Get quiz stats error:", error);
    res.status(500).json({
      success: false,
      error: "获取统计数据失败",
    });
  }
});

// 获取测验的所有答案数据（用于统计）
router.get("/answers/:quizId", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const currentUser = await User.findById(req.userId);

    // 检查权限（只有测验创建者或管理员可以查看）
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    const isCreator = quiz.creator.toString() === req.userId.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权查看此测验的答案数据",
      });
    }

    // 获取答案数据
    const answers = await Answer.find({ quiz: quizId })
      .populate("user", "name email")
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: answers,
    });
  } catch (error) {
    console.error("获取答案数据失败:", error);
    res.status(500).json({
      success: false,
      error: "获取答案数据失败",
    });
  }
});

// 获取测验统计数据
// 获取测验统计数据
router.get("/stats/:quizId", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const currentUser = await User.findById(req.userId);

    console.log("=== 统计权限检查调试 ===");
    console.log("请求的测验ID:", quizId);
    console.log("当前用户ID:", req.userId);
    console.log("当前用户角色:", currentUser?.role);

    // 检查权限
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      console.log("❌ 测验不存在");
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    console.log("测验创建者ID:", quiz.creator);
    console.log("测验创建者ID (string):", quiz.creator.toString());
    console.log("当前用户ID (string):", req.userId.toString());

    const isCreator = quiz.creator.toString() === req.userId.toString();
    const isAdmin = currentUser.role === "admin";

    console.log("是否为创建者:", isCreator);
    console.log("是否为管理员:", isAdmin);
    console.log("权限检查结果:", isCreator || isAdmin);

    if (!isCreator && !isAdmin) {
      console.log("❌ 权限不足");
      return res.status(403).json({
        success: false,
        error: "无权查看此测验统计",
      });
    }

    console.log("✅ 权限检查通过");

    // 计算统计数据
    const totalSubmissions = await Answer.countDocuments({ quiz: quizId });
    const answers = await Answer.find({ quiz: quizId });

    const averageScore =
      answers.length > 0
        ? Math.round(
            answers.reduce((sum, answer) => sum + (answer.score || 0), 0) /
              answers.length
          )
        : 0;

    const completionRate =
      quiz.statistics?.totalSubmissions > 0
        ? Math.round(
            (totalSubmissions / quiz.statistics.totalSubmissions) * 100
          )
        : 100;

    const stats = {
      totalSubmissions,
      averageScore,
      questionCount: quiz.questions.length,
      completionRate,
      questions: quiz.questions,
    };

    console.log("统计数据:", stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("获取测验统计失败:", error);
    res.status(500).json({
      success: false,
      error: "获取测验统计失败",
    });
  }
});

console.log("✅ Quiz routes loaded with MongoDB");
module.exports = router;
