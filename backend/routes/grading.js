// backend/routes/grading.js - 完整修复的批改路由
const express = require("express");
const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const Answer = require("../models/Answer");
const User = require("../models/User");
const { authMiddleware, requireRole } = require("../middleware/auth");

const router = express.Router();

console.log("📁 Loading grading routes...");

// 获取待批改列表 - 修复查询逻辑
router.get("/pending", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, quizId } = req.query;
    const teacherId = req.userId;

    console.log("📋 Get pending grading list for teacher:", teacherId);

    // 检查教师权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以访问批改功能",
      });
    }

    // 构建查询条件
    let matchQuery = {
      "gradingInfo.requiresGrading": true,
      status: { $in: ["submitted", "partial_graded"] },
    };

    // 如果指定了测验ID
    if (quizId) {
      matchQuery.quiz = new mongoose.Types.ObjectId(quizId);
    }

    console.log("🔍 查询条件:", matchQuery);

    const pendingAnswers = await Answer.aggregate([
      // 第一步：查找符合条件的答案
      {
        $match: matchQuery,
      },
      // 第二步：关联测验信息
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
      // 第三步：只保留当前教师创建的测验
      {
        $match: {
          "quizInfo.creator": new mongoose.Types.ObjectId(teacherId),
        },
      },
      // 第四步：关联学生信息
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
      // 第五步：计算解答题统计
      {
        $addFields: {
          essayQuestionCount: {
            $size: {
              $filter: {
                input: "$answers",
                cond: { $eq: ["$$this.questionType", "essay"] },
              },
            },
          },
          gradedEssayCount: {
            $size: {
              $filter: {
                input: "$answers",
                cond: {
                  $and: [
                    { $eq: ["$$this.questionType", "essay"] },
                    { $eq: ["$$this.essayGrading.gradingStatus", "graded"] },
                  ],
                },
              },
            },
          },
        },
      },
      // 第六步：格式化输出
      {
        $project: {
          quizId: "$quiz",
          quizTitle: "$quizInfo.title",
          studentName: "$userInfo.name",
          studentEmail: "$userInfo.email",
          submittedAt: 1,
          "gradingInfo.gradingProgress": 1,
          essayQuestionCount: 1,
          gradedEssayCount: 1,
          status: 1,
          objectiveScore: 1,
          score: 1,
        },
      },
      // 第七步：排序（最早提交的优先批改）
      {
        $sort: { submittedAt: 1 },
      },
      // 第八步：分页
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    console.log("✅ 找到待批改答案数量:", pendingAnswers.length);
    pendingAnswers.forEach((answer, index) => {
      console.log(
        `📝 待批改 ${index + 1}: ${answer.quizTitle} - ${answer.studentName} (${
          answer._id
        })`
      );
    });

    // 获取总数（用于分页）
    const totalCountResult = await Answer.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "quizzes",
          localField: "quiz",
          foreignField: "_id",
          as: "quizInfo",
        },
      },
      { $unwind: "$quizInfo" },
      {
        $match: {
          "quizInfo.creator": new mongoose.Types.ObjectId(teacherId),
        },
      },
      { $count: "total" },
    ]);

    const totalPending =
      totalCountResult.length > 0 ? totalCountResult[0].total : 0;
    console.log("📊 总待批改数量:", totalPending);

    res.json({
      success: true,
      data: {
        pendingAnswers,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalPending / limit),
          totalCount: totalPending,
        },
      },
    });
  } catch (error) {
    console.error("💥 Get pending grading error:", error);
    res.status(500).json({
      success: false,
      error: "获取待批改列表失败: " + error.message,
    });
  }
});

// 获取批改详情 - 修复版本
router.get("/detail/:answerId", authMiddleware, async (req, res) => {
  try {
    const { answerId } = req.params;
    const teacherId = req.userId;

    console.log(
      "📖 Get grading detail for answer:",
      answerId,
      "by teacher:",
      teacherId
    );

    // 验证 answerId 格式
    if (!mongoose.Types.ObjectId.isValid(answerId)) {
      console.error("❌ 无效的答案ID格式:", answerId);
      return res.status(400).json({
        success: false,
        error: "无效的答案ID格式",
      });
    }

    // 检查教师权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      console.error("❌ 权限不足:", currentUser?.role);
      return res.status(403).json({
        success: false,
        error: "只有教师可以访问批改功能",
      });
    }

    console.log("👤 当前用户信息:", {
      id: currentUser._id,
      role: currentUser.role,
    });

    const answer = await Answer.findById(answerId)
      .populate("quiz", "title questions creator")
      .populate("user", "name email");

    if (!answer) {
      console.error("❌ 答案记录不存在:", answerId);
      return res.status(404).json({
        success: false,
        error: "答案记录不存在",
      });
    }

    console.log("📋 找到答案记录:", {
      answerId: answer._id,
      quizId: answer.quiz._id,
      quizTitle: answer.quiz.title,
      quizCreator: answer.quiz.creator,
      studentName: answer.user.name,
      questionCount: answer.quiz.questions.length,
      answerCount: answer.answers.length,
    });

    // 检查权限 - 只有测验创建者或管理员可以批改
    // 修复权限检查 - 确保类型一致的比较
    const quizCreatorId = answer.quiz.creator.toString();
    const currentTeacherId = teacherId.toString();
    const isAdmin = currentUser.role === "admin";

    console.log("🔍 权限检查详情:", {
      quizCreatorId,
      currentTeacherId,
      isAdmin,
      isMatch: quizCreatorId === currentTeacherId,
    });

    if (quizCreatorId !== currentTeacherId && !isAdmin) {
      console.error("❌ 无权批改此答案:", {
        quizCreator: answer.quiz.creator.toString(),
        teacherId: teacherId,
        isAdmin: currentUser.role === "admin",
      });
      return res.status(403).json({
        success: false,
        error: "无权批改此答案",
      });
    }

    console.log("✅ 权限验证通过，开始构建批改详情");

    // 构建批改详情
    const gradingDetail = {
      answerId: answer._id,
      quiz: {
        id: answer.quiz._id,
        title: answer.quiz.title,
      },
      student: {
        name: answer.user.name,
        email: answer.user.email,
      },
      submittedAt: answer.submittedAt,
      timeSpent: answer.timeSpent,
      objectiveScore: answer.objectiveScore,
      essayScore: answer.essayScore,
      overallScore: answer.score,
      status: answer.status,
      gradingProgress: answer.gradingInfo.gradingProgress,
      questions: [],
    };

    console.log("📝 基本信息构建完成:", {
      answerId: gradingDetail.answerId,
      quizTitle: gradingDetail.quiz.title,
      studentName: gradingDetail.student.name,
      status: gradingDetail.status,
    });

    // 处理每个题目
    answer.answers.forEach((answerDetail, index) => {
      const quizQuestion = answer.quiz.questions[index];

      if (!quizQuestion) {
        console.warn(`⚠️ 题目 ${index} 不存在于测验中`);
        return; // 跳过不存在的题目
      }

      console.log(`🔍 处理题目 ${index}:`, {
        type: answerDetail.questionType,
        question: quizQuestion.question.substring(0, 50) + "...",
        hasAnswer: !!answerDetail.userAnswer,
      });

      const questionData = {
        questionIndex: index,
        questionText: quizQuestion.question,
        questionType: answerDetail.questionType,
        points: answerDetail.points || 1,
        userAnswer: answerDetail.userAnswer || "",
      };

      if (answerDetail.questionType === "essay") {
        // 解答题信息
        console.log(`📝 解答题 ${index}:`, {
          hasEssayGrading: !!answerDetail.essayGrading,
          gradingStatus: answerDetail.essayGrading?.gradingStatus,
          teacherScore: answerDetail.essayGrading?.teacherScore,
        });

        questionData.essay = {
          config: quizQuestion.essayConfig || {},
          grading: answerDetail.essayGrading || {
            gradingStatus: "pending",
            teacherScore: null,
            teacherComment: "",
            gradedBy: null,
            gradedAt: null,
          },
          attachments: answerDetail.attachments || [],
        };
      } else {
        // 客观题信息
        console.log(`✅ 客观题 ${index}:`, {
          isCorrect: answerDetail.isCorrect,
          earnedPoints: answerDetail.earnedPoints,
          correctAnswer: answerDetail.correctAnswer,
        });

        questionData.objective = {
          correctAnswer: answerDetail.correctAnswer,
          isCorrect: answerDetail.isCorrect,
          earnedPoints: answerDetail.earnedPoints,
          options: quizQuestion.options || [],
        };
      }

      gradingDetail.questions.push(questionData);
    });

    console.log("✅ 批改详情构建完成:", {
      totalQuestions: gradingDetail.questions.length,
      essayQuestions: gradingDetail.questions.filter(
        (q) => q.questionType === "essay"
      ).length,
      objectiveQuestions: gradingDetail.questions.filter(
        (q) => q.questionType !== "essay"
      ).length,
    });

    res.json({
      success: true,
      data: gradingDetail,
    });
  } catch (error) {
    console.error("💥 Get grading detail error:", error);
    res.status(500).json({
      success: false,
      error: "获取批改详情失败: " + error.message,
    });
  }
});

// 批改解答题 - 修复版本
router.post("/grade-essay", authMiddleware, async (req, res) => {
  try {
    const { answerId, questionIndex, score, comment } = req.body;
    const teacherId = req.userId;

    console.log("✏️ Grade essay question:", {
      answerId,
      questionIndex,
      score,
      teacherId,
    });

    // 验证输入
    if (!answerId || questionIndex === undefined || score === undefined) {
      console.error("❌ 批改参数不完整:", { answerId, questionIndex, score });
      return res.status(400).json({
        success: false,
        error: "请提供完整的批改信息",
      });
    }

    // 验证 answerId 格式
    if (!mongoose.Types.ObjectId.isValid(answerId)) {
      console.error("❌ 无效的答案ID格式:", answerId);
      return res.status(400).json({
        success: false,
        error: "无效的答案ID格式",
      });
    }

    // 检查教师权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以批改答案",
      });
    }

    const answer = await Answer.findById(answerId).populate(
      "quiz",
      "creator questions"
    );

    if (!answer) {
      console.error("❌ 答案记录不存在:", answerId);
      return res.status(404).json({
        success: false,
        error: "答案记录不存在",
      });
    }

    console.log("📋 找到答案记录，准备批改:", {
      answerId: answer._id,
      questionIndex,
      questionCount: answer.answers.length,
    });

    // 检查权限
    // 修复权限检查 - 确保类型一致的比较
    const quizCreatorId = answer.quiz.creator.toString();
    const currentTeacherId = teacherId.toString();
    const isAdmin = currentUser.role === "admin";

    console.log("🔍 批改权限检查:", {
      quizCreatorId,
      currentTeacherId,
      isAdmin,
      isMatch: quizCreatorId === currentTeacherId,
    });

    if (quizCreatorId !== currentTeacherId && !isAdmin) {
      console.error("❌ 无权批改此答案");
      return res.status(403).json({
        success: false,
        error: "无权批改此答案",
      });
    }

    // 验证题目索引
    if (questionIndex >= answer.answers.length || questionIndex < 0) {
      console.error("❌ 题目索引无效:", {
        questionIndex,
        totalQuestions: answer.answers.length,
      });
      return res.status(400).json({
        success: false,
        error: "题目索引无效",
      });
    }

    const questionAnswer = answer.answers[questionIndex];
    if (questionAnswer.questionType !== "essay") {
      console.error("❌ 该题目不是解答题:", questionAnswer.questionType);
      return res.status(400).json({
        success: false,
        error: "该题目不是解答题",
      });
    }

    // 验证分数范围
    const maxPoints = questionAnswer.points || 1;
    if (score < 0 || score > maxPoints) {
      console.error("❌ 分数超出范围:", { score, maxPoints });
      return res.status(400).json({
        success: false,
        error: `分数必须在0-${maxPoints}之间`,
      });
    }

    console.log("✅ 验证通过，开始批改:", {
      questionType: questionAnswer.questionType,
      currentScore: questionAnswer.essayGrading?.teacherScore,
      newScore: score,
    });

    // 批改解答题
    if (!questionAnswer.essayGrading) {
      questionAnswer.essayGrading = {};
    }

    questionAnswer.essayGrading.teacherScore = score;
    questionAnswer.essayGrading.teacherComment = comment || "";
    questionAnswer.essayGrading.gradedBy = teacherId;
    questionAnswer.essayGrading.gradedAt = new Date();
    questionAnswer.essayGrading.gradingStatus = "graded";
    questionAnswer.earnedPoints = score;

    console.log("📝 更新解答题批改信息完成");

    // 重新计算分数
    let totalEssayPoints = 0;
    let earnedEssayPoints = 0;
    let gradedEssayCount = 0;
    let totalEssayCount = 0;

    answer.answers.forEach((ans) => {
      if (ans.questionType === "essay") {
        totalEssayCount++;
        totalEssayPoints += ans.points || 1;
        if (ans.essayGrading && ans.essayGrading.gradingStatus === "graded") {
          gradedEssayCount++;
          earnedEssayPoints += ans.essayGrading.teacherScore || 0;
        }
      }
    });

    console.log("📊 重新计算分数:", {
      totalEssayCount,
      gradedEssayCount,
      totalEssayPoints,
      earnedEssayPoints,
    });

    // 更新解答题得分
    answer.essayScore =
      totalEssayPoints > 0
        ? Math.round((earnedEssayPoints / totalEssayPoints) * 100)
        : 0;

    // 更新总得分
    const objectiveEarnedPoints = answer.answers
      .filter((ans) => ans.questionType !== "essay" && ans.isCorrect)
      .reduce((sum, ans) => sum + (ans.points || 1), 0);

    answer.earnedPoints = objectiveEarnedPoints + earnedEssayPoints;
    answer.score =
      answer.totalPoints > 0
        ? Math.round((answer.earnedPoints / answer.totalPoints) * 100)
        : 0;

    // 更新批改进度
    answer.gradingInfo.gradingProgress = Math.round(
      (gradedEssayCount / totalEssayCount) * 100
    );

    // 更新状态
    if (gradedEssayCount === totalEssayCount) {
      answer.status = "graded";
      answer.gradingInfo.gradedBy = teacherId;
      answer.gradingInfo.gradedAt = new Date();
      console.log("✅ 所有解答题批改完成，状态更新为已批改");
    } else {
      answer.status = "partial_graded";
      console.log("📝 部分解答题已批改，状态更新为部分批改");
    }

    await answer.save();

    console.log("✅ Essay question graded successfully:", {
      questionIndex,
      score,
      gradingProgress: answer.gradingInfo.gradingProgress,
      status: answer.status,
      overallScore: answer.score,
    });

    res.json({
      success: true,
      message: "批改成功",
      data: {
        questionIndex,
        score,
        comment,
        gradingProgress: answer.gradingInfo.gradingProgress,
        status: answer.status,
        overallScore: answer.score,
      },
    });
  } catch (error) {
    console.error("💥 Grade essay error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "批改失败",
    });
  }
});

// 批量批改解答题
router.post("/grade-batch", authMiddleware, async (req, res) => {
  try {
    const { answerId, essayGrades, overallComment } = req.body;
    const teacherId = req.userId;

    console.log("📝 Batch grade essays for answer:", answerId);

    // 检查教师权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以批改答案",
      });
    }

    const answer = await Answer.findById(answerId).populate("quiz", "creator");

    if (!answer) {
      return res.status(404).json({
        success: false,
        error: "答案记录不存在",
      });
    }

    // 检查权限
    // 修复权限检查 - 确保类型一致的比较
    const quizCreatorId = answer.quiz.creator.toString();
    const currentTeacherId = teacherId.toString();
    const isAdmin = currentUser.role === "admin";

    if (quizCreatorId !== currentTeacherId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权批改此答案",
      });
    }

    // 批量批改
    essayGrades.forEach(({ questionIndex, score, comment }) => {
      if (questionIndex >= 0 && questionIndex < answer.answers.length) {
        const questionAnswer = answer.answers[questionIndex];
        if (questionAnswer.questionType === "essay") {
          if (!questionAnswer.essayGrading) {
            questionAnswer.essayGrading = {};
          }

          questionAnswer.essayGrading.teacherScore = score;
          questionAnswer.essayGrading.teacherComment = comment || "";
          questionAnswer.essayGrading.gradedBy = teacherId;
          questionAnswer.essayGrading.gradedAt = new Date();
          questionAnswer.essayGrading.gradingStatus = "graded";
          questionAnswer.earnedPoints = score;
        }
      }
    });

    // 添加整体评语
    if (overallComment) {
      answer.gradingInfo.teacherComments = overallComment;
      answer.gradingInfo.gradedBy = teacherId;
      answer.gradingInfo.gradedAt = new Date();
    }

    // 重新计算分数
    let totalEssayPoints = 0;
    let earnedEssayPoints = 0;
    let gradedEssayCount = 0;
    let totalEssayCount = 0;

    answer.answers.forEach((ans) => {
      if (ans.questionType === "essay") {
        totalEssayCount++;
        totalEssayPoints += ans.points || 1;
        if (ans.essayGrading && ans.essayGrading.gradingStatus === "graded") {
          gradedEssayCount++;
          earnedEssayPoints += ans.essayGrading.teacherScore || 0;
        }
      }
    });

    // 更新分数和状态
    answer.essayScore =
      totalEssayPoints > 0
        ? Math.round((earnedEssayPoints / totalEssayPoints) * 100)
        : 0;

    const objectiveEarnedPoints = answer.answers
      .filter((ans) => ans.questionType !== "essay" && ans.isCorrect)
      .reduce((sum, ans) => sum + (ans.points || 1), 0);

    answer.earnedPoints = objectiveEarnedPoints + earnedEssayPoints;
    answer.score =
      answer.totalPoints > 0
        ? Math.round((answer.earnedPoints / answer.totalPoints) * 100)
        : 0;
    answer.gradingInfo.gradingProgress = Math.round(
      (gradedEssayCount / totalEssayCount) * 100
    );

    if (gradedEssayCount === totalEssayCount) {
      answer.status = "graded";
    } else {
      answer.status = "partial_graded";
    }

    await answer.save();

    // 更新测验统计
    const quiz = await Quiz.findById(answer.quiz);
    if (quiz && answer.status === "graded") {
      quiz.statistics.pendingGrading = Math.max(
        0,
        (quiz.statistics.pendingGrading || 1) - 1
      );
      await quiz.save();
    }

    console.log("✅ Batch grading completed");

    res.json({
      success: true,
      message: "批改完成",
      data: {
        status: answer.status,
        score: answer.score,
        gradingProgress: answer.gradingInfo.gradingProgress,
      },
    });
  } catch (error) {
    console.error("💥 Batch grade error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "批量批改失败",
    });
  }
});

// 获取批改统计
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.userId;

    console.log("📊 Get grading stats for teacher:", teacherId);

    // 检查教师权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以访问批改功能",
      });
    }

    // 获取教师的所有测验
    const teacherQuizzes = await Quiz.find({ creator: teacherId }).select(
      "_id title"
    );
    const quizIds = teacherQuizzes.map((q) => q._id);

    console.log("📝 教师测验数量:", teacherQuizzes.length);

    // 统计数据
    const stats = await Answer.aggregate([
      {
        $match: {
          quiz: { $in: quizIds },
        },
      },
      {
        $group: {
          _id: null,
          totalSubmissions: { $sum: 1 },
          pendingGrading: {
            $sum: {
              $cond: [
                { $in: ["$status", ["submitted", "partial_graded"]] },
                1,
                0,
              ],
            },
          },
          fullyGraded: {
            $sum: {
              $cond: [{ $eq: ["$status", "graded"] }, 1, 0],
            },
          },
          averageScore: { $avg: "$score" },
        },
      },
    ]);

    // 按测验分组的统计
    const quizStats = await Answer.aggregate([
      {
        $match: {
          quiz: { $in: quizIds },
        },
      },
      {
        $group: {
          _id: "$quiz",
          submissions: { $sum: 1 },
          pending: {
            $sum: {
              $cond: [
                { $in: ["$status", ["submitted", "partial_graded"]] },
                1,
                0,
              ],
            },
          },
          averageScore: { $avg: "$score" },
        },
      },
      {
        $lookup: {
          from: "quizzes",
          localField: "_id",
          foreignField: "_id",
          as: "quizInfo",
        },
      },
      {
        $unwind: "$quizInfo",
      },
      {
        $project: {
          quizTitle: "$quizInfo.title",
          submissions: 1,
          pending: 1,
          averageScore: { $round: ["$averageScore", 1] },
        },
      },
      {
        $sort: { pending: -1 },
      },
    ]);

    const result = {
      overview: stats[0] || {
        totalSubmissions: 0,
        pendingGrading: 0,
        fullyGraded: 0,
        averageScore: 0,
      },
      quizStats,
    };

    console.log("📊 统计结果:", result);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("💥 Get grading stats error:", error);
    res.status(500).json({
      success: false,
      error: "获取批改统计失败: " + error.message,
    });
  }
});

// 获取批改历史
router.get("/history", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const teacherId = req.userId;

    // 检查教师权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以访问批改功能",
      });
    }

    const gradingHistory = await Answer.aggregate([
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
          "quizInfo.creator": new mongoose.Types.ObjectId(teacherId),
          "gradingInfo.gradedBy": new mongoose.Types.ObjectId(teacherId),
          status: "graded",
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
          studentName: "$userInfo.name",
          score: 1,
          "gradingInfo.gradedAt": 1,
          essayQuestionCount: {
            $size: {
              $filter: {
                input: "$answers",
                cond: { $eq: ["$this.questionType", "essay"] },
              },
            },
          },
        },
      },
      {
        $sort: { "gradingInfo.gradedAt": -1 },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    res.json({
      success: true,
      data: {
        history: gradingHistory,
        pagination: {
          current: parseInt(page),
          hasNext: gradingHistory.length === parseInt(limit),
        },
      },
    });
  } catch (error) {
    console.error("💥 Get grading history error:", error);
    res.status(500).json({
      success: false,
      error: "获取批改历史失败: " + error.message,
    });
  }
});

console.log("✅ Grading routes loaded");
module.exports = router;
