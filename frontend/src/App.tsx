import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space } from '@arco-design/web-react';
import { IconHome, IconDatabase, IconRobot, IconFlow, IconSettings, IconUser, IconLogout } from '@arco-design/web-react/icon';
import { authApi, logout } from './services/api';
import HomePage from './pages/HomePage';
import OntologyBuilder from './pages/OntologyBuilder';
import ChatUI from './pages/ChatUI';
import ModelConfig from './pages/ModelConfig';
import AutonomousPlanning from './pages/AutonomousPlanning';
import SystemManagement from './pages/SystemManagement';
import GraphStatistics from './pages/GraphStatistics';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

const { Header, Content, Sider } = Layout;

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = authApi.isAuthenticated();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  const [selectedKey, setSelectedKey] = React.useState('home');
  const [isAuthenticated, setIsAuthenticated] = useState(authApi.isAuthenticated());
  const [currentUser, setCurrentUser] = useState(authApi.getCurrentUser());
  const location = useLocation();

  // Check authentication status on component mount and route changes
  useEffect(() => {
    setIsAuthenticated(authApi.isAuthenticated());
    setCurrentUser(authApi.getCurrentUser());
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  // Only show navigation menu if user is authenticated and not on login/register pages
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const showNavigation = isAuthenticated && !isAuthPage;

  const menuItems = [
    { key: 'home', label: '首页', icon: <IconHome /> },
    { key: 'ontology', label: '本体构建', icon: <IconDatabase /> },
    { key: 'chat', label: '对话界面', icon: <IconRobot /> },
    { key: 'model-config', label: '模型配置', icon: <IconSettings /> },
    { key: 'planning', label: '自主规划', icon: <IconFlow /> },
    { key: 'analytics', label: '图谱分析', icon: <IconDatabase /> },
    { key: 'system', label: '系统管理', icon: <IconSettings /> },
  ];

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 20px', justifyContent: 'space-between' }}>
        <div className="logo" style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
          ZeroCode Ontology Platform (ZCOP)
        </div>
        {isAuthenticated && (
          <Space align="center">
            <span style={{ color: 'white' }}>
              <IconUser style={{ marginRight: 8 }} />
              {currentUser?.firstName || currentUser?.username}
            </span>
            <Button 
              type="text" 
              style={{ color: 'white' }} 
              icon={<IconLogout />}
              onClick={handleLogout}
            >
              退出
            </Button>
          </Space>
        )}
      </Header>
      <Layout>
        {showNavigation && (
          <Sider width={200} breakpoint="lg" collapsedWidth="0">
            <Menu
              style={{ width: 200, height: 'calc(100vh - 60px)' }}
              selectedKeys={[selectedKey]}
              onClickMenuItem={(key) => setSelectedKey(key)}
            >
              {menuItems.map(item => (
                <Menu.Item key={item.key} icon={item.icon}>
                  {item.label}
                </Menu.Item>
              ))}
            </Menu>
          </Sider>
        )}
        <Content style={{ padding: '24px', overflow: 'auto' }}>
          <Routes>
            <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/ontology" 
              element={
                <ProtectedRoute>
                  <OntologyBuilder />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/chat" 
              element={
                <ProtectedRoute>
                  <ChatUI />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/model-config" 
              element={
                <ProtectedRoute>
                  <ModelConfig />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/planning" 
              element={
                <ProtectedRoute>
                  <AutonomousPlanning />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <GraphStatistics />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/system" 
              element={
                <ProtectedRoute>
                  <SystemManagement />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;