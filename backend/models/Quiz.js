// backend/models/Quiz.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['single', 'multiple', 'boolean', 'essay'], // 添加essay类型
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  options: [{
    type: String,
    trim: true
  }],
  correctAnswer: {
    type: String,
    required: function() {
      // 解答题不需要设置正确答案
      return this.type !== 'essay';
    }
  },
  // 解答题特有字段
  essayConfig: {
    maxWords: {
      type: Number,
      default: 500 // 最大字数限制
    },
    minWords: {
      type: Number,
      default: 50 // 最小字数要求
    },
    allowAttachments: {
      type: Boolean,
      default: false // 是否允许上传附件
    },
    rubric: {
      type: String, // 评分标准
      trim: true
    },
    sampleAnswer: {
      type: String, // 参考答案
      trim: true
    }
  },
  points: {
    type: Number,
    default: 1,
    min: 1
  },
  // 题目顺序
  order: {
    type: Number,
    default: 0
  }
}, {
  _id: false
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'closed'],
    default: 'draft'
  },
  questions: [questionSchema],
  settings: {
    timeLimit: {
      type: Number,
      default: 0,
      min: 0
    },
    allowMultipleAttempts: {
      type: Boolean,
      default: false
    },
    showResultsImmediately: {
      type: Boolean,
      default: true
    },
    showCorrectAnswers: {
      type: Boolean,
      default: false
    },
    openAt: {
      type: Date
    },
    closeAt: {
      type: Date
    },
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    shuffleOptions: {
      type: Boolean,
      default: false
    },
    // 解答题相关设置
    autoGrading: {
      type: Boolean,
      default: true // 如果包含解答题则自动设为false
    },
    requiresManualGrading: {
      type: Boolean,
      default: false // 是否需要人工批改
    }
  },
  // 统计信息
  statistics: {
    totalSubmissions: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    lastSubmissionAt: {
      type: Date
    },
    pendingGrading: {
      type: Number,
      default: 0 // 待批改数量
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟字段：题目数量
quizSchema.virtual('questionCount').get(function() {
  return this.questions.length;
});

// 虚拟字段：总分
quizSchema.virtual('totalPoints').get(function() {
  return this.questions.reduce((sum, q) => sum + (q.points || 1), 0);
});

// 虚拟字段：是否包含解答题
quizSchema.virtual('hasEssayQuestions').get(function() {
  return this.questions.some(q => q.type === 'essay');
});

// 虚拟字段：客观题数量
quizSchema.virtual('objectiveQuestionCount').get(function() {
  return this.questions.filter(q => q.type !== 'essay').length;
});

// 虚拟字段：解答题数量
quizSchema.virtual('essayQuestionCount').get(function() {
  return this.questions.filter(q => q.type === 'essay').length;
});

// 索引优化
quizSchema.index({ creator: 1, status: 1 });
quizSchema.index({ status: 1, createdAt: -1 });
quizSchema.index({ title: 'text', description: 'text' });
quizSchema.index({ 'settings.requiresManualGrading': 1 });

// 中间件：保存前验证和设置
quizSchema.pre('save', function(next) {
  // 验证题目
  if (this.questions.length === 0) {
    return next(new Error('测验必须包含至少一道题目'));
  }

  // 检查是否包含解答题
  const hasEssayQuestions = this.questions.some(q => q.type === 'essay');
  
  // 如果包含解答题，更新相关设置
  if (hasEssayQuestions) {
    this.settings.requiresManualGrading = true;
    this.settings.autoGrading = false;
    // 包含解答题时，不能立即显示结果
    this.settings.showResultsImmediately = false;
  } else {
    this.settings.requiresManualGrading = false;
    this.settings.autoGrading = true;
  }

  // 验证每个题目
  for (let i = 0; i < this.questions.length; i++) {
    const question = this.questions[i];
    
    if (!question.question.trim()) {
      return next(new Error(`第${i + 1}题的题目内容不能为空`));
    }
    
    // 非解答题和判断题需要验证选项
    if (question.type !== 'essay' && question.type !== 'boolean') {
      if (!question.options || question.options.length < 2) {
        return next(new Error(`第${i + 1}题至少需要2个选项`));
      }
      
      const emptyOptions = question.options.filter(opt => !opt.trim());
      if (emptyOptions.length > 0) {
        return next(new Error(`第${i + 1}题存在空选项`));
      }
    }
    
    // 解答题特殊验证
    if (question.type === 'essay') {
      if (question.essayConfig) {
        if (question.essayConfig.minWords > question.essayConfig.maxWords) {
          return next(new Error(`第${i + 1}题最小字数不能大于最大字数`));
        }
      }
    } else {
      // 非解答题需要正确答案
      if (!question.correctAnswer) {
        return next(new Error(`第${i + 1}题未设置正确答案`));
      }
    }

    // 设置题目顺序
    question.order = i;
  }

  // 验证时间设置
  if (this.settings.openAt && this.settings.closeAt) {
    if (this.settings.openAt >= this.settings.closeAt) {
      return next(new Error('开始时间必须早于结束时间'));
    }
  }

  next();
});

// 静态方法：查找需要批改的测验
quizSchema.statics.findPendingGrading = function(teacherId) {
  return this.aggregate([
    {
      $match: {
        creator: mongoose.Types.ObjectId(teacherId),
        'settings.requiresManualGrading': true,
        'statistics.pendingGrading': { $gt: 0 }
      }
    },
    {
      $lookup: {
        from: 'answers',
        localField: '_id',
        foreignField: 'quiz',
        as: 'pendingAnswers',
        pipeline: [
          {
            $match: {
              status: { $in: ['submitted', 'partial_graded'] }
            }
          }
        ]
      }
    },
    {
      $project: {
        title: 1,
        'statistics.pendingGrading': 1,
        pendingCount: { $size: '$pendingAnswers' },
        createdAt: 1
      }
    },
    {
      $sort: { 'statistics.lastSubmissionAt': -1 }
    }
  ]);
};

// 实例方法：获取题目类型统计
quizSchema.methods.getQuestionTypeStats = function() {
  const stats = {
    single: 0,
    multiple: 0,
    boolean: 0,
    essay: 0,
    total: this.questions.length
  };

  this.questions.forEach(q => {
    if (stats.hasOwnProperty(q.type)) {
      stats[q.type]++;
    }
  });

  return stats;
};

// 实例方法：获取批改进度
quizSchema.methods.getGradingProgress = async function() {
  const Answer = mongoose.model('Answer');
  
  const totalSubmissions = await Answer.countDocuments({ quiz: this._id });
  const gradedSubmissions = await Answer.countDocuments({ 
    quiz: this._id, 
    status: 'graded' 
  });
  const pendingSubmissions = totalSubmissions - gradedSubmissions;

  return {
    total: totalSubmissions,
    graded: gradedSubmissions,
    pending: pendingSubmissions,
    progress: totalSubmissions > 0 ? Math.round((gradedSubmissions / totalSubmissions) * 100) : 0
  };
};

module.exports = mongoose.model('Quiz', quizSchema);