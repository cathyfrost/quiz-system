// backend/app.js - 添加批改功能路由
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

// 加载环境变量
dotenv.config();

const app = express();

console.log("🚀 Starting Quiz System Backend with MongoDB and Grading...");

// 中间件
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;

  console.log(`${timestamp} - ${method} ${url} - ${ip}`);
  next();
});

// 连接MongoDB
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/quiz-system";

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(mongoURI, options);
    console.log("✅ Connected to MongoDB successfully");

    // 监听连接事件
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
};

// 初始化数据库连接
connectDB();

// 创建默认账户和示例数据
const createDefaultData = async () => {
  try {
    if (process.env.NODE_ENV === "development") {
      const User = require("./models/User");
      const Quiz = require("./models/Quiz");

      // 创建管理员账户
      // const adminExists = await User.findOne({ email: "admin@test.com" });
      // if (!adminExists) {
      //   const admin = new User({
      //     email: "admin@test.com",
      //     password: "admin123",
      //     name: "系统管理员",
      //     role: "admin",
      //   });
      //   await admin.save();
      //   console.log("✅ Default admin created: admin@test.com / admin123");
      // }

      // 创建测试教师账户
      let teacher;
      const teacherExists = await User.findOne({ email: "teacher@test.com" });
      if (!teacherExists) {
        teacher = new User({
          email: "teacher@test.com",
          password: "123456",
          name: "测试教师",
          role: "teacher",
        });
        await teacher.save();
        console.log("✅ Default teacher created: teacher@test.com / 123456");
      } else {
        teacher = teacherExists;
      }

      // 创建测试学生账户
      const studentExists = await User.findOne({ email: "student@test.com" });
      if (!studentExists) {
        const student = new User({
          email: "student@test.com",
          password: "123456",
          name: "测试学生",
          role: "student",
        });
        await student.save();
        console.log("✅ Default student created: student@test.com / 123456");
      }

      // 创建示例测验（包含解答题）
      const sampleQuizExists = await Quiz.findOne({
        title: "综合能力测试（含解答题）",
      });
      if (!sampleQuizExists && teacher) {
        const sampleQuiz = new Quiz({
          title: "综合能力测试（含解答题）",
          description: "这是一个包含选择题、判断题和解答题的综合测试",
          creator: teacher._id,
          status: "open",
          questions: [
            {
              type: "single",
              question: "以下哪个是JavaScript的正确变量声明方式？",
              options: [
                "var x = 10;",
                "variable x = 10;",
                "declare x = 10;",
                "int x = 10;",
              ],
              correctAnswer: "var x = 10;",
              points: 2,
            },
            {
              type: "boolean",
              question: "HTML是一种编程语言",
              correctAnswer: "false",
              points: 2,
            },
            {
              type: "multiple",
              question: "以下哪些是前端开发技术？",
              options: ["HTML", "CSS", "JavaScript", "Python", "React"],
              correctAnswer: "HTML,CSS,JavaScript,React",
              points: 3,
            },
            {
              type: "essay",
              question: "请简述什么是响应式网页设计，并说明其重要性。",
              points: 8,
              essayConfig: {
                minWords: 100,
                maxWords: 500,
                allowAttachments: false,
                rubric:
                  "评分标准：1. 概念理解正确（3分）2. 重要性阐述清晰（3分）3. 语言表达流畅（2分）",
                sampleAnswer:
                  "响应式网页设计是一种网页设计方法，使网页能够在不同设备和屏幕尺寸上提供良好的用户体验。它通过使用流体网格、弹性图片和CSS媒体查询等技术，让网页布局能够根据访问设备的屏幕大小自动调整。响应式设计的重要性体现在：1. 提升用户体验 2. 降低开发成本 3. 有利于SEO优化 4. 适应移动互联网趋势。",
              },
            },
            {
              type: "essay",
              question: "请描述你对未来Web开发技术发展趋势的看法，并举例说明。",
              points: 10,
              essayConfig: {
                minWords: 200,
                maxWords: 800,
                allowAttachments: true,
                rubric:
                  "评分标准：1. 趋势分析准确（4分）2. 举例恰当（3分）3. 逻辑清晰（2分）4. 创新见解（1分）",
                sampleAnswer:
                  "未来Web开发技术发展趋势主要包括：1. AI与Web的深度融合，如智能代码生成、自动化测试等；2. WebAssembly的普及，使高性能应用在浏览器中运行成为可能；3. Progressive Web Apps(PWA)技术成熟，模糊Web应用与原生应用的界限；4. 无服务器架构(Serverless)的广泛应用，简化后端开发；5. 边缘计算与CDN的结合，提升用户体验。举例：GitHub Copilot展示了AI辅助编程的潜力，Figma使用WebAssembly实现了复杂的图形处理功能，Twitter的PWA版本提供了接近原生应用的体验。",
              },
            },
          ],
          settings: {
            timeLimit: 60,
            allowMultipleAttempts: false,
            showResultsImmediately: false, // 包含解答题，不立即显示结果
            showCorrectAnswers: false,
            requiresManualGrading: true, // 需要人工批改
          },
        });
        await sampleQuiz.save();
        console.log("✅ Sample quiz with essay questions created");
      }
    }
  } catch (error) {
    console.error("创建默认数据失败:", error);
  }
};

// 延迟创建默认数据，确保数据库连接已建立
setTimeout(createDefaultData, 3000);

// 引入路由
const authRoutes = require("./routes/auth");
const quizRoutes = require("./routes/quiz");
const gradingRoutes = require("./routes/grading");
const statsRoutes = require("./routes/stats");

// 注册路由
app.use("/api/auth", authRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/grading", gradingRoutes);
app.use("/api/stats", statsRoutes);

// 安全中间件
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// 健康检查
app.get("/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatusMap[dbStatus],
      name: mongoose.connection.name || "quiz-system",
    },
    version: process.env.npm_package_version || "2.0.0",
    environment: process.env.NODE_ENV || "development",
    features: [
      "MongoDB Database",
      "JWT Authentication",
      "Quiz Management",
      "Essay Question Grading", // 新功能
      "Real-time Statistics",
    ],
  });
});

// 根路由
app.get("/", (req, res) => {
  res.json({
    message: "🎉 Quiz System API with Essay Grading",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
    status: "OK",
    database: "MongoDB",
    endpoints: {
      auth: "/api/auth",
      quiz: "/api/quiz",
      grading: "/api/grading", // 新增
      health: "/health",
    },
    features: {
      "Multiple Question Types": "Single, Multiple, Boolean, Essay",
      "Automatic Grading": "Objective questions graded instantly",
      "Manual Grading": "Essay questions require teacher review",
      "Real-time Statistics": "Live grading progress tracking",
      "User Management": "Teachers, Students, Admins",
    },
  });
});

// API文档路由
app.get("/api", (req, res) => {
  res.json({
    name: "Quiz System API",
    version: "2.1.0",
    description: "QuizPilot REST API - 支持解答题批改",
    endpoints: {
      authentication: {
        "POST /api/auth/register": "用户注册",
        "POST /api/auth/login": "用户登录",
        "GET /api/auth/me": "获取当前用户信息",
        "PUT /api/auth/profile": "更新用户资料",
        "PUT /api/auth/password": "修改密码",
      },
      quizzes: {
        "GET /api/quiz": "获取测验列表",
        "POST /api/quiz/create": "创建测验",
        "GET /api/quiz/detail": "获取测验详情",
        "PUT /api/quiz/:id": "更新测验",
        "DELETE /api/quiz/:id": "删除测验",
        "PUT /api/quiz/:id/status": "更新测验状态",
        "POST /api/quiz/submit": "提交答案",
      },
      grading: {
        "GET /api/grading/pending": "获取待批改列表",
        "GET /api/grading/detail/:answerId": "获取批改详情",
        "POST /api/grading/grade-essay": "批改解答题",
        "POST /api/grading/grade-batch": "批量批改",
        "GET /api/grading/stats": "获取批改统计",
        "GET /api/grading/history": "获取批改历史",
      },
    },
    questionTypes: {
      single: "单选题 - 自动批改",
      multiple: "多选题 - 自动批改",
      boolean: "判断题 - 自动批改",
      essay: "解答题 - 需要教师批改",
    },
  });
});

// 404处理
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    path: req.originalUrl,
    method: req.method,
    suggestion: "Check the API documentation at /api",
  });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error("🚨 Global Error Handler:", err);

  // MongoDB错误处理
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: errors,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: "Invalid ID format",
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: "Duplicate entry",
      field: Object.keys(err.keyPattern)[0],
    });
  }

  // JWT错误
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      error: "Token expired",
    });
  }

  // 默认错误
  res.status(err.statusCode || 500).json({
    success: false,
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log("\n🎉 ================================");
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`❤️ Health: http://localhost:${PORT}/health`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api`);
  console.log(`🗄️ Database: MongoDB`);
  console.log(`✏️ Features: Essay Question Grading`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("🎉 ================================\n");
});

// 优雅关闭
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

  server.close(() => {
    console.log("📡 HTTP server closed");

    mongoose.connection.close(() => {
      console.log("🗄️ MongoDB connection closed");
      console.log("✅ Process terminated gracefully");
      process.exit(0);
    });
  });

  setTimeout(() => {
    console.error("⚠️ Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  console.error("🚨 Unhandled Rejection:", err);
  gracefulShutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (err) => {
  console.error("🚨 Uncaught Exception:", err);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

module.exports = app;
