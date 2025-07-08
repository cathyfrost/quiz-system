// frontend/src/components/Layout/MainLayout.js - 修复批改功能导航
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Layout.css';

const Header = () => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
  };

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="app-title">🎯 QuizPilot</h1>
        </div>
        
        <div className="header-right">
          <div className="user-section">
            <span className="user-greeting">
              欢迎，{user?.name}
            </span>
            <div className="user-menu-container">
              <button 
                className="user-avatar"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                {user?.role === 'teacher' ? '👨‍🏫' : user?.role === 'admin' ? '👨‍💼' : '👨‍🎓'}
              </button>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <div className="user-name">{user?.name}</div>
                    <div className="user-role">
                      {user?.role === 'teacher' ? '教师' : user?.role === 'admin' ? '管理员' : '学生'}
                    </div>
                    <div className="user-email">{user?.email}</div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button 
                    className="dropdown-item logout-button"
                    onClick={handleLogout}
                  >
                    🚪 退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const Sidebar = ({ activeTab, onTabChange }) => {
  const { user, apiCall } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // 获取待批改数量（仅教师）
  useEffect(() => {
    if (user?.role === 'teacher') {
      loadPendingCount();
      // 每30秒刷新一次待批改数量
      const interval = setInterval(loadPendingCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadPendingCount = async () => {
    try {
      console.log('🔔 获取待批改数量...');
      const response = await apiCall('/grading/stats');
      if (response.success) {
        const count = response.data.overview.pendingGrading || 0;
        setPendingCount(count);
        console.log('📊 待批改数量:', count);
      }
    } catch (error) {
      console.error('❌ 获取待批改数量失败:', error);
    }
  };

  const menuItems = [
    {
      id: 'dashboard',
      icon: '📊',
      label: '仪表板',
      roles: ['teacher', 'student', 'admin']
    },
    {
      id: 'quizzes',
      icon: '📝',
      label: '测验列表',
      roles: ['teacher', 'student', 'admin']
    },
    {
      id: 'create-quiz',
      icon: '➕',
      label: '创建测验',
      roles: ['teacher', 'admin']
    },
    {
      id: 'grading',
      icon: '✏️',
      label: '批改答卷',
      roles: ['teacher', 'admin'],
      badge: pendingCount > 0 ? pendingCount : null,
      badgeType: 'urgent'
    },
    {
      id: 'my-results',
      icon: '📈',
      label: '我的成绩',
      roles: ['student']
    },
    {
      id: 'analytics',
      icon: '📊',
      label: '数据分析',
      roles: ['teacher', 'admin']
    }
  ];

  const visibleItems = menuItems.filter(item => 
    item.roles.includes(user?.role)
  );

  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        {visibleItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => {
              console.log('🔄 切换导航标签:', item.id);
              onTabChange(item.id);
            }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {item.badge && (
              <span className={`nav-badge ${item.badgeType || ''}`}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  );
};

const MainLayout = ({ children, activeTab, onTabChange }) => {
  return (
    <div className="app-layout">
      <Header />
      <div className="app-body">
        <Sidebar activeTab={activeTab} onTabChange={onTabChange} />
        <main className="app-main">
          <div className="main-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;