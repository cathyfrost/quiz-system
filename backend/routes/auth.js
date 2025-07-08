// backend/routes/auth.js - MongoDB版本
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

console.log('📁 Loading auth routes with MongoDB...');

// 生成JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// 注册接口
router.post('/register', async (req, res) => {
  try {
    console.log('📝 Register request:', { 
      email: req.body.email, 
      name: req.body.name, 
      role: req.body.role 
    });
    
    const { email, password, name, role } = req.body;
    
    // 验证必填字段
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: '请提供完整信息'
      });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '密码至少需要6位'
      });
    }

    // 检查用户是否已存在
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: '该邮箱已被注册'
      });
    }

    // 创建新用户
    const newUser = new User({
      email: email.toLowerCase(),
      password, // 会在模型的pre save中间件中自动加密
      name: name.trim(),
      role: role || 'student'
    });

    await newUser.save();

    // 生成token
    const token = generateToken(newUser._id);

    console.log('✅ User registered successfully:', newUser.email);

    res.status(201).json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    
    // 处理MongoDB验证错误
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: errors.join(', ')
      });
    }
    
    // 处理重复键错误
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: '该邮箱已被注册'
      });
    }
    
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
});

// 登录接口
router.post('/login', async (req, res) => {
  try {
    console.log('🔐 Login request:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '请提供邮箱和密码'
      });
    }

    // 查找用户（包含密码字段）
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: '账户已被禁用，请联系管理员'
      });
    }

    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '邮箱或密码错误'
      });
    }

    // 更新登录信息
    await user.updateLoginInfo();

    // 生成token
    const token = generateToken(user._id);

    console.log('✅ User logged in successfully:', user.email);

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        lastLogin: user.lastLogin,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: '服务器错误，请稍后重试'
    });
  }
});

// 获取用户信息（需要认证）
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile: user.profile,
        learningStats: user.learningStats,
        teachingStats: user.teachingStats,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败'
    });
  }
});

// 更新用户资料
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, profile } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 更新用户信息
    if (name) user.name = name.trim();
    if (profile) {
      user.profile = { ...user.profile, ...profile };
    }

    await user.save();

    res.json({
      success: true,
      message: '资料更新成功',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: '更新资料失败'
    });
  }
});

// 修改密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: '请提供当前密码和新密码'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: '新密码至少需要6位'
      });
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 验证当前密码
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: '当前密码错误'
      });
    }

    // 更新密码
    user.password = newPassword; // 会在pre save中间件中自动加密
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: '密码修改失败'
    });
  }
});

// 获取用户统计（管理员）
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // 检查管理员权限
    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: '权限不足'
      });
    }

    const stats = await User.getUserStats();
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        usersByRole: stats,
        recentUsers
      }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: '获取统计数据失败'
    });
  }
});

// 搜索用户（教师和管理员）
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, role, page = 1, limit = 10 } = req.query;
    
    // 检查权限
    const currentUser = await User.findById(req.userId);
    if (!currentUser || !['teacher', 'admin'].includes(currentUser.role)) {
      return res.status(403).json({
        success: false,
        error: '权限不足'
      });
    }

    const query = {};
    
    // 搜索条件
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (role) {
      query.role = role;
    }

    const skip = (page - 1) * limit;
    const users = await User.find(query)
      .select('name email role status createdAt lastLogin')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: skip + limit < total
        }
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: '搜索用户失败'
    });
  }
});

console.log('✅ Auth routes loaded with MongoDB');
module.exports = router;