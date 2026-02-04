import React, { useState } from 'react';
import { Card, Input, Button, Form, Message, Typography, Divider } from '@arco-design/web-react';
import { IconUser, IconLock, IconLogin } from '@arco-design/web-react/icon';
import { authApi } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await authApi.login(values.username, values.password);
      Message.success('登录成功');
      navigate('/'); // Redirect to home after successful login
    } catch (error) {
      console.error('Login error:', error);
      Message.error('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          borderRadius: '8px'
        }}
        title={
          <div style={{ textAlign: 'center' }}>
            <Title heading={4}>ZeroCode Ontology Platform</Title>
            <Text type="secondary">请登录以继续</Text>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onSubmit={handleSubmit}
        >
          <Form.Item
            label="用户名"
            field="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input 
              prefix={<IconUser />} 
              placeholder="请输入用户名" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item
            label="密码"
            field="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              prefix={<IconLock />} 
              placeholder="请输入密码" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              long 
              loading={loading}
              icon={<IconLogin />}
            >
              登录
            </Button>
          </Form.Item>
          
          <Divider>或</Divider>
          
          <div style={{ textAlign: 'center' }}>
            <Text>还没有账户？</Text>
            <Button type="text" onClick={() => navigate('/register')}>
              立即注册
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;