import React, { useState } from 'react';
import { 
  Card, 
  Tabs, 
  Typography, 
  Table, 
  Button, 
  Space, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Switch,
  Tag
} from '@arco-design/web-react';
import { IconUser, IconTeam, IconLock, IconSettings, IconPlus, IconEdit, IconDelete } from '@arco-design/web-react/icon';

const { Title } = Typography;
const TabPane = Tabs.TabPane;

const SystemManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);

  // Mock data for users
  const [users, setUsers] = useState([
    { id: '1', username: 'admin', name: '系统管理员', email: 'admin@example.com', department: 'IT', roles: ['admin'], status: 'active', createdAt: '2023-01-15' },
    { id: '2', username: 'manager', name: '部门经理', email: 'manager@example.com', department: 'Sales', roles: ['manager'], status: 'active', createdAt: '2023-02-20' },
    { id: '3', username: 'analyst', name: '数据分析师', email: 'analyst@example.com', department: 'Analytics', roles: ['user'], status: 'active', createdAt: '2023-03-10' },
  ]);

  // Mock data for roles
  const [roles, setRoles] = useState([
    { id: '1', name: 'admin', displayName: '系统管理员', description: '拥有系统最高权限', permissions: ['*'] },
    { id: '2', name: 'manager', displayName: '部门经理', description: '管理部门相关数据', permissions: ['read:entities', 'write:entities', 'read:reports'] },
    { id: '3', name: 'user', displayName: '普通用户', description: '基本的系统访问权限', permissions: ['read:entities', 'read:reports'] },
  ]);

  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      render: (text: string) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '姓名',
      dataIndex: 'name'
    },
    {
      title: '邮箱',
      dataIndex: 'email'
    },
    {
      title: '部门',
      dataIndex: 'department'
    },
    {
      title: '角色',
      dataIndex: 'roles',
      render: (roles: string[]) => (
        <Space>
          {roles.map(role => (
            <Tag key={role} color="arcoblue">{role}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '激活' : '禁用'}
        </Tag>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt'
    },
    {
      title: '操作',
      render: (_, record: any) => (
        <Space>
          <Button type="text" icon={<IconEdit />} onClick={() => handleEditUser(record)}>编辑</Button>
          <Button type="text" status="danger" icon={<IconDelete />}>删除</Button>
        </Space>
      )
    }
  ];

  const roleColumns = [
    {
      title: '角色名',
      dataIndex: 'displayName',
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>{record.name}</div>
        </div>
      )
    },
    {
      title: '描述',
      dataIndex: 'description'
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      render: (permissions: string[]) => (
        <div>
          {permissions.slice(0, 3).map((perm, idx) => (
            <Tag key={idx} color="purple-light">{perm}</Tag>
          ))}
          {permissions.length > 3 && (
            <Tag color="gray">+{permissions.length - 3} more</Tag>
          )}
        </div>
      )
    },
    {
      title: '操作',
      render: (_, record: any) => (
        <Space>
          <Button type="text" icon={<IconEdit />} onClick={() => handleEditRole(record)}>编辑</Button>
          <Button type="text" status="danger" icon={<IconDelete />}>删除</Button>
        </Space>
      )
    }
  ];

  const handleAddUser = () => {
    setEditingUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setShowUserModal(true);
  };

  const handleAddRole = () => {
    setEditingRole(null);
    setShowRoleModal(true);
  };

  const handleEditRole = (role: any) => {
    setEditingRole(role);
    setShowRoleModal(true);
  };

  return (
    <div>
      <Card>
        <Title heading={4} style={{ marginBottom: '24px' }}>系统管理</Title>
        
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="users" title="用户管理">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Button type="primary" icon={<IconPlus />} onClick={handleAddUser}>
                  新增用户
                </Button>
              </div>
              <div>
                <Button>批量导入</Button>
                <Button style={{ marginLeft: '8px' }}>导出</Button>
              </div>
            </div>
            
            <Table 
              columns={userColumns} 
              data={users} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane key="roles" title="角色管理">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button type="primary" icon={<IconPlus />} onClick={handleAddRole}>
                新增角色
              </Button>
            </div>
            
            <Table 
              columns={roleColumns} 
              data={roles} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane key="tenants" title="多租户管理">
            <Card title="租户列表">
              <p>多租户管理功能允许您在同一系统实例中管理多个独立的组织。</p>
              <p>每个租户都有独立的数据空间、用户管理和配置设置。</p>
              
              <div style={{ marginTop: '16px' }}>
                <Button type="primary">创建新租户</Button>
              </div>
            </Card>
          </TabPane>
          
          <TabPane key="settings" title="系统设置">
            <Card title="通用设置">
              <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 14 }}>
                <Form.Item label="系统名称">
                  <Input defaultValue="ZeroCode Ontology Platform" />
                </Form.Item>
                
                <Form.Item label="系统Logo">
                  <Input placeholder="输入Logo URL" />
                </Form.Item>
                
                <Form.Item label="默认语言">
                  <Select defaultValue="zh-CN">
                    <Select.Option value="zh-CN">简体中文</Select.Option>
                    <Select.Option value="en-US">English</Select.Option>
                    <Select.Option value="ja-JP">日本語</Select.Option>
                  </Select>
                </Form.Item>
                
                <Form.Item label="时区设置">
                  <Select defaultValue="Asia/Shanghai">
                    <Select.Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Select.Option>
                    <Select.Option value="America/New_York">美国东部时间 (UTC-5)</Select.Option>
                    <Select.Option value="Europe/London">格林威治标准时间 (UTC+0)</Select.Option>
                  </Select>
                </Form.Item>
                
                <Form.Item label="启用注册">
                  <Switch />
                </Form.Item>
                
                <Form.Item wrapperCol={{ offset: 6 }}>
                  <Space>
                    <Button type="primary">保存设置</Button>
                    <Button>重置</Button>
                  </Space>
                </Form.Item>
              </Form>
            </Card>
            
            <Card title="主题设置" style={{ marginTop: '16px' }}>
              <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 14 }}>
                <Form.Item label="主题颜色">
                  <Input placeholder="输入颜色代码，如 #3AA2FF" />
                </Form.Item>
                
                <Form.Item label="深色模式">
                  <Select defaultValue="auto">
                    <Select.Option value="auto">自动</Select.Option>
                    <Select.Option value="light">浅色</Select.Option>
                    <Select.Option value="dark">深色</Select.Option>
                  </Select>
                </Form.Item>
                
                <Form.Item wrapperCol={{ offset: 6 }}>
                  <Button type="primary">应用主题</Button>
                </Form.Item>
              </Form>
            </Card>
          </TabPane>
          
          <TabPane key="audit" title="审计日志">
            <Card title="操作日志">
              <p>系统记录所有用户的操作日志，用于安全审计和合规性检查。</p>
              
              <div style={{ marginTop: '16px' }}>
                <Form layout="inline">
                  <Form.Item label="时间范围">
                    <Input placeholder="开始日期" style={{ width: 120 }} />
                    <span style={{ margin: '0 8px' }}>至</span>
                    <Input placeholder="结束日期" style={{ width: 120 }} />
                  </Form.Item>
                  
                  <Form.Item label="用户">
                    <Input placeholder="用户名" style={{ width: 120 }} />
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary">查询</Button>
                  </Form.Item>
                </Form>
                
                <div style={{ marginTop: '16px' }}>
                  <Table 
                    columns={[
                      { title: '时间', dataIndex: 'time' },
                      { title: '用户', dataIndex: 'user' },
                      { title: '操作', dataIndex: 'action' },
                      { title: '资源', dataIndex: 'resource' },
                      { title: 'IP地址', dataIndex: 'ip' },
                    ]} 
                    data={[
                      { time: '2023-05-15 10:30:22', user: 'admin', action: '登录系统', resource: 'auth', ip: '192.168.1.100' },
                      { time: '2023-05-15 10:35:45', user: 'admin', action: '创建实体 Customer', resource: 'ontology', ip: '192.168.1.100' },
                      { time: '2023-05-15 11:20:10', user: 'manager', action: '查询客户数据', resource: 'knowledge_graph', ip: '192.168.1.101' },
                      { time: '2023-05-15 14:45:33', user: 'analyst', action: '生成销售报告', resource: 'reports', ip: '192.168.1.102' },
                    ]} 
                    rowKey="time"
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              </div>
            </Card>
          </TabPane>
        </Tabs>
      </Card>
      
      {/* User Modal */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        visible={showUserModal}
        onCancel={() => setShowUserModal(false)}
        footer={null}
        width={600}
      >
        <Form
          initialValues={editingUser || {}}
          onSubmit={(values) => {
            if (editingUser) {
              // Update user logic
              setUsers(users.map(u => u.id === editingUser.id ? {...u, ...values} : u));
            } else {
              // Add new user logic
              const newUser = { ...values, id: Date.now().toString(), createdAt: new Date().toISOString().split('T')[0] };
              setUsers([...users, newUser]);
            }
            setShowUserModal(false);
          }}
          autoComplete="off"
        >
          <Form.Item
            label="用户名"
            field="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入用户名" />
          </Form.Item>
          
          <Form.Item
            label="姓名"
            field="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="输入真实姓名" />
          </Form.Item>
          
          <Form.Item
            label="邮箱"
            field="email"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="输入邮箱地址" />
          </Form.Item>
          
          <Form.Item
            label="部门"
            field="department"
          >
            <Input placeholder="输入所在部门" />
          </Form.Item>
          
          <Form.Item
            label="角色"
            field="roles"
          >
            <Select mode="multiple" placeholder="选择用户角色">
              {roles.map(role => (
                <Select.Option key={role.id} value={role.name}>{role.displayName}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            label="状态"
            field="status"
          >
            <Select placeholder="选择用户状态">
              <Select.Option value="active">激活</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item wrapperCol={{ offset: 5 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setShowUserModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* Role Modal */}
      <Modal
        title={editingRole ? '编辑角色' : '新增角色'}
        visible={showRoleModal}
        onCancel={() => setShowRoleModal(false)}
        footer={null}
        width={700}
      >
        <Form
          initialValues={editingRole || {}}
          onSubmit={(values) => {
            if (editingRole) {
              // Update role logic
              setRoles(roles.map(r => r.id === editingRole.id ? {...r, ...values} : r));
            } else {
              // Add new role logic
              const newRole = { ...values, id: Date.now().toString() };
              setRoles([...roles, newRole]);
            }
            setShowRoleModal(false);
          }}
          autoComplete="off"
        >
          <Form.Item
            label="角色标识"
            field="name"
            rules={[{ required: true, message: '请输入角色标识' }]}
          >
            <Input placeholder="输入角色唯一标识（英文）" />
          </Form.Item>
          
          <Form.Item
            label="显示名称"
            field="displayName"
            rules={[{ required: true, message: '请输入显示名称' }]}
          >
            <Input placeholder="输入角色显示名称" />
          </Form.Item>
          
          <Form.Item
            label="描述"
            field="description"
          >
            <Input.TextArea placeholder="输入角色描述" />
          </Form.Item>
          
          <Form.Item
            label="权限"
            field="permissions"
          >
            <Select mode="multiple" placeholder="选择角色权限">
              <Select.OptGroup label="本体管理">
                <Select.Option value="read:ontology">读取本体</Select.Option>
                <Select.Option value="write:ontology">写入本体</Select.Option>
                <Select.Option value="delete:ontology">删除本体</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="知识图谱">
                <Select.Option value="read:knowledge_graph">读取知识图谱</Select.Option>
                <Select.Option value="write:knowledge_graph">写入知识图谱</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="工作流">
                <Select.Option value="read:workflows">读取工作流</Select.Option>
                <Select.Option value="write:workflows">写入工作流</Select.Option>
                <Select.Option value="execute:workflows">执行工作流</Select.Option>
              </Select.OptGroup>
              <Select.OptGroup label="系统管理">
                <Select.Option value="manage:users">管理用户</Select.Option>
                <Select.Option value="manage:roles">管理角色</Select.Option>
                <Select.Option value="view:audit">查看审计日志</Select.Option>
              </Select.OptGroup>
            </Select>
          </Form.Item>
          
          <Form.Item wrapperCol={{ offset: 5 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setShowRoleModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SystemManagement;