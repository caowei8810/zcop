import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout, Menu } from '@arco-design/web-react';
import { IconHome, IconDatabase, IconRobot, IconFlow, IconSettings } from '@arco-design/web-react/icon';
import HomePage from './pages/HomePage';
import OntologyBuilder from './pages/OntologyBuilder';
import ChatUI from './pages/ChatUI';
import ModelConfig from './pages/ModelConfig';
import AutonomousPlanning from './pages/AutonomousPlanning';
import SystemManagement from './pages/SystemManagement';
import GraphStatistics from './pages/GraphStatistics';

const { Header, Content, Sider } = Layout;

function App() {
  const [selectedKey, setSelectedKey] = React.useState('home');

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
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 20px' }}>
        <div className="logo" style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>
          ZeroCode Ontology Platform (ZCOP)
        </div>
      </Header>
      <Layout>
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
        <Content style={{ padding: '24px', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/ontology" element={<OntologyBuilder />} />
            <Route path="/chat" element={<ChatUI />} />
            <Route path="/model-config" element={<ModelConfig />} />
            <Route path="/planning" element={<AutonomousPlanning />} />
            <Route path="/analytics" element={<GraphStatistics />} />
            <Route path="/system" element={<SystemManagement />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;