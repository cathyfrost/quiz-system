// backend/models/User.js - 增强版本
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  profile: {
    avatar: {
      type: String, // 头像URL
      default: ''
    },
    bio: {
      type: String,
      maxlength: 500
    },
    phone: {
      type: String,
      match: [/^[1-9]\d{10}$/, '请输入有效的手机号码']
    },
    school: {
      type: String,
      maxlength: 100
    },
    grade: {
      type: String,
      maxlength: 50
    }
  },
  // 用户状态
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  // 邮箱验证
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String
  },
  // 密码重置
  passwordResetToken: {
    type: String
  },
  passwordResetExpires: {
    type: Date
  },
  // 登录信息
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  // 学习统计（针对学生）
  learningStats: {
    totalQuizzesTaken: {
      type: Number,
      default: 0
    },
    totalTimeSpent: {
      type: Number,
      default: 0 // 分钟
    },
    averageScore: {
      type: Number,
      default: 0
    },
    bestScore: {
      type: Number,
      default: 0
    },
    lastQuizAt: {
      type: Date
    }
  },
  // 教学统计（针对教师）
  teachingStats: {
    totalQuizzesCreated: {
      type: Number,
      default: 0
    },
    totalStudents: {
      type: Number,
      default: 0
    },
    averageStudentScore: {
      type: Number,
      default: 0
    },
    lastQuizCreatedAt: {
      type: Date
    }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// 索引优化
userSchema.index({ email: 1 });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ createdAt: -1 });

// 虚拟字段
userSchema.virtual('fullProfile').get(function() {
  return {
    ...this.profile,
    name: this.name,
    email: this.email,
    role: this.role
  };
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  // 只在密码被修改时才加密
  if (!this.isModified('password')) return next();
  
  try {
    // 生成盐并加密密码
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 实例方法：验证密码
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('密码验证失败');
  }
};

// 实例方法：更新登录信息
userSchema.methods.updateLoginInfo = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

// 实例方法：生成密码重置token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10分钟后过期
  
  return resetToken;
};

// 实例方法：更新学习统计
userSchema.methods.updateLearningStats = function(quizResult) {
  if (this.role !== 'student') return;
  
  this.learningStats.totalQuizzesTaken += 1;
  this.learningStats.totalTimeSpent += quizResult.timeSpent || 0;
  this.learningStats.lastQuizAt = new Date();
  
  // 更新平均分
  const currentAvg = this.learningStats.averageScore || 0;
  const totalQuizzes = this.learningStats.totalQuizzesTaken;
  this.learningStats.averageScore = Math.round(
    ((currentAvg * (totalQuizzes - 1)) + quizResult.score) / totalQuizzes
  );
  
  // 更新最高分
  if (quizResult.score > this.learningStats.bestScore) {
    this.learningStats.bestScore = quizResult.score;
  }
  
  return this.save();
};

// 实例方法：更新教学统计
userSchema.methods.updateTeachingStats = function() {
  if (this.role !== 'teacher') return;
  
  this.teachingStats.totalQuizzesCreated += 1;
  this.teachingStats.lastQuizCreatedAt = new Date();
  
  return this.save();
};

// 静态方法：按角色查找用户
userSchema.statics.findByRole = function(role, active = true) {
  const query = { role };
  if (active) {
    query.status = 'active';
  }
  return this.find(query).sort({ createdAt: -1 });
};

// 静态方法：查找活跃用户
userSchema.statics.findActiveUsers = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ lastLogin: -1 })
    .limit(limit)
    .select('name email role lastLogin');
};

// 静态方法：获取用户统计
userSchema.statics.getUserStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: {
          $sum: {
            $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('User', userSchema);