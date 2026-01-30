import React, { useState } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Space, 
  Table, 
  Tabs, 
  Typography,
  Switch,
  Tag
} from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete, IconSave, IconApps } from '@arco-design/web-react/icon';

const { Title } = Typography;
const TabPane = Tabs.TabPane;

const ModelConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState('llm');

  // Mock data for LLM configuration
  const [llmConfig, setLlmConfig] = useState({
    defaultModel: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2048,
    enableStreaming: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', enabled: true },
      { id: 'claude-3-5', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', enabled: true },
      { id: 'qwen-max', name: 'Qwen Max', provider: 'Alibaba', enabled: false },
    ]
  });

  // Mock data for prompt templates
  const [promptTemplates, setPromptTemplates] = useState([
    { id: '1', name: 'Intent Extraction', description: 'Extract user intent from natural language', category: 'NLP', active: true },
    { id: '2', name: 'Entity Recognition', description: 'Identify entities in user request', category: 'NLP', active: true },
    { id: '3', name: 'Workflow Selection', description: 'Match request to appropriate workflow', category: 'Orchestration', active: true },
  ]);

  const llmColumns = [
    {
      title: 'Model',
      dataIndex: 'name',
      render: (text: string, record: any) => (
        <Space>
          <Tag color={record.enabled ? 'green' : 'red'}>
            {record.provider}
          </Tag>
          <strong>{text}</strong>
        </Space>
      )
    },
    {
      title: 'ID',
      dataIndex: 'id'
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      render: (enabled: boolean) => (
        <Switch checked={enabled} />
      )
    },
    {
      title: 'Actions',
      render: () => (
        <Space>
          <Button type="text" icon={<IconEdit />}>Edit</Button>
        </Space>
      )
    }
  ];

  const templateColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Description',
      dataIndex: 'description'
    },
    {
      title: 'Category',
      dataIndex: 'category',
      render: (category: string) => (
        <Tag color="arcoblue">{category}</Tag>
      )
    },
    {
      title: 'Active',
      dataIndex: 'active',
      render: (active: boolean) => (
        <Switch checked={active} />
      )
    },
    {
      title: 'Actions',
      render: () => (
        <Space>
          <Button type="text" icon={<IconEdit />}>Edit</Button>
          <Button type="text" status="danger" icon={<IconDelete />}>Delete</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        <Title heading={4} style={{ marginBottom: '24px' }}>模型配置</Title>
        
        <Tabs activeTab={activeTab} onChange={setActiveTab}>
          <TabPane key="llm" title="LLM 配置">
            <div style={{ marginBottom: '24px' }}>
              <Form layout="horizontal" labelCol={{ span: 6 }} wrapperCol={{ span: 14 }}>
                <Form.Item label="默认模型">
                  <Select 
                    value={llmConfig.defaultModel} 
                    onChange={(value) => setLlmConfig({...llmConfig, defaultModel: value})}
                  >
                    <Select.Option value="gpt-4o">GPT-4o</Select.Option>
                    <Select.Option value="claude-3-5">Claude 3.5 Sonnet</Select.Option>
                    <Select.Option value="qwen-max">Qwen Max</Select.Option>
                  </Select>
                </Form.Item>
                
                <Form.Item label="Temperature">
                  <Input 
                    type="number" 
                    value={llmConfig.temperature} 
                    onChange={(value) => setLlmConfig({...llmConfig, temperature: parseFloat(value) || 0.7})}
                  />
                </Form.Item>
                
                <Form.Item label="Max Tokens">
                  <Input 
                    type="number" 
                    value={llmConfig.maxTokens} 
                    onChange={(value) => setLlmConfig({...llmConfig, maxTokens: parseInt(value) || 2048})}
                  />
                </Form.Item>
                
                <Form.Item label="启用流式响应">
                  <Switch 
                    checked={llmConfig.enableStreaming} 
                    onChange={(checked) => setLlmConfig({...llmConfig, enableStreaming: checked})}
                  />
                </Form.Item>
                
                <Form.Item wrapperCol={{ offset: 6 }}>
                  <Space>
                    <Button type="primary" icon={<IconSave />}>保存配置</Button>
                    <Button>重置</Button>
                  </Space>
                </Form.Item>
              </Form>
            </div>
            
            <Card title="可用模型">
              <Table 
                columns={llmColumns} 
                data={llmConfig.models} 
                rowKey="id"
                pagination={false}
              />
            </Card>
          </TabPane>
          
          <TabPane key="prompts" title="提示词模板">
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="primary" icon={<IconPlus }}>新增模板</Button>
            </div>
            
            <Table 
              columns={templateColumns} 
              data={promptTemplates} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane key="tools" title="工具注册">
            <Card title="可用工具">
              <p>系统集成了多种工具，用于扩展AI代理的能力：</p>
              <ul>
                <li><strong>数据库查询工具</strong> - 用于查询知识图谱和关系数据库</li>
                <li><strong>HTTP请求工具</strong> - 用于与外部API交互</li>
                <li><strong>文件操作工具</strong> - 用于读写文件系统</li>
                <li><strong>计算工具</strong> - 用于执行数学运算和转换</li>
                <li><strong>时间工具</strong> - 用于获取当前时间和日期</li>
              </ul>
              
              <div style={{ marginTop: '24px' }}>
                <Button type="primary">注册新工具</Button>
              </div>
            </Card>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default ModelConfig;