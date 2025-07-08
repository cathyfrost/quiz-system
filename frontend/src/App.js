// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/Auth/AuthPage';
import MainLayout from './components/Layout/MainLayout';
import TeacherDashboard from './components/Dashboard/TeacherDashboard';
import StudentDashboard from './components/Dashboard/StudentDashboard';
import QuizList from './components/QuizManagement/QuizList';
import QuizEditor from './components/QuizEditor/QuizEditor';
import QuizInterface from './components/TakeQuiz/QuizInterface';
import GradingInterface from './components/Grading/GradingInterface';
import AnalyticsPage from './components/Analytics/AnalyticsPage';
import MyResults from './components/StudentResults/MyResults';
import './App.css';

// 主应用内容组件
const AppContent = () => {
  const { isAuthenticated, user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingQuizId, setEditingQuizId] = useState(null);
  const [takingQuizId, setTakingQuizId] = useState(null);

  // 👥 用户状态变化时重置界面状态
  useEffect(() => {
    if (user) {
      console.log('👤 用户状态变化，重置界面:', user.role);
      
      // 重置到仪表板
      setActiveTab('dashboard');
      setEditingQuizId(null);
      setTakingQuizId(null);
      
      // 如果是学生登录，确保不会停留在教师专用功能页面
      if (user.role === 'student') {
        const studentAllowedTabs = ['dashboard', 'quizzes', 'my-results', 'take-quiz'];
        if (!studentAllowedTabs.includes(activeTab)) {
          console.log('🔄 学生用户，切换到仪表板');
          setActiveTab('dashboard');
        }
      }
      
      // 如果是教师登录，确保不会停留在学生专用功能页面
      if (user.role === 'teacher') {
        const teacherAllowedTabs = ['dashboard', 'quizzes', 'create-quiz', 'edit-quiz', 'grading', 'analytics'];
        if (!teacherAllowedTabs.includes(activeTab)) {
          console.log('🔄 教师用户，切换到仪表板');
          setActiveTab('dashboard');
        }
      }
    } else {
      // 用户退出登录时重置所有状态
      console.log('🚪 用户退出，重置所有状态');
      setActiveTab('dashboard');
      setEditingQuizId(null);
      setTakingQuizId(null);
    }
  }, [user]); // 监听用户状态变化

  // 加载状态
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    );
  }

  // 未登录显示认证页面
  if (!isAuthenticated()) {
    return <AuthPage />;
  }

  console.log('🎯 当前用户:', user);
  console.log('📱 当前标签页:', activeTab);

  // 处理测验编辑
  const handleEditQuiz = (quizId) => {
    console.log('✏️ 编辑测验:', quizId);
    setEditingQuizId(quizId);
    setActiveTab('edit-quiz');
  };

  // 处理开始答题
  const handleTakeQuiz = (quizId) => {
    console.log('🚀 开始答题，测验ID:', quizId);
    setTakingQuizId(quizId);
    setActiveTab('take-quiz');
  };

  // 处理测验保存
  const handleQuizSave = (savedQuiz) => {
    console.log('💾 测验保存成功:', savedQuiz);
    setEditingQuizId(null);
    setActiveTab('quizzes'); // 返回测验列表
  };

  // 处理取消编辑
  const handleCancelEdit = () => {
    console.log('❌ 取消编辑测验');
    setEditingQuizId(null);
    setActiveTab('quizzes'); // 返回测验列表
  };

  // 处理答题完成
  const handleQuizComplete = () => {
    console.log('✅ 答题完成');
    setTakingQuizId(null);
    setActiveTab('quizzes'); // 返回测验列表
  };

  // 处理返回操作
  const handleBack = (targetTab = 'quizzes') => {
    console.log('⬅️ 返回到:', targetTab);
    setTakingQuizId(null);
    setEditingQuizId(null);
    setActiveTab(targetTab);
  };

  // 处理创建测验
  const handleCreateQuiz = () => {
    console.log('➕ 创建新测验');
    setActiveTab('create-quiz');
  };

  // 处理进入批改页面
  const handleGrading = () => {
    console.log('✏️ 进入批改页面');
    setActiveTab('grading');
  };

  // 处理查看测验
  const handleViewQuiz = (quizId) => {
    console.log('👀 查看测验:', quizId);
    // 可以跳转到测验详情页面或统计页面
    setActiveTab('quizzes'); // 暂时返回列表
  };

  // 处理查看结果
  const handleViewResult = (resultId) => {
    console.log('📊 查看成绩:', resultId);
    setActiveTab('my-results');
  };

  // 处理标签页切换 - 添加权限检查
  const handleTabChange = (tab) => {
    console.log('🔄 标签页切换:', activeTab, '->', tab);
    
    // 检查用户权限
    if (user?.role === 'student') {
      const studentAllowedTabs = ['dashboard', 'quizzes', 'my-results'];
      if (!studentAllowedTabs.includes(tab) && tab !== 'take-quiz') {
        console.warn('⚠️ 学生用户尝试访问受限功能:', tab);
        return; // 阻止切换
      }
    }
    
    if (user?.role === 'teacher') {
      const teacherRestrictedTabs = ['my-results', 'take-quiz'];
      if (teacherRestrictedTabs.includes(tab)) {
        console.warn('⚠️ 教师用户尝试访问学生功能:', tab);
        return; // 阻止切换
      }
    }
    
    setActiveTab(tab);
    // 切换标签页时清理状态
    if (tab !== 'edit-quiz') setEditingQuizId(null);
    if (tab !== 'take-quiz') setTakingQuizId(null);
  };

  // 根据当前选中的标签渲染对应内容
  const renderContent = () => {
    console.log('🎨 渲染内容，当前标签:', activeTab, '用户角色:', user?.role);
    
    switch (activeTab) {
      case 'dashboard':
        console.log('📊 渲染仪表板');
        return user?.role === 'teacher' ? (
          <TeacherDashboard 
            onCreateQuiz={handleCreateQuiz}
            onEditQuiz={handleEditQuiz}
            onViewQuiz={handleViewQuiz}
            onGrading={handleGrading}
          />
        ) : (
          <StudentDashboard 
            onTakeQuiz={handleTakeQuiz}
            onViewResult={handleViewResult}
          />
        );
      
      case 'quizzes':
        console.log('📝 渲染测验列表');
        return (
          <QuizList 
            onEditQuiz={handleEditQuiz}
            onCreateQuiz={handleCreateQuiz}
            onTakeQuiz={handleTakeQuiz}
          />
        );
      
      case 'create-quiz':
        console.log('🆕 渲染创建测验');
        // 只有教师可以创建测验
        if (user?.role !== 'teacher' && user?.role !== 'admin') {
          return <AnalyticsPage />;
        }
        return (
          <QuizEditor
            quizId={null} // 新建测验
            onSave={handleQuizSave}
            onCancel={() => handleBack('quizzes')}
          />
        );
      
      case 'edit-quiz':
        console.log('✏️ 渲染编辑测验:', editingQuizId);
        // 只有教师可以编辑测验
        if (user?.role !== 'teacher' && user?.role !== 'admin') {
          return (
            <div className="page-content">
              <h1>权限不足</h1>
              <div className="placeholder-content">
                <div className="placeholder-icon">🚫</div>
                <h3>访问被拒绝</h3>
                <p>只有教师可以编辑测验</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleBack('dashboard')}
                >
                  返回仪表板
                </button>
              </div>
            </div>
          );
        }
        return (
          <QuizEditor
            quizId={editingQuizId}
            onSave={handleQuizSave}
            onCancel={handleCancelEdit}
          />
        );

      case 'take-quiz':
        console.log('🎯 渲染答题界面:', takingQuizId);
        // 学生答题界面
        if (user?.role === 'student' && takingQuizId) {
          return (
            <QuizInterface
              quizId={takingQuizId}
              onComplete={handleQuizComplete}
              onBack={() => handleBack('quizzes')}
            />
          );
        } else {
          console.warn('⚠️ 无效的答题请求');
          return (
            <div className="page-content">
              <h1>权限不足</h1>
              <div className="placeholder-content">
                <div className="placeholder-icon">🚫</div>
                <h3>访问被拒绝</h3>
                <p>无效的答题请求</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleBack('quizzes')}
                >
                  返回测验列表
                </button>
              </div>
            </div>
          );
        }

      case 'grading':
        console.log('✏️ 渲染批改界面');
        // 只有教师可以访问批改功能
        if (user?.role === 'teacher' || user?.role === 'admin') {
          return <GradingInterface />;
        } else {
          console.warn('⚠️ 非教师尝试访问批改功能，用户角色:', user?.role);
          // 学生误入批改页面时，自动跳转到仪表板
          setTimeout(() => {
            console.log('🔄 自动跳转到仪表板');
            setActiveTab('dashboard');
          }, 2000);
          
          return (
            <div className="page-content">
              <h1>权限不足</h1>
              <div className="placeholder-content">
                <div className="placeholder-icon">🚫</div>
                <h3>访问被拒绝</h3>
                <p>只有教师可以访问批改功能</p>
                <p style={{ color: '#8c8c8c', fontSize: '14px' }}>正在为您跳转到仪表板...</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setActiveTab('dashboard')}
                >
                  立即返回仪表板
                </button>
              </div>
            </div>
          );
        }
      
        case 'my-results':
          console.log('📈 渲染我的成绩');
          // 只有学生可以查看个人成绩
          if (user?.role !== 'student') {
            return (
              <div className="page-content">
                <h1>权限不足</h1>
                <div className="placeholder-content">
                  <div className="placeholder-icon">🚫</div>
                  <h3>访问被拒绝</h3>
                  <p>只有学生可以查看个人成绩</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleBack('dashboard')}
                  >
                    返回仪表板
                  </button>
                </div>
              </div>
            );
          }
          return <MyResults />;
      
        case 'analytics':
          console.log('📊 渲染数据分析');
          // 只有教师可以查看数据分析
          if (user?.role !== 'teacher' && user?.role !== 'admin') {
            return (
              <div className="page-content">
                <h1>权限不足</h1>
                <div className="placeholder-content">
                  <div className="placeholder-icon">🚫</div>
                  <h3>访问被拒绝</h3>
                  <p>只有教师可以查看数据分析</p>
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleBack('dashboard')}
                  >
                    返回仪表板
                  </button>
                </div>
              </div>
            );
          }
          return <AnalyticsPage />;
      
      default:
        console.warn('❓ 未知的标签页:', activeTab);
        return (
          <div className="page-content">
            <h1>页面未找到</h1>
            <div className="placeholder-content">
              <div className="placeholder-icon">🔍</div>
              <h3>页面不存在</h3>
              <p>请检查URL或使用导航菜单</p>
              <button 
                className="btn btn-primary"
                onClick={() => setActiveTab('dashboard')}
              >
                返回首页
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <MainLayout 
      activeTab={activeTab} 
      onTabChange={handleTabChange}
    >
      {renderContent()}
    </MainLayout>
  );
};

// 主App组件
const App = () => {
  console.log('🚀 App 组件启动');
  
  return (
    <AuthProvider>
      <div className="app">
        <AppContent />
      </div>
    </AuthProvider>
  );
};

export default App;