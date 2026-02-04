import React, { useState } from 'react';
import { Card, Input, Button, Form, Message, Typography, Divider } from '@arco-design/web-react';
import { IconUser, IconLock, IconMail, IconUserAdd } from '@arco-design/web-react/icon';
import { authApi } from '../services/api';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      await authApi.register({
        username: values.username,
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName
      });
      Message.success('注册成功，请登录');
      navigate('/login');
    } catch (error) {
      console.error('Registration error:', error);
      Message.error('注册失败，请重试');
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
            <Text type="secondary">创建新账户</Text>
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
            label="邮箱"
            field="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input 
              prefix={<IconMail />} 
              placeholder="请输入邮箱地址" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item
            label="密码"
            field="password"
            rules={[
              { required: true, message: '请输入密码' },
              { minLength: 6, message: '密码长度至少为6位' }
            ]}
          >
            <Input.Password 
              prefix={<IconLock />} 
              placeholder="请输入密码" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item
            label="确认密码"
            field="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password 
              prefix={<IconLock />} 
              placeholder="请再次输入密码" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item
            label="姓"
            field="firstName"
          >
            <Input 
              placeholder="请输入姓氏" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item
            label="名"
            field="lastName"
          >
            <Input 
              placeholder="请输入名字" 
              allowClear 
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              long 
              loading={loading}
              icon={<IconUserAdd />}
            >
              注册
            </Button>
          </Form.Item>
          
          <Divider>或</Divider>
          
          <div style={{ textAlign: 'center' }}>
            <Text>已有账户？</Text>
            <Button type="text" onClick={() => navigate('/login')}>
              立即登录
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterPage;