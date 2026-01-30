import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Tabs, 
  Typography, 
  Statistic, 
  Row, 
  Col, 
  Table, 
  Button, 
  Space, 
  Tag,
  Progress
} from '@arco-design/web-react';
import { 
  IconBarChart, 
  IconPieChart, 
  IconLineChart, 
  IconApps, 
  IconInfoCircle 
} from '@arco-design/web-react/icon';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

const GraphStatistics: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [graphData, setGraphData] = useState<any>(null);
  
  // Mock data for statistics
  const statsData = [
    { title: '实体总数', value: 24, icon: <IconApps style={{ fontSize: '24px' }} />, color: '#3AA2FF' },
    { title: '关系总数', value: 68, icon: <IconApps style={{ fontSize: '24px' }} />, color: '#7BC617' },
    { title: '属性总数', value: 156, icon: <IconApps style={{ fontSize: '24px' }} />, color: '#ED6A1A' },
    { title: '工作流数', value: 42, icon: <IconApps style={{ fontSize: '24px' }}, color: '#AB54E3' />,
  ];

  // Mock data for entity distribution
  const entityDistributionData = [
    { name: '客户', count: 420, percentage: 35 },
    { name: '订单', count: 280, percentage: 23 },
    { name: '产品', count: 195, percentage: 16 },
    { name: '供应商', count: 150, percentage: 12 },
    { name: '发票', count: 120, percentage: 10 },
    { name: '其他', count: 50, percentage: 4 },
  ];

  // Mock data for relationship types
  const relationshipData = [
    { name: 'ONE_TO_MANY', count: 32 },
    { name: 'MANY_TO_MANY', count: 18 },
    { name: 'ONE_TO_ONE', count: 12 },
    { name: 'MANY_TO_ONE', count: 6 },
  ];

  // Mock data for property types
  const propertyTypeData = [
    { name: 'STRING', value: 68 },
    { name: 'NUMBER', value: 32 },
    { name: 'BOOLEAN', value: 18 },
    { name: 'DATE', value: 12 },
    { name: 'ENUM', value: 10 },
    { name: 'REFERENCE', value: 16 },
  ];

  // Mock data for monthly growth
  const monthlyGrowthData = [
    { month: '1月', entities: 12, relationships: 24 },
    { month: '2月', entities: 18, relationships: 36 },
    { month: '3月', entities: 22, relationships: 48 },
    { month: '4月', entities: 20, relationships: 52 },
    { month: '5月', entities: 24, relationships: 60 },
    { month: '6月', entities: 28, relationships: 68 },
  ];

  // Colors for charts
  const COLORS = ['#3AA2FF', '#7BC617', '#ED6A1A', '#AB54E3', '#FF7F50', '#8B4513'];
  
  // Entity table data
  const entityColumns = [
    {
      title: '实体名称',
      dataIndex: 'name',
      render: (text: string, record: any) => (
        <Space>
          <span>{record.icon || '📦'}</span>
          <strong>{text}</strong>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description'
    },
    {
      title: '属性数',
      dataIndex: 'properties',
      render: (properties: any[]) => properties.length
    },
    {
      title: '关系数',
      dataIndex: 'relationships',
      render: (relationships: any[]) => relationships.length
    },
    {
      title: '实例数',
      dataIndex: 'instances',
      render: (count: number) => (
        <span style={{ fontWeight: 'bold', color: '#3AA2FF' }}>{count}</span>
      )
    },
    {
      title: '活跃度',
      dataIndex: 'activity',
      render: (percentage: number) => (
        <div>
          <Progress percent={percentage / 100} size="small" />
          <Text type="secondary" style={{ fontSize: '12px' }}>{percentage}%</Text>
        </div>
      )
    }
  ];
  
  const entityData = [
    { 
      id: '1', 
      name: 'Customer', 
      description: '系统中的客户实体', 
      properties: [{}, {}, {}], 
      relationships: [{}, {}], 
      instances: 420, 
      activity: 85,
      icon: '👤'
    },
    { 
      id: '2', 
      name: 'Order', 
      description: '客户下的订单', 
      properties: [{}, {}, {}, {}], 
      relationships: [{}], 
      instances: 280, 
      activity: 78,
      icon: '📦'
    },
    { 
      id: '3', 
      name: 'Product', 
      description: '系统中的产品', 
      properties: [{}, {}, {}, {}, {}], 
      relationships: [{}], 
      instances: 195, 
      activity: 72,
      icon: '🛍️'
    },
    { 
      id: '4', 
      name: 'Supplier', 
      description: '供应商实体', 
      properties: [{}, {}, {}], 
      relationships: [{}, {}, {}], 
      instances: 150, 
      activity: 65,
      icon: '🏭'
    },
  ];

  // Relationship table data
  const relationshipColumns = [
    {
      title: '关系名称',
      dataIndex: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: '源实体',
      dataIndex: 'fromEntity',
      render: (entity: string) => <Tag color="arcoblue">{entity}</Tag>
    },
    {
      title: '目标实体',
      dataIndex: 'toEntity',
      render: (entity: string) => <Tag color="green">{entity}</Tag>
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type: string) => <Tag color="orange">{type}</Tag>
    },
    {
      title: '实例数',
      dataIndex: 'instances',
      render: (count: number) => (
        <span style={{ fontWeight: 'bold', color: '#7BC617' }}>{count}</span>
      )
    },
    {
      title: '完整性',
      dataIndex: 'integrity',
      render: (percentage: number) => (
        <div>
          <Progress percent={percentage / 100} size="small" />
          <Text type="secondary" style={{ fontSize: '12px' }}>{percentage}%</Text>
        </div>
      )
    }
  ];
  
  const relationshipDataList = [
    { id: '1', name: 'has_orders', fromEntity: 'Customer', toEntity: 'Order', type: 'ONE_TO_MANY', instances: 420, integrity: 95 },
    { id: '2', name: 'contains_items', fromEntity: 'Order', toEntity: 'OrderItem', type: 'ONE_TO_MANY', instances: 890, integrity: 90 },
    { id: '3', name: 'part_of_order', fromEntity: 'OrderItem', toEntity: 'Order', type: 'MANY_TO_ONE', instances: 890, integrity: 100 },
    { id: '4', name: 'represents_product', fromEntity: 'OrderItem', toEntity: 'Product', type: 'MANY_TO_ONE', instances: 890, integrity: 98 },
  ];

  // Simulate loading graph data
  useEffect(() => {
    const timer = setTimeout(() => {
      setGraphData({
        entities: 24,
        relationships: 68,
        properties: 156,
        workflows: 42,
        totalNodes: 1240,
        totalRelationships: 2100,
        avgDegree: 3.1,
        density: 0.02
      });
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title heading={4}>图谱分析</Title>
          <Space>
            <Button icon={<IconInfoCircle />}>图谱健康度</Button>
            <Button icon={<IconBarChart />}>导出报告</Button>
          </Space>
        </div>
        
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="overview" title="概览">
            <Row gutter={24} style={{ marginBottom: '24px' }}>
              {statsData.map((stat, index) => (
                <Col span={6} key={index}>
                  <Card>
                    <Statistic
                      title={stat.title}
                      value={stat.value}
                      prefix={
                        <div style={{ color: stat.color }}>
                          {stat.icon}
                        </div>
                      }
                      groupSeparator
                    />
                  </Card>
                </Col>
              ))}
            </Row>
            
            <Row gutter={24} style={{ marginBottom: '24px' }}>
              <Col span={16}>
                <Card title="实体分布">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={entityDistributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" name="实体数量" fill="#3AA2FF" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="实体占比">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={entityDistributionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="percentage"
                        nameKey="name"
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                      >
                        {entityDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}%`, '占比']} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
            
            <Row gutter={24}>
              <Col span={8}>
                <Card title="关系类型分布">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={relationshipData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="关系数量" fill="#7BC617" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="属性类型分布">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={propertyTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {propertyTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
              <Col span={8}>
                <Card title="月度增长">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="entities" stroke="#3AA2FF" name="实体" />
                      <Line type="monotone" dataKey="relationships" stroke="#7BC617" name="关系" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          </TabPane>
          
          <TabPane key="entities" title="实体分析">
            <Card title="实体详情">
              <Table 
                columns={entityColumns} 
                data={entityData} 
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </TabPane>
          
          <TabPane key="relationships" title="关系分析">
            <Card title="关系详情">
              <Table 
                columns={relationshipColumns} 
                data={relationshipDataList} 
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </Card>
          </TabPane>
          
          <TabPane key="insights" title="洞察推荐">
            <Card title="潜在业务场景推荐">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                <Card bordered>
                  <Title heading={6}>交叉销售机会</Title>
                  <Text type="secondary">
                    基于购买行为分析，识别可以向现有客户推销相关产品的时机。
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Tag color="blue">机器学习</Tag>
                    <Tag color="green">业务优化</Tag>
                  </div>
                </Card>
                
                <Card bordered>
                  <Title heading={6}>客户细分</Title>
                  <Text type="secondary">
                    基于客户属性和行为模式，自动将客户分为不同的细分市场。
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Tag color="blue">数据分析</Tag>
                    <Tag color="green">营销</Tag>
                  </div>
                </Card>
                
                <Card bordered>
                  <Title heading={6}>供应链优化</Title>
                  <Text type="secondary">
                    通过分析供应商-产品-订单关系，优化采购和库存管理。
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Tag color="blue">运营</Tag>
                    <Tag color="green">效率</Tag>
                  </div>
                </Card>
                
                <Card bordered>
                  <Title heading={6}>预测性维护</Title>
                  <Text type="secondary">
                    基于设备-服务-故障数据，预测设备维护需求。
                  </Text>
                  <div style={{ marginTop: '12px' }}>
                    <Tag color="blue">IoT</Tag>
                    <Tag color="green">预防性</Tag>
                  </div>
                </Card>
              </div>
            </Card>
            
            <Card title="图谱优化建议" style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#7BC617', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', marginRight: '12px' }}>
                    !
                  </div>
                  <div>
                    <Text strong>添加索引</Text>: 在 Customer.email 和 Order.orderNo 字段上添加索引以提高查询性能
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#ED6A1A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', marginRight: '12px' }}>
                    !
                  </div>
                  <div>
                    <Text strong>关系优化</Text>: 考虑在 Product 和 Supplier 之间添加直接关系，减少多跳查询
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#3AA2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', marginRight: '12px' }}>
                    i
                  </div>
                  <div>
                    <Text strong>数据质量</Text>: 检测到12%的Customer记录缺少必要的联系信息
                  </div>
                </div>
              </div>
            </Card>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default GraphStatistics;