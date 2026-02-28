import React, { useState, useEffect } from 'react';
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
  Tag,
  DatePicker,
  Descriptions,
  Badge,
  Progress
} from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete, IconEye, IconDownload } from '@arco-design/web-react/icon';

const { Title } = Typography;
const TabPane = Tabs.TabPane;
const { RangePicker } = DatePicker;

const DataGovernance: React.FC = () => {
  const [activeTab, setActiveTab] = useState('classification');
  const [showClassificationModal, setShowClassificationModal] = useState(false);
  const [editingClassification, setEditingClassification] = useState<any>(null);
  const [classifications, setClassifications] = useState([
    { 
      id: '1', 
      name: '个人身份信息', 
      description: '包含个人身份识别信息的数据', 
      sensitivityLevel: 'restricted', 
      dataCategories: ['姓名', '身份证号', '社保号'], 
      applicableEntities: ['Customer', 'User'], 
      createdAt: '2023-05-15' 
    },
    { 
      id: '2', 
      name: '联系信息', 
      description: '个人联系方式数据', 
      sensitivityLevel: 'confidential', 
      dataCategories: ['电话', '邮箱', '地址'], 
      applicableEntities: ['Customer', 'User', 'Contact'], 
      createdAt: '2023-05-16' 
    },
    { 
      id: '3', 
      name: '财务信息', 
      description: '涉及财务和支付的数据', 
      sensitivityLevel: 'restricted', 
      dataCategories: ['银行账户', '信用卡号', '薪资'], 
      applicableEntities: ['Customer', 'Order', 'Invoice'], 
      createdAt: '2023-05-17' 
    },
  ]);
  
  const [complianceReports, setComplianceReports] = useState([
    { 
      id: '1', 
      name: 'GDPR合规报告', 
      type: 'GDPR', 
      status: 'completed', 
      date: '2023-06-01', 
      coverage: 95, 
      findings: 2,
      nextDue: '2023-09-01'
    },
    { 
      id: '2', 
      name: 'CCPA合规报告', 
      type: 'CCPA', 
      status: 'in-progress', 
      date: '2023-06-15', 
      coverage: 78, 
      findings: 5,
      nextDue: '2023-09-15'
    },
    { 
      id: '3', 
      name: '数据质量报告', 
      type: 'Data Quality', 
      status: 'completed', 
      date: '2023-06-10', 
      coverage: 88, 
      findings: 8,
      nextDue: '2023-07-10'
    },
  ]);

  const [dataLineage, setDataLineage] = useState([
    { 
      id: '1', 
      source: 'Customer Database', 
      destination: 'CRM System', 
      operation: 'ETL Process', 
      timestamp: '2023-06-01 10:30:00',
      status: 'success'
    },
    { 
      id: '2', 
      source: 'Order API', 
      destination: 'Analytics Warehouse', 
      operation: 'Real-time Sync', 
      timestamp: '2023-06-01 11:15:00',
      status: 'success'
    },
    { 
      id: '3', 
      source: 'Payment Gateway', 
      destination: 'Financial Reports', 
      operation: 'Batch Processing', 
      timestamp: '2023-06-01 02:00:00',
      status: 'failed'
    },
  ]);

  const sensitivityColors = {
    public: 'green',
    internal: 'blue',
    confidential: 'orange',
    restricted: 'red'
  };

  const statusColors = {
    completed: 'green',
    'in-progress': 'blue',
    failed: 'red'
  };

  const classificationColumns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      render: (text: string) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '描述',
      dataIndex: 'description'
    },
    {
      title: '敏感级别',
      dataIndex: 'sensitivityLevel',
      render: (level: string) => (
        <Tag color={sensitivityColors[level as keyof typeof sensitivityColors]}>
          {level === 'public' ? '公开' : 
           level === 'internal' ? '内部' : 
           level === 'confidential' ? '机密' : '受限'}
        </Tag>
      )
    },
    {
      title: '适用实体',
      dataIndex: 'applicableEntities',
      render: (entities: string[]) => (
        <Space>
          {entities.map(entity => (
            <Tag key={entity} color="arcoblue">{entity}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '数据类别',
      dataIndex: 'dataCategories',
      render: (categories: string[]) => (
        <div>
          {categories.slice(0, 2).map((cat, idx) => (
            <Tag key={idx} color="purple-light">{cat}</Tag>
          ))}
          {categories.length > 2 && (
            <Tag color="gray">+{categories.length - 2} more</Tag>
          )}
        </div>
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
          <Button type="text" icon={<IconEdit />} onClick={() => handleEditClassification(record)}>编辑</Button>
          <Button type="text" status="danger" icon={<IconDelete />}>删除</Button>
        </Space>
      )
    }
  ];

  const complianceColumns = [
    {
      title: '报告名称',
      dataIndex: 'name',
      render: (text: string) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type: string) => (
        <Tag color="cyan">{type}</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <Badge 
          status={status === 'completed' ? 'success' : status === 'in-progress' ? 'processing' : 'error'} 
          text={
            status === 'completed' ? '已完成' : 
            status === 'in-progress' ? '进行中' : '失败'
          }
        />
      )
    },
    {
      title: '覆盖率',
      dataIndex: 'coverage',
      render: (coverage: number) => (
        <Progress percent={coverage / 100} size="small" />
      )
    },
    {
      title: '发现项',
      dataIndex: 'findings',
      render: (findings: number) => (
        <Tag color={findings > 3 ? 'red' : findings > 0 ? 'orange' : 'green'}>
          {findings} 个问题
        </Tag>
      )
    },
    {
      title: '生成日期',
      dataIndex: 'date'
    },
    {
      title: '下次到期',
      dataIndex: 'nextDue'
    },
    {
      title: '操作',
      render: (_, record: any) => (
        <Space>
          <Button type="text" icon={<IconEye />}>查看</Button>
          <Button type="text" icon={<IconDownload />}>下载</Button>
        </Space>
      )
    }
  ];

  const lineageColumns = [
    {
      title: '源系统',
      dataIndex: 'source',
      render: (text: string) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '目标系统',
      dataIndex: 'destination',
      render: (text: string) => <span style={{ fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '操作',
      dataIndex: 'operation'
    },
    {
      title: '时间戳',
      dataIndex: 'timestamp'
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <Badge 
          status={status === 'success' ? 'success' : 'error'} 
          text={
            status === 'success' ? '成功' : '失败'
          }
        />
      )
    },
    {
      title: '操作',
      render: (_, record: any) => (
        <Space>
          <Button type="text" icon={<IconEye />}>详情</Button>
        </Space>
      )
    }
  ];

  const handleAddClassification = () => {
    setEditingClassification(null);
    setShowClassificationModal(true);
  };

  const handleEditClassification = (classification: any) => {
    setEditingClassification(classification);
    setShowClassificationModal(true);
  };

  return (
    <div>
      <Card>
        <Title heading={4} style={{ marginBottom: '24px' }}>数据治理</Title>
        
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="classification" title="数据分类">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Button type="primary" icon={<IconPlus />} onClick={handleAddClassification}>
                  新增分类
                </Button>
              </div>
              <div>
                <Button>批量导入</Button>
                <Button style={{ marginLeft: '8px' }}>导出</Button>
              </div>
            </div>
            
            <Table 
              columns={classificationColumns} 
              data={classifications} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane key="compliance" title="合规监控">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Button type="primary">生成报告</Button>
              </div>
              <div>
                <RangePicker placeholder={['开始日期', '结束日期']} />
                <Button type="primary" style={{ marginLeft: '8px' }}>筛选</Button>
              </div>
            </div>
            
            <Table 
              columns={complianceColumns} 
              data={complianceReports} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
            
            <Card title="合规概览" style={{ marginTop: '16px' }}>
              <Descriptions 
                column={3}
                data={[
                  { label: 'GDPR合规度', value: '95%' },
                  { label: 'CCPA合规度', value: '78%' },
                  { label: '数据质量评分', value: '88%' },
                  { label: '敏感数据发现', value: '245项' },
                  { label: '隐私影响评估', value: '12次' },
                  { label: '数据泄露事件', value: '0次' },
                ]}
              />
            </Card>
          </TabPane>
          
          <TabPane key="lineage" title="数据血缘">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Button>分析血缘</Button>
                <Button style={{ marginLeft: '8px' }}>可视化</Button>
              </div>
              <div>
                <RangePicker placeholder={['开始日期', '结束日期']} />
                <Button type="primary" style={{ marginLeft: '8px' }}>筛选</Button>
              </div>
            </div>
            
            <Table 
              columns={lineageColumns} 
              data={dataLineage} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
            
            <Card title="血缘图谱" style={{ marginTop: '16px' }}>
              <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                <p>数据血缘可视化图表将在后续版本中提供</p>
              </div>
            </Card>
          </TabPane>
          
          <TabPane key="quality" title="数据质量">
            <Card title="质量概览">
              <Descriptions 
                column={4}
                data={[
                  { label: '完整性', value: <Progress percent={0.92} size="small" /> },
                  { label: '有效性', value: <Progress percent={0.87} size="small" /> },
                  { label: '一致性', value: <Progress percent={0.95} size="small" /> },
                  { label: '唯一性', value: <Progress percent={0.98} size="small" /> },
                ]}
              />
            </Card>
            
            <Card title="质量规则" style={{ marginTop: '16px' }}>
              <Table 
                columns={[
                  { title: '规则名称', dataIndex: 'name' },
                  { title: '实体类型', dataIndex: 'entityType' },
                  { title: '字段', dataIndex: 'field' },
                  { title: '条件', dataIndex: 'condition' },
                  { title: '严重程度', dataIndex: 'severity' },
                  { title: '操作', render: () => (
                    <Space>
                      <Button type="text" icon={<IconEdit />}>编辑</Button>
                      <Button type="text" status="danger" icon={<IconDelete />}>删除</Button>
                    </Space>
                  )}
                ]} 
                data={[
                  { name: '邮箱格式校验', entityType: 'Customer', field: 'email', condition: 'email_format', severity: 'error' },
                  { name: '必填字段校验', entityType: 'Customer', field: 'name', condition: 'required', severity: 'error' },
                  { name: '手机号格式校验', entityType: 'User', field: 'phone', condition: 'regex:^[0-9]{11}$', severity: 'warning' },
                ]} 
                rowKey="name"
              />
            </Card>
          </TabPane>
          
          <TabPane key="privacy" title="隐私保护">
            <Card title="隐私控制">
              <div style={{ marginBottom: '16px' }}>
                <p>数据脱敏配置：</p>
                <Form layout="vertical">
                  <Form.Item label="敏感数据识别">
                    <Select mode="multiple" placeholder="选择要识别的敏感数据类型">
                      <Select.Option value="email">邮箱</Select.Option>
                      <Select.Option value="phone">电话</Select.Option>
                      <Select.Option value="id_card">身份证</Select.Option>
                      <Select.Option value="credit_card">信用卡号</Select.Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item label="脱敏方式">
                    <Select placeholder="选择脱敏方式">
                      <Select.Option value="mask">掩码</Select.Option>
                      <Select.Option value="hash">哈希</Select.Option>
                      <Select.Option value="encrypt">加密</Select.Option>
                      <Select.Option value="tokenize">令牌化</Select.Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item>
                    <Button type="primary">保存配置</Button>
                  </Form.Item>
                </Form>
              </div>
              
              <div>
                <p>数据保留策略：</p>
                <Table 
                  columns={[
                    { title: '数据类型', dataIndex: 'type' },
                    { title: '保留期限', dataIndex: 'retention' },
                    { title: '处理方式', dataIndex: 'action' },
                    { title: '最后更新', dataIndex: 'updatedAt' },
                    { title: '操作', render: () => (
                      <Space>
                        <Button type="text" icon={<IconEdit />}>编辑</Button>
                      </Space>
                    )}
                  ]} 
                  data={[
                    { type: '客户个人信息', retention: '7年', action: '删除', updatedAt: '2023-05-15' },
                    { type: '交易记录', retention: '5年', action: '归档', updatedAt: '2023-05-15' },
                    { type: '日志数据', retention: '1年', action: '删除', updatedAt: '2023-05-15' },
                  ]} 
                  rowKey="type"
                />
              </div>
            </Card>
          </TabPane>
        </Tabs>
      </Card>
      
      {/* Classification Modal */}
      <Modal
        title={editingClassification ? '编辑分类' : '新增分类'}
        visible={showClassificationModal}
        onCancel={() => setShowClassificationModal(false)}
        footer={null}
        width={700}
      >
        <Form
          initialValues={editingClassification || {}}
          onSubmit={(values) => {
            if (editingClassification) {
              // Update classification logic
              setClassifications(classifications.map(c => 
                c.id === editingClassification.id ? {...c, ...values} : c
              ));
            } else {
              // Add new classification logic
              const newClassification = { 
                ...values, 
                id: Date.now().toString(), 
                createdAt: new Date().toISOString().split('T')[0] 
              };
              setClassifications([...classifications, newClassification]);
            }
            setShowClassificationModal(false);
          }}
          autoComplete="off"
        >
          <Form.Item
            label="分类名称"
            field="name"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="输入分类名称" />
          </Form.Item>
          
          <Form.Item
            label="描述"
            field="description"
          >
            <Input.TextArea placeholder="输入分类描述" />
          </Form.Item>
          
          <Form.Item
            label="敏感级别"
            field="sensitivityLevel"
            rules={[{ required: true, message: '请选择敏感级别' }]}
          >
            <Select placeholder="选择敏感级别">
              <Select.Option value="public">公开</Select.Option>
              <Select.Option value="internal">内部</Select.Option>
              <Select.Option value="confidential">机密</Select.Option>
              <Select.Option value="restricted">受限</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="数据类别"
            field="dataCategories"
          >
            <Select mode="tags" placeholder="输入数据类别">
              <Select.Option value="email">邮箱</Select.Option>
              <Select.Option value="phone">电话</Select.Option>
              <Select.Option value="address">地址</Select.Option>
              <Select.Option value="id_card">身份证号</Select.Option>
              <Select.Option value="credit_card">信用卡号</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="适用实体"
            field="applicableEntities"
          >
            <Select mode="tags" placeholder="选择适用的实体类型">
              <Select.Option value="Customer">Customer</Select.Option>
              <Select.Option value="User">User</Select.Option>
              <Select.Option value="Order">Order</Select.Option>
              <Select.Option value="Product">Product</Select.Option>
            </Select>
          </Form.Item>
          
          <Form.Item wrapperCol={{ offset: 5 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setShowClassificationModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DataGovernance;