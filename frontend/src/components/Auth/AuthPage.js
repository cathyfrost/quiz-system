// frontend/src/components/Auth/AuthPage.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const LoginForm = ({ onSwitchToRegister }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = await login(formData.email, formData.password);
    
    setMessage(result.message);
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const quickLogin = (role) => {
    const credentials = {
      teacher: { email: 'teacher@test.com', password: '123456' },
      student: { email: 'student@test.com', password: '123456' }
    };
    setFormData(credentials[role]);
  };

  return (
    <div className="auth-form">
      <h2 className="auth-title">登录到QuizPilot</h2>
      
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label className="form-label">邮箱地址</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="form-input"
            placeholder="请输入邮箱地址"
            required        //HTML5 原生校验
          />
        </div>

        <div className="form-group">
          <label className="form-label">密码</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="form-input"
            placeholder="请输入密码"
            required      //HTML5 原生校验
          />
        </div>

        <button 
          type="submit" 
          className={`form-button ${loading ? 'loading' : ''}`}
          disabled={loading}
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.includes('成功') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="quick-login">
        <p className="quick-login-title">快速登录测试账号</p>
        <div className="quick-login-buttons">
          <button 
            onClick={() => quickLogin('teacher')}
            className="quick-button teacher"
          >
            👨‍🏫 教师账号
          </button>
          <button 
            onClick={() => quickLogin('student')}
            className="quick-button student"
          >
            👨‍🎓 学生账号
          </button>
        </div>
      </div>

      <div className="auth-switch">
        <span>还没有账号？</span>
        <button onClick={onSwitchToRegister} className="switch-button">
          立即注册
        </button>
      </div>
    </div>
  );
};

const RegisterForm = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    role: 'student'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault(); //阻止表单默认提交行为
    setMessage('');

    if (formData.password !== formData.confirmPassword) {
      setMessage('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      setMessage('密码长度至少6位');
      return;    // 停止提交，不继续往下执行
    }

    setLoading(true);

    // 所有检查都通过了，才发送到后端
    const result = await register(
      formData.email, 
      formData.password, 
      formData.name, 
      formData.role
    );
    
    setMessage(result.message);
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="auth-form">
      <h2 className="auth-title">注册QuizPilot</h2>
      
      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label className="form-label">姓名</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="form-input"
            placeholder="请输入您的姓名"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">邮箱地址</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="form-input"
            placeholder="请输入邮箱地址"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">用户类型</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className="form-input"
          >
            <option value="student">👨‍🎓 学生</option>
            <option value="teacher">👨‍🏫 教师</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">密码</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="form-input"
            placeholder="请输入密码（至少6位）"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">确认密码</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className="form-input"
            placeholder="请再次输入密码"
            required
          />
        </div>

        <button 
          type="submit" 
          className={`form-button ${loading ? 'loading' : ''}`}
          disabled={loading}
        >
          {loading ? '注册中...' : '注册'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.includes('成功') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="auth-switch">
        <span>已有账号？</span>
        <button onClick={onSwitchToLogin} className="switch-button">
          立即登录
        </button>
      </div>
    </div>
  );
};

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="system-title">🎯 QuizPilot</h1>
          <p className="system-subtitle">现代化的在线测验平台</p>
        </div>
        
        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
};

export default AuthPage;