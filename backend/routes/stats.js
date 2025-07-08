// backend/routes/stats.js - 为仪表盘提供统计数据
const express = require("express");
const mongoose = require("mongoose");
const Quiz = require("../models/Quiz");
const Answer = require("../models/Answer");
const User = require("../models/User");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

console.log("📊 Loading stats routes...");

// 获取教师仪表盘统计数据
router.get("/teacher/dashboard", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.userId;
    console.log("📊 获取教师仪表盘数据:", teacherId);

    // 检查权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以访问此功能",
      });
    }

    // 获取教师创建的所有测验
    const teacherQuizzes = await Quiz.find({ creator: teacherId });
    const quizIds = teacherQuizzes.map((q) => q._id);

    // 并行查询统计数据
    const [totalQuizzes, totalAnswers, pendingGradingCount, recentAnswers] =
      await Promise.all([
        // 测验总数
        Quiz.countDocuments({ creator: teacherId }),

        // 所有答案记录
        Answer.find({ quiz: { $in: quizIds } }).populate("user", "name email"),

        // 待批改数量
        Answer.countDocuments({
          quiz: { $in: quizIds },
          "gradingInfo.requiresGrading": true,
          status: { $in: ["submitted", "partial_graded"] },
        }),

        // 最近的答案记录（用于计算平均分）
        Answer.find({ quiz: { $in: quizIds } })
          .sort({ submittedAt: -1 })
          .limit(100)
          .select("score submittedAt"),
      ]);

    // 计算统计数据
    const stats = {
      totalQuizzes,
      totalStudents: totalAnswers.length,
      averageScore:
        recentAnswers.length > 0
          ? Math.round(
              recentAnswers.reduce(
                (sum, answer) => sum + (answer.score || 0),
                0
              ) / recentAnswers.length
            )
          : 0,
      pendingGrading: pendingGradingCount,
    };

    // 获取最近的测验（带统计信息）
    const recentQuizzes = await Quiz.aggregate([
      {
        $match: { creator: new mongoose.Types.ObjectId(teacherId) },
      },
      {
        $lookup: {
          from: "answers",
          localField: "_id",
          foreignField: "quiz",
          as: "answers",
        },
      },
      {
        $addFields: {
          submissions: { $size: "$answers" },
          averageScore: {
            $cond: {
              if: { $gt: [{ $size: "$answers" }, 0] },
              then: {
                $round: [{ $avg: "$answers.score" }, 1],
              },
              else: 0,
            },
          },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $limit: 5,
      },
      {
        $project: {
          title: 1,
          description: 1,
          status: 1,
          createdAt: 1,
          questionCount: { $size: "$questions" },
          submissions: 1,
          averageScore: 1,
          settings: 1,
        },
      },
    ]);

    console.log("✅ 教师仪表盘数据统计完成:", stats);

    res.json({
      success: true,
      data: {
        stats,
        recentQuizzes,
      },
    });
  } catch (error) {
    console.error("💥 获取教师仪表盘数据失败:", error);
    res.status(500).json({
      success: false,
      error: "获取统计数据失败",
    });
  }
});

// 获取学生仪表盘统计数据
router.get("/student/dashboard", authMiddleware, async (req, res) => {
  try {
    const studentId = req.userId;
    console.log("📊 获取学生仪表盘数据:", studentId);

    // 检查权限
    const currentUser = await User.findById(studentId);
    if (!currentUser || currentUser.role !== "student") {
      return res.status(403).json({
        success: false,
        error: "只有学生可以访问此功能",
      });
    }

    // 获取学生的答题记录
    const studentAnswers = await Answer.find({ user: studentId })
      .populate("quiz", "title description questions settings status")
      .sort({ submittedAt: -1 });

    // 计算学生统计数据
    const completedQuizzes = studentAnswers.length;
    const averageScore =
      completedQuizzes > 0
        ? Math.round(
            studentAnswers.reduce(
              (sum, answer) => sum + (answer.score || 0),
              0
            ) / completedQuizzes
          )
        : 0;
    const bestScore =
      completedQuizzes > 0
        ? Math.max(...studentAnswers.map((answer) => answer.score || 0))
        : 0;
    const totalTimeSpent = Math.round(
      studentAnswers.reduce((sum, answer) => sum + (answer.timeSpent || 0), 0) /
        60
    ); // 转换为分钟

    const stats = {
      completedQuizzes,
      averageScore,
      bestScore,
      totalTimeSpent,
    };

    // 最近成绩
    const recentResults = studentAnswers.slice(0, 3).map((answer) => ({
      id: answer._id,
      title: answer.quiz.title,
      score: answer.score || 0,
      date: answer.submittedAt.toISOString().split("T")[0], // 格式化日期
      timeSpent: Math.round((answer.timeSpent || 0) / 60), // 转换为分钟
      status: answer.status,
      correctRate:
        answer.totalQuestions > 0
          ? Math.round((answer.correctCount / answer.totalQuestions) * 100)
          : 0,
      grade:
        answer.score >= 90
          ? "excellent"
          : answer.score >= 80
          ? "good"
          : answer.score >= 70
          ? "average"
          : "poor",
    }));

    console.log("✅ 学生仪表盘数据统计完成:", stats);

    res.json({
      success: true,
      data: {
        stats,
        recentResults,
      },
    });
  } catch (error) {
    console.error("💥 获取学生仪表盘数据失败:", error);
    res.status(500).json({
      success: false,
      error: "获取统计数据失败",
    });
  }
});
// 获取测验详细统计
router.get("/quiz/:quizId", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    console.log("📊 获取测验统计:", quizId);

    // 查找测验
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    // 检查权限
    const currentUser = await User.findById(userId);
    const isCreator = quiz.creator.toString() === req.userId.toString();
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权查看此测验统计",
      });
    }

    // 获取所有答案记录
    const answers = await Answer.find({ quiz: quizId })
      .populate("user", "name email")
      .sort({ submittedAt: -1 });

    // 计算基础统计
    const totalSubmissions = answers.length;
    const averageScore =
      totalSubmissions > 0
        ? Math.round(
            answers.reduce((sum, answer) => sum + (answer.score || 0), 0) /
              totalSubmissions
          )
        : 0;

    // 完成率（提交且完成的）
    const completedSubmissions = answers.filter(
      (answer) => answer.status === "graded" || answer.status === "submitted"
    ).length;
    const completionRate =
      totalSubmissions > 0
        ? Math.round((completedSubmissions / totalSubmissions) * 100)
        : 0;

    // 分数分布
    const scoreDistribution = {
      excellent: answers.filter((a) => (a.score || 0) >= 90).length,
      good: answers.filter((a) => (a.score || 0) >= 80 && (a.score || 0) < 90)
        .length,
      average: answers.filter(
        (a) => (a.score || 0) >= 70 && (a.score || 0) < 80
      ).length,
      poor: answers.filter((a) => (a.score || 0) < 70).length,
    };

    const stats = {
      totalSubmissions,
      averageScore,
      completionRate,
      scoreDistribution,
      questionCount: quiz.questions.length,
      questions: quiz.questions.map((question, index) => ({
        index,
        type: question.type,
        question: question.question,
        points: question.points || 1,
      })),
    };

    console.log("✅ 测验统计计算完成:", stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("💥 获取测验统计失败:", error);
    res.status(500).json({
      success: false,
      error: "获取测验统计失败",
    });
  }
});

// 获取答案详情（用于统计页面）
router.get("/quiz/:quizId/answers", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const userId = req.userId;

    // 检查权限
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: "测验不存在",
      });
    }

    const currentUser = await User.findById(userId);
    const isCreator = quiz.creator.toString() === userId;
    const isAdmin = currentUser.role === "admin";

    if (!isCreator && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: "无权查看此测验答案",
      });
    }

    // 获取答案详情
    const answers = await Answer.find({ quiz: quizId })
      .populate("user", "name email")
      .select("user answers score timeSpent submittedAt status")
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: answers,
    });
  } catch (error) {
    console.error("💥 获取答案详情失败:", error);
    res.status(500).json({
      success: false,
      error: "获取答案详情失败",
    });
  }
});

// 获取教师数据分析
// 获取教师数据分析
router.get("/teacher/analytics", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.userId;
    const { range = "week" } = req.query;

    console.log("📊 获取教师数据分析:", { teacherId, range });

    // 检查权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以访问此功能",
      });
    }

    // 获取教师创建的所有测验
    const teacherQuizzes = await Quiz.find({ creator: teacherId });
    const quizIds = teacherQuizzes.map((q) => q._id);

    // 计算时间范围
    const now = new Date();
    let startDate;
    switch (range) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 获取所有答题记录
    const allAnswers = await Answer.find({
      quiz: { $in: quizIds },
      submittedAt: { $gte: startDate },
    })
      .populate("quiz", "title questions")
      .populate("user", "name");

    // 1. 基础概览统计
    const overview = {
      totalQuizzes: teacherQuizzes.length,
      totalStudents: new Set(allAnswers.map((a) => a.user._id.toString())).size,
      totalAnswers: allAnswers.length,
      averageEngagement: await (async () => {
        try {
          const totalRegisteredStudents = await User.countDocuments({
            role: "student",
          });
          const participatingStudents = new Set(
            allAnswers.map((a) => a.user._id.toString())
          ).size;
          return totalRegisteredStudents > 0
            ? Math.round(
                (participatingStudents / totalRegisteredStudents) * 100
              )
            : 0;
        } catch (error) {
          console.error("计算参与度失败:", error);
          return 0;
        }
      })(),
    };

    // 2. 算法3：成绩分布分析
    const scores = allAnswers.map((a) => a.score || 0);
    const studentPerformance = {
      excellent: scores.filter((s) => s >= 90).length,
      good: scores.filter((s) => s >= 80 && s < 90).length,
      average: scores.filter((s) => s >= 70 && s < 80).length,
      poor: scores.filter((s) => s < 70).length,
    };

    // 统计分析
    const mean =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const sortedScores = scores.sort((a, b) => a - b);
    const median =
      scores.length > 0
        ? scores.length % 2 === 0
          ? (sortedScores[scores.length / 2 - 1] +
              sortedScores[scores.length / 2]) /
            2
          : sortedScores[Math.floor(scores.length / 2)]
        : 0;
    const variance =
      scores.length > 0
        ? scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
          scores.length
        : 0;
    const standardDeviation = Math.sqrt(variance);

    // 3. 最近活动趋势
    const recentActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));

      const dayAnswers = allAnswers.filter(
        (a) =>
          new Date(a.submittedAt) >= dayStart &&
          new Date(a.submittedAt) <= dayEnd
      );

      const dayQuizzes = new Set(dayAnswers.map((a) => a.quiz._id.toString()))
        .size;
      const avgScore =
        dayAnswers.length > 0
          ? dayAnswers.reduce((sum, a) => sum + (a.score || 0), 0) /
            dayAnswers.length
          : 0;

      recentActivity.push({
        date: dayStart.toISOString().split("T")[0],
        quizzes: dayQuizzes,
        participants: dayAnswers.length,
        avgScore: Math.round(avgScore * 10) / 10,
      });
    }

    // 4. 算法1：题目难度评估和热门测验排行
    const quizAnalysis = await Promise.all(
      teacherQuizzes.map(async (quiz) => {
        const quizAnswers = allAnswers.filter(
          (a) => a.quiz._id.toString() === quiz._id.toString()
        );

        if (quizAnswers.length === 0) {
          return {
            id: quiz._id, // 确保包含ID
            _id: quiz._id, // 确保包含_ID
            title: quiz.title,
            participants: 0,
            avgScore: 0,
            difficulty: "unknown",
            difficultyScore: 0,
          };
        }

        // 计算答对率
        const totalQuestions = quiz.questions.length;
        let totalCorrect = 0;
        let totalAttempts = 0;

        quizAnswers.forEach((answer) => {
          answer.answers.forEach((ans) => {
            if (ans.questionType !== "essay") {
              totalAttempts++;
              if (ans.isCorrect) totalCorrect++;
            }
          });
        });

        const correctRate =
          totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
        const difficultyScore = 1 - correctRate;

        let difficultyLevel;
        if (difficultyScore < 0.3) difficultyLevel = "easy";
        else if (difficultyScore <= 0.7) difficultyLevel = "medium";
        else difficultyLevel = "hard";

        const avgScore =
          quizAnswers.reduce((sum, a) => sum + (a.score || 0), 0) /
          quizAnswers.length;

        return {
          id: quiz._id, // 确保包含ID
          _id: quiz._id, // 确保包含_ID
          title: quiz.title,
          participants: quizAnswers.length,
          avgScore: Math.round(avgScore * 10) / 10,
          difficulty: difficultyLevel,
          difficultyScore: Math.round(difficultyScore * 1000) / 1000,
        };
      })
    );

    const topPerformingQuizzes = quizAnalysis
      .filter((q) => q.participants > 0)
      .sort((a, b) => b.participants - a.participants)
      .slice(0, 5);

    // 5. 算法2：异常答题检测
    const anomalousAnswers = [];
    allAnswers.forEach((answer) => {
      const timeSpent = answer.timeSpent || 0;
      const score = answer.score || 0;
      const questionCount = answer.totalQuestions || 1;
      const avgTimePerQuestion = timeSpent / questionCount;

      const suspiciousReasons = [];

      if (avgTimePerQuestion < 10) {
        suspiciousReasons.push("答题速度过快");
      } else if (avgTimePerQuestion > 300) {
        suspiciousReasons.push("答题时间过长");
      }

      if (score === 100 && timeSpent < questionCount * 15) {
        suspiciousReasons.push("满分且用时极短");
      } else if (score === 0 && timeSpent > questionCount * 60) {
        suspiciousReasons.push("零分但用时很长");
      }

      if (suspiciousReasons.length > 0) {
        anomalousAnswers.push({
          studentName: answer.user.name,
          quizTitle: answer.quiz.title,
          score: score,
          timeSpent: timeSpent,
          suspiciousReasons: suspiciousReasons,
        });
      }
    });

    const analyticsResult = {
      overview,
      studentPerformance,
      recentActivity,
      topPerformingQuizzes,
      statistics: {
        mean: Math.round(mean * 10) / 10,
        median: Math.round(median * 10) / 10,
        standardDeviation: Math.round(standardDeviation * 10) / 10,
      },
      anomalousAnswers: anomalousAnswers.slice(0, 10),
      insights: [], // 前端会重新生成
    };

    console.log("✅ 教师数据分析完成:", {
      range,
      totalAnswers: allAnswers.length,
      anomalousCount: anomalousAnswers.length,
      topQuizzesCount: topPerformingQuizzes.length,
    });

    res.json({
      success: true,
      data: analyticsResult,
    });
  } catch (error) {
    console.error("💥 获取教师数据分析失败:", error);
    res.status(500).json({
      success: false,
      error: "获取分析数据失败",
    });
  }
});

// 获取全局统计（管理员专用）
router.get("/global", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    // 检查管理员权限
    const currentUser = await User.findById(userId);
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "需要管理员权限",
      });
    }

    // 获取全局统计
    const [totalUsers, totalQuizzes, totalAnswers, activeUsers] =
      await Promise.all([
        User.countDocuments(),
        Quiz.countDocuments(),
        Answer.countDocuments(),
        User.countDocuments({
          lastLogin: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30天内登录
          },
        }),
      ]);

    // 用户角色分布
    const usersByRole = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = {
      totalUsers,
      totalQuizzes,
      totalAnswers,
      activeUsers,
      usersByRole,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("💥 获取全局统计失败:", error);
    res.status(500).json({
      success: false,
      error: "获取全局统计失败",
    });
  }
});
// 导出教师数据分析报告
router.get("/teacher/export-report", authMiddleware, async (req, res) => {
  try {
    const teacherId = req.userId;
    const { range = "month" } = req.query;

    console.log("📊 导出教师数据分析报告:", { teacherId, range });

    // 检查权限
    const currentUser = await User.findById(teacherId);
    if (
      !currentUser ||
      (currentUser.role !== "teacher" && currentUser.role !== "admin")
    ) {
      return res.status(403).json({
        success: false,
        error: "只有教师可以导出报告",
      });
    }

    // 获取教师创建的所有测验
    const teacherQuizzes = await Quiz.find({ creator: teacherId });
    const quizIds = teacherQuizzes.map((q) => q._id);

    // 计算时间范围
    const now = new Date();
    let startDate;
    switch (range) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "quarter":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 获取所有答题记录
    const allAnswers = await Answer.find({
      quiz: { $in: quizIds },
      submittedAt: { $gte: startDate },
    })
      .populate("quiz", "title questions")
      .populate("user", "name email");

    // 生成Excel报告
    const XLSX = require('xlsx');
    const workbook = XLSX.utils.book_new();

    // 1. 概览数据工作表
    const overview = {
      总测验数: teacherQuizzes.length,
      参与学生数: new Set(allAnswers.map((a) => a.user._id.toString())).size,
      总答题数: allAnswers.length,
      平均分: allAnswers.length > 0 
        ? Math.round(allAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / allAnswers.length)
        : 0,
      时间范围: range === "week" ? "最近一周" : range === "month" ? "最近一月" : "最近三月",
      导出时间: now.toLocaleString('zh-CN'),
    };

    const overviewData = Object.entries(overview).map(([key, value]) => ({
      项目: key,
      数值: value,
    }));

    const overviewWS = XLSX.utils.json_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(workbook, overviewWS, "概览统计");

    // 2. 学生成绩详情工作表
    const studentDetails = allAnswers.map((answer) => ({
      学生姓名: answer.user.name,
      学生邮箱: answer.user.email,
      测验标题: answer.quiz.title,
      得分: answer.score || 0,
      正确题数: answer.correctCount || 0,
      总题数: answer.totalQuestions || 0,
      正确率: answer.totalQuestions > 0 
        ? `${Math.round((answer.correctCount / answer.totalQuestions) * 100)}%`
        : "0%",
      答题时长: `${Math.floor((answer.timeSpent || 0) / 60)}分${(answer.timeSpent || 0) % 60}秒`,
      提交时间: answer.submittedAt.toLocaleString('zh-CN'),
      状态: answer.status === "graded" ? "已完成" : 
            answer.status === "partial_graded" ? "批改中" : "已提交",
    }));

    const studentDetailsWS = XLSX.utils.json_to_sheet(studentDetails);
    XLSX.utils.book_append_sheet(workbook, studentDetailsWS, "学生成绩详情");

    // 3. 测验统计工作表
    const quizStats = await Promise.all(
      teacherQuizzes.map(async (quiz) => {
        const quizAnswers = allAnswers.filter(
          (a) => a.quiz._id.toString() === quiz._id.toString()
        );

        const avgScore = quizAnswers.length > 0
          ? Math.round(quizAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / quizAnswers.length)
          : 0;

        // 计算难度
        let totalCorrect = 0;
        let totalAttempts = 0;
        quizAnswers.forEach((answer) => {
          answer.answers.forEach((ans) => {
            if (ans.questionType !== "essay") {
              totalAttempts++;
              if (ans.isCorrect) totalCorrect++;
            }
          });
        });

        const correctRate = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;
        const difficultyScore = 1 - correctRate;
        let difficultyLevel;
        if (difficultyScore < 0.3) difficultyLevel = "简单";
        else if (difficultyScore <= 0.7) difficultyLevel = "中等";
        else difficultyLevel = "困难";

        return {
          测验标题: quiz.title,
          参与人数: quizAnswers.length,
          平均分: avgScore,
          题目数量: quiz.questions.length,
          难度等级: difficultyLevel,
          正确率: `${Math.round(correctRate * 100)}%`,
          创建时间: quiz.createdAt.toLocaleString('zh-CN'),
          状态: quiz.status === "open" ? "进行中" : 
                quiz.status === "closed" ? "已结束" : "草稿",
        };
      })
    );

    const quizStatsWS = XLSX.utils.json_to_sheet(quizStats);
    XLSX.utils.book_append_sheet(workbook, quizStatsWS, "测验统计");

    // 4. 成绩分布工作表
    const scoreRanges = {
      "90-100分(优秀)": allAnswers.filter((a) => (a.score || 0) >= 90).length,
      "80-89分(良好)": allAnswers.filter((a) => (a.score || 0) >= 80 && (a.score || 0) < 90).length,
      "70-79分(及格)": allAnswers.filter((a) => (a.score || 0) >= 70 && (a.score || 0) < 80).length,
      "0-69分(待提高)": allAnswers.filter((a) => (a.score || 0) < 70).length,
    };

    const distributionData = Object.entries(scoreRanges).map(([range, count]) => ({
      分数段: range,
      人数: count,
      占比: allAnswers.length > 0 
        ? `${Math.round((count / allAnswers.length) * 100)}%`
        : "0%",
    }));

    const distributionWS = XLSX.utils.json_to_sheet(distributionData);
    XLSX.utils.book_append_sheet(workbook, distributionWS, "成绩分布");

    // 5. 时间趋势工作表（如果有足够数据）
    if (allAnswers.length > 0) {
      const dailyStats = {};
      allAnswers.forEach((answer) => {
        const date = answer.submittedAt.toISOString().split('T')[0];
        if (!dailyStats[date]) {
          dailyStats[date] = { count: 0, totalScore: 0, scores: [] };
        }
        dailyStats[date].count++;
        dailyStats[date].totalScore += (answer.score || 0);
        dailyStats[date].scores.push(answer.score || 0);
      });

      const trendData = Object.entries(dailyStats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, stats]) => ({
          日期: date,
          答题人数: stats.count,
          平均分: Math.round(stats.totalScore / stats.count),
          最高分: Math.max(...stats.scores),
          最低分: Math.min(...stats.scores),
        }));

      const trendWS = XLSX.utils.json_to_sheet(trendData);
      XLSX.utils.book_append_sheet(workbook, trendWS, "时间趋势");
    }

    // 生成文件名
    const rangeText = range === "week" ? "周" : range === "month" ? "月" : "季度";
    const fileName = `${currentUser.name}_教学数据分析报告_${rangeText}_${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}.xlsx`;

    // 生成Excel文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);

    // 发送文件
    res.send(buffer);

    console.log("✅ 报告导出成功:", fileName);

  } catch (error) {
    console.error("💥 导出报告失败:", error);
    res.status(500).json({
      success: false,
      error: "导出报告失败: " + error.message,
    });
  }
});

console.log("✅ Stats routes loaded");
module.exports = router;
