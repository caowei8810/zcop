import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Space, Spin } from '@arco-design/web-react';
import { IconHome, IconDatabase, IconRobot, IconFlow, IconSettings, IconUser, IconLogout } from '@arco-design/web-react/icon';
import { authApi, logout } from './services/api';

const { Header, Content, Sider } = Layout;

// Lazy load components for performance
const HomePage = lazy(() => import('./pages/HomePage'));
const OntologyBuilder = lazy(() => import('./pages/OntologyBuilder'));
const ChatUI = lazy(() => import('./pages/ChatUI'));
const ModelConfig = lazy(() => import('./pages/ModelConfig'));
const AutonomousPlanning = lazy(() => import('./pages/AutonomousPlanning'));
const SystemManagement = lazy(() => import('./pages/SystemManagement'));
const GraphStatistics = lazy(() => import('./pages/GraphStatistics'));
const DataGovernance = lazy(() => import('./pages/DataGovernance'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));

// Loading component for lazy loaded routes
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
    <Spin size={40} />
  </div>
);

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
    { key: 'governance', label: '数据治理', icon: <IconDatabase /> },
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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={
                <Suspense fallback={<PageLoader />}>
                  <LoginPage />
                </Suspense>
              } />
              <Route path="/register" element={
                <Suspense fallback={<PageLoader />}>
                  <RegisterPage />
                </Suspense>
              } />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <HomePage />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/ontology" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <OntologyBuilder />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/chat" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ChatUI />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/model-config" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <ModelConfig />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/planning" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <AutonomousPlanning />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <GraphStatistics />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/system" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <SystemManagement />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/governance" 
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<PageLoader />}>
                      <DataGovernance />
                    </Suspense>
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </Suspense>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;