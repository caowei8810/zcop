import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Space, 
  Progress, 
  Steps, 
  Typography, 
  Alert,
  Modal,
  Table
} from '@arco-design/web-react';
import { IconPlayArrow, IconPause, IconRedo, IconApps } from '@arco-design/web-react/icon';

const { Title, Text } = Typography;
const Step = Steps.Step;

const AutonomousPlanning: React.FC = () => {
  const [planningStatus, setPlanningStatus] = useState<'idle' | 'running' | 'completed' | 'paused'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [showResults, setShowResults] = useState(false);
  
  // Mock data for planning steps
  const planningSteps = [
    { id: 1, name: '分析本体结构', description: '扫描所有实体、属性、关系和规则' },
    { id: 2, name: '识别业务场景', description: '基于本体推断可能的业务操作' },
    { id: 3, name: '生成工作流', description: '为每个业务场景创建对应的工作流' },
    { id: 4, name: '优化工作流', description: '简化和优化生成的工作流结构' },
    { id: 5, name: '验证工作流', description: '确保所有工作流逻辑正确' },
    { id: 6, name: '部署工作流', description: '将生成的工作流部署到执行引擎' }
  ];
  
  // Mock data for generated workflows
  const [generatedWorkflows, setGeneratedWorkflows] = useState([
    { id: 'wf1', name: 'Create Customer', description: '工作流用于创建新客户', entities: ['Customer'], status: 'active', createdAt: '2023-05-15' },
    { id: 'wf2', name: 'Update Customer', description: '工作流用于更新客户信息', entities: ['Customer'], status: 'active', createdAt: '2023-05-15' },
    { id: 'wf3', name: 'Create Order', description: '工作流用于创建新订单', entities: ['Order', 'Customer'], status: 'active', createdAt: '2023-05-15' },
    { id: 'wf4', name: 'Process Payment', description: '工作流用于处理支付', entities: ['Order', 'Payment'], status: 'active', createdAt: '2023-05-15' },
    { id: 'wf5', name: 'Generate Report', description: '工作流用于生成销售报告', entities: ['Order', 'Customer'], status: 'active', createdAt: '2023-05-15' },
  ]);

  const workflowColumns = [
    {
      title: '工作流名称',
      dataIndex: 'name',
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '描述',
      dataIndex: 'description'
    },
    {
      title: '涉及实体',
      dataIndex: 'entities',
      render: (entities: string[]) => (
        <Space>
          {entities.map(entity => (
            <span key={entity} style={{ backgroundColor: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
              {entity}
            </span>
          ))}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <span style={{ color: status === 'active' ? '#7BC617' : '#ccc' }}>
          {status === 'active' ? '激活' : '未激活'}
        </span>
      )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt'
    },
    {
      title: '操作',
      render: () => (
        <Space>
          <Button type="text" size="small">查看</Button>
          <Button type="text" size="small">编辑</Button>
        </Space>
      )
    }
  ];

  const startPlanning = async () => {
    setPlanningStatus('running');
    setProgress(0);
    setCurrentStep(0);
    
    try {
      // In a real implementation, this would call the backend API
      // const response = await fetch('/api/autonomous-planning', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     // Parameters for the planning process
      //   }),
      // });
      //
      // const data = await response.json();
      // 
      // // Process the streaming response
      // for await (const chunk of data) {
      //   setProgress(chunk.progress);
      //   setCurrentStep(chunk.currentStep);
      //   // Update UI with intermediate results
      // }
      
      // Simulate planning progress for demo purposes
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(interval);
            setPlanningStatus('completed');
            // In a real implementation, we would fetch the final results from the backend
            // const results = await fetch('/api/generated-workflows');
            // setGeneratedWorkflows(results.data);
            return 100;
          }
          return newProgress;
        });
        
        setCurrentStep(prev => {
          if (prev < planningSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 800);
    } catch (error) {
      console.error('Error during planning:', error);
      setPlanningStatus('idle');
      Message.error('规划过程中出现错误，请重试');
    }
  };

  const pausePlanning = () => {
    setPlanningStatus('paused');
  };

  const resumePlanning = () => {
    if (planningStatus === 'paused') {
      setPlanningStatus('running');
      
      // Resume progress simulation
      const interval = setInterval(() => {
        setProgress(prev => {
          if (planningStatus !== 'running') {
            clearInterval(interval);
            return prev;
          }
          
          const newProgress = prev + 10;
          if (newProgress >= 100) {
            clearInterval(interval);
            setPlanningStatus('completed');
            return 100;
          }
          return newProgress;
        });
        
        setCurrentStep(prev => {
          if (planningStatus !== 'running') {
            clearInterval(interval);
            return prev;
          }
          
          if (prev < planningSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 800);
    }
  };

  const resetPlanning = () => {
    setPlanningStatus('idle');
    setProgress(0);
    setCurrentStep(0);
  };

  return (
    <div>
      <Card>
        <Title heading={4} style={{ marginBottom: '24px' }}>自主规划引擎</Title>
        
        <Alert
          type="info"
          content="自主规划引擎会分析您的本体模型，自动生成相应的业务工作流。这些工作流将使您的业务能够通过自然语言界面操作。"
          style={{ marginBottom: '24px' }}
        />
        
        <div style={{ marginBottom: '24px' }}>
          <Space>
            <Button 
              type="primary" 
              icon={<IconPlayArrow />}
              disabled={planningStatus === 'running' || planningStatus === 'completed'}
              onClick={startPlanning}
            >
              {planningStatus === 'completed' ? '重新规划' : '开始规划'}
            </Button>
            
            {planningStatus === 'running' && (
              <Button icon={<IconPause />} onClick={pausePlanning}>
                暂停
              </Button>
            )}
            
            {planningStatus === 'paused' && (
              <Button type="primary" icon={<IconPlayArrow />} onClick={resumePlanning}>
                继续
              </Button>
            )}
            
            <Button icon={<IconRedo />} onClick={resetPlanning}>
              重置
            </Button>
            
            <Button 
              icon={<IconApps />} 
              disabled={planningStatus !== 'completed'}
              onClick={() => setShowResults(true)}
            >
              查看结果
            </Button>
          </Space>
        </div>
        
        {planningStatus !== 'idle' && (
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <Text>进度: {progress}%</Text>
            </div>
            <Progress percent={progress / 100} showText={false} />
            
            <div style={{ marginTop: '24px' }}>
              <Steps current={currentStep} direction="horizontal">
                {planningSteps.map((step, index) => (
                  <Step 
                    key={step.id} 
                    title={step.name} 
                    description={step.description}
                    status={
                      index < currentStep ? 'finish' : 
                      index === currentStep ? 'process' : 
                      'wait'
                    }
                  />
                ))}
              </Steps>
            </div>
            
            {planningStatus === 'running' && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                <Text type="secondary">当前步骤: {planningSteps[currentStep]?.name}</Text>
                <div style={{ marginTop: '8px' }}>
                  <Text type="secondary" fontSize="12">{planningSteps[currentStep]?.description}</Text>
                </div>
              </div>
            )}
          </Card>
        )}
        
        {planningStatus === 'completed' && (
          <Card title="规划结果摘要">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ padding: '16px', border: '1px solid #e5e5e5', borderRadius: '4px' }}>
                <Text type="secondary">分析实体</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>24</div>
              </div>
              <div style={{ padding: '16px', border: '1px solid #e5e5e5', borderRadius: '4px' }}>
                <Text type="secondary">识别关系</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>68</div>
              </div>
              <div style={{ padding: '16px', border: '1px solid #e5e5e5', borderRadius: '4px' }}>
                <Text type="secondary">生成工作流</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>156</div>
              </div>
              <div style={{ padding: '16px', border: '1px solid #e5e5e5', borderRadius: '4px' }}>
                <Text type="secondary">优化完成</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px' }}>✓</div>
              </div>
            </div>
            
            <div>
              <Button 
                type="primary" 
                onClick={() => setShowResults(true)}
                style={{ marginBottom: '16px' }}
              >
                查看详细生成的工作流
              </Button>
            </div>
          </Card>
        )}
      </Card>
      
      <Modal
        title="生成的工作流"
        visible={showResults}
        footer={null}
        onCancel={() => setShowResults(false)}
        width={1000}
      >
        <Table 
          columns={workflowColumns} 
          data={generatedWorkflows} 
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Modal>
    </div>
  );
};

export default AutonomousPlanning;