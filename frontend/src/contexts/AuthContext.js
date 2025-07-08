// frontend/src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // API基础URL
  const API_BASE = 'http://localhost:5000/api';

  // 初始化时检查本地存储的认证信息
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user data:', error);
        // 清除无效数据
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // 登录函数
  const login = async (email, password) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const { token: newToken, user: userData } = data;
        
        // 保存认证信息
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        return { success: true, message: '登录成功！' };
      } else {
        return { success: false, message: data.error || '登录失败' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: '网络连接错误，请检查后端服务' };
    } finally {
      setLoading(false);
    }
  };

  // 注册函数
  const register = async (email, password, name, role = 'student') => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, role }),
      });

      const data = await response.json();

      if (data.success) {
        const { token: newToken, user: userData } = data;
        
        // 自动登录
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(userData));
        
        return { success: true, message: '注册成功！' };
      } else {
        return { success: false, message: data.error || '注册失败' };
      }
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, message: '网络连接错误，请检查后端服务' };
    } finally {
      setLoading(false);
    }
  };

  // 登出函数
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // 检查是否已认证
  const isAuthenticated = () => {
    return !!(user && token);
  };

  // 检查用户角色
  const hasRole = (requiredRole) => {
    return user && user.role === requiredRole;
  };

  // 获取认证头
  const getAuthHeaders = () => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // API调用封装
  const apiCall = async (endpoint, options = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json', // 告诉后端发送到是JSON格式
        ...getAuthHeaders(),  // 添加登录凭证（token）
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);  //// 发送网络请求
      const data = await response.json();
      
      // 如果返回401，说明token过期，自动登出
      if (response.status === 401) {
        logout();
        return { success: false, error: '登录已过期，请重新登录' };
      }
      
      return data;
    } catch (error) {
      console.error('API call error:', error);
      return { success: false, error: '网络连接错误' };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    isAuthenticated,
    hasRole,
    apiCall,
    getAuthHeaders,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};