import React from 'react';
import { Card, Row, Col, Statistic, Button, Space } from '@arco-design/web-react';
import { IconUser, IconDatabase, IconRobot, IconFlow } from '@arco-design/web-react/icon';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const HomePage: React.FC = () => {
  // Mock data for statistics
  const statsData = [
    { title: '实体数量', value: 24, icon: <IconDatabase />, color: '#3AA2FF' },
    { title: '关系数量', value: 68, icon: <IconFlow />, color: '#7BC617' },
    { title: '动作数量', value: 156, icon: <IconRobot />, color: '#ED6A1A' },
    { title: '用户数量', value: 42, icon: <IconUser />, color: '#AB54E3' },
  ];

  // Mock data for charts
  const chartData = [
    { name: '客户', entities: 400, relations: 240 },
    { name: '订单', entities: 300, relations: 138 },
    { name: '产品', entities: 200, relations: 180 },
    { name: '供应商', entities: 278, relations: 190 },
    { name: '发票', entities: 189, relations: 150 },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: '24px' }}>ZeroCode Ontology Platform (ZCOP)</h1>
      
      {/* Stats Cards */}
      <Row gutter={24} style={{ marginBottom: '24px' }}>
        {statsData.map((stat, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={
                  <div style={{ fontSize: '24px', color: stat.color }}>
                    {stat.icon}
                  </div>
                }
                groupSeparator
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts Section */}
      <Row gutter={24} style={{ marginBottom: '24px' }}>
        <Col span={16}>
          <Card title="实体关系分布">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="entities" fill="#3AA2FF" name="实体数量" />
                <Bar dataKey="relations" fill="#7BC617" name="关系数量" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="快速操作">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Button type="primary" size="large" long>创建新实体</Button>
              <Button size="large" long>启动自主规划</Button>
              <Button size="large" long>查看知识图谱</Button>
              <Button size="large" long>进入对话界面</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row>
        <Col span={24}>
          <Card title="最近活动">
            <div style={{ minHeight: '200px' }}>
              <p>• 用户admin创建了新的实体"客户"</p>
              <p>• 自主规划引擎生成了5个新的业务流程</p>
              <p>• 知识图谱更新了156个节点</p>
              <p>• 用户张三执行了销售报表查询</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;