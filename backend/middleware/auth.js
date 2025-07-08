// backend/middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// JWT认证中间件
const authMiddleware = async (req, res, next) => {
  try {
    // 从请求头获取token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "请提供有效的认证令牌",
      });
    }

    const token = authHeader.split(" ")[1];

    // 验证token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    // 查找用户
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "用户不存在",
      });
    }

    // 检查用户状态
    if (user.status !== "active") {
      return res.status(401).json({
        success: false,
        error: "账户已被禁用",
      });
    }

    // 将用户信息添加到请求对象
    req.userId = user._id;
    req.user = user;

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        error: "无效的认证令牌",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        error: "认证令牌已过期",
      });
    }

    res.status(500).json({
      success: false,
      error: "认证失败",
    });
  }
};

// 角色验证中间件
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "未认证",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "权限不足",
      });
    }

    next();
  };
};

// 检查是否为资源所有者或管理员
const requireOwnershipOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: "未认证",
        });
      }

      // 管理员可以访问所有资源
      if (req.user.role === "admin") {
        return next();
      }

      // 获取资源的用户ID
      const resourceUserId = await getResourceUserId(req);

      // 检查是否为资源所有者
      if (req.user._id.toString() === resourceUserId.toString()) {
        return next();
      }

      res.status(403).json({
        success: false,
        error: "无权访问此资源",
      });
    } catch (error) {
      console.error("Ownership check error:", error);
      res.status(500).json({
        success: false,
        error: "权限检查失败",
      });
    }
  };
};

// 可选认证中间件（用于公开接口但需要用户信息的场景）
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(); // 没有token，继续执行但不设置用户信息
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );
    const user = await User.findById(decoded.userId).select("-password");

    if (user && user.status === "active") {
      req.userId = user._id;
      req.user = user;
    }

    next();
  } catch (error) {
    // 忽略认证错误，继续执行
    next();
  }
};

// 速率限制中间件（简单版本）
const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const clients = new Map();

  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!clients.has(clientId)) {
      clients.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const client = clients.get(clientId);

    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
      return next();
    }

    if (client.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: "请求过于频繁，请稍后再试",
      });
    }

    client.count++;
    next();
  };
};

module.exports = {
  authMiddleware,
  requireRole,
  requireOwnershipOrAdmin,
  optionalAuth,
  rateLimit,
};
