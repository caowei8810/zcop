import React, { useState, useRef, useEffect } from 'react';
import { 
  Card, 
  Input, 
  Button, 
  Avatar, 
  Space, 
  Typography, 
  Spin, 
  Message,
  Tabs,
  Divider
} from '@arco-design/web-react';
import { 
  IconSend, 
  IconRobot, 
  IconUser, 
  IconHistory, 
  IconFile, 
  IconLink,
  IconPaperClip
} from '@arco-design/web-react/icon';
import { v4 as uuidv4 } from 'uuid';

const { TextArea } = Input;
const { Title, Text } = Typography;
const TabPane = Tabs.TabPane;

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  status?: 'sending' | 'delivered' | 'error';
  type?: 'text' | 'card' | 'table' | 'chart';
  data?: any;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const ChatUI: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: '客户管理咨询',
      messages: [
        {
          id: 'm1',
          content: '你好，我想了解一下如何管理客户信息',
          sender: 'user',
          timestamp: new Date(Date.now() - 3600000),
          status: 'delivered'
        },
        {
          id: 'm2',
          content: '您好！我可以帮您管理客户信息。您可以通过本体构建器创建客户实体，定义其属性如姓名、联系方式等。然后您可以通过自然语言查询客户信息，例如"显示所有VIP客户"或"查找北京地区的客户"。',
          sender: 'agent',
          timestamp: new Date(Date.now() - 3500000),
          status: 'delivered'
        }
      ],
      createdAt: new Date(Date.now() - 3600000)
    }
  ]);
  const [currentConversationId, setCurrentConversationId] = useState('1');
  const [activeTab, setActiveTab] = useState('chat');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: uuidv4(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      status: 'sending'
    };

    // Add user message to conversation
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setLoading(true);

    try {
      // Simulate API call to backend
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update user message status
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id ? { ...msg, status: 'delivered' } : msg
      ));

      // Add agent response
      const agentResponse: Message = {
        id: uuidv4(),
        content: `我收到了您的消息："${inputValue}"。正在处理中...`,
        sender: 'agent',
        timestamp: new Date(),
        status: 'delivered',
        type: 'text'
      };

      setMessages(prev => [...prev, agentResponse]);
      
      // Simulate more complex response after delay
      setTimeout(() => {
        const detailedResponse: Message = {
          id: uuidv4(),
          content: `根据您的请求，我已经分析了您的本体模型。您可以通过以下方式实现所需功能：\n\n1. 使用客户实体的查询功能\n2. 应用相关的业务规则\n3. 执行相应的动作`,
          sender: 'agent',
          timestamp: new Date(),
          status: 'delivered',
          type: 'text'
        };
        
        setMessages(prev => [...prev.slice(0, -1), detailedResponse]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      Message.error('发送消息失败，请重试');
      setMessages(prev => prev.map(msg => 
        msg.id === newMessage.id ? { ...msg, status: 'error' } : msg
      ));
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: uuidv4(),
      title: `新对话 ${conversations.length + 1}`,
      messages: [],
      createdAt: new Date()
    };
    
    setConversations([newConversation, ...conversations]);
    setCurrentConversationId(newConversation.id);
    setMessages([]);
    setActiveTab('chat');
  };

  const switchConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(id);
      setMessages(conv.messages);
      setActiveTab('chat');
    }
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);

  return (
    <div style={{ display: 'flex', height: '80vh' }}>
      {/* Sidebar for conversations */}
      <div style={{ width: '250px', borderRight: '1px solid var(--color-border)', padding: '16px' }}>
        <Button 
          type="primary" 
          long 
          style={{ marginBottom: '16px' }}
          onClick={createNewConversation}
        >
          新建对话
        </Button>
        
        <Title heading={6} style={{ margin: '16px 0 8px 0' }}>历史对话</Title>
        <div style={{ maxHeight: '70%', overflowY: 'auto' }}>
          {conversations.map(conv => (
            <div 
              key={conv.id}
              onClick={() => switchConversation(conv.id)}
              style={{
                padding: '12px',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: currentConversationId === conv.id ? 'var(--color-fill-2)' : 'transparent',
                marginBottom: '8px'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{conv.title}</div>
              <Text type="secondary" ellipsis>{conv.messages[0]?.content || '空对话'}</Text>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Tabs 
          activeTab={activeTab} 
          onChange={setActiveTab}
          style={{ padding: '0 16px' }}
        >
          <TabPane key="chat" title="对话"></TabPane>
          <TabPane key="history" title="历史记录"></TabPane>
        </Tabs>

        <Card 
          style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column',
            margin: '0 16px 16px 16px'
          }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          {/* Messages container */}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '16px',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {messages.length === 0 ? (
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                textAlign: 'center',
                color: 'var(--color-text-3)'
              }}>
                <IconRobot style={{ fontSize: '48px', marginBottom: '16px' }} />
                <Title heading={4}>欢迎使用ZeroCode Ontology Platform</Title>
                <Text>
                  这是您的智能助手，可以通过自然语言与您的业务系统交互。<br/>
                  请在下方输入框中描述您想要执行的操作。
                </Text>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    style={{ 
                      display: 'flex', 
                      marginBottom: '16px', 
                      justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    {msg.sender === 'agent' && (
                      <Avatar 
                        size={36} 
                        style={{ marginRight: '12px', backgroundColor: '#3AA2FF' }}
                      >
                        <IconRobot />
                      </Avatar>
                    )}
                    <div style={{ maxWidth: '70%' }}>
                      <div 
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          backgroundColor: msg.sender === 'user' ? '#3AA2FF' : 'var(--color-fill-2)',
                          color: msg.sender === 'user' ? 'white' : 'var(--color-text-1)',
                          wordBreak: 'break-word'
                        }}
                      >
                        {msg.content.split('\n').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: 'var(--color-text-3)', 
                        marginTop: '4px',
                        textAlign: msg.sender === 'user' ? 'right' : 'left'
                      }}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.status === 'sending' && ' • 发送中...'}
                        {msg.status === 'error' && ' • 发送失败'}
                      </div>
                    </div>
                    {msg.sender === 'user' && (
                      <Avatar 
                        size={36} 
                        style={{ marginLeft: '12px', backgroundColor: '#7BC617' }}
                      >
                        <IconUser />
                      </Avatar>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
            
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
                <Avatar size={36} style={{ marginRight: '12px', backgroundColor: '#3AA2FF' }}>
                  <IconRobot />
                </Avatar>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-fill-2)',
                  color: 'var(--color-text-1)'
                }}>
                  <Spin dot style={{ display: 'flex' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <TextArea
                value={inputValue}
                onChange={setInputValue}
                onKeyUp={handleKeyPress}
                placeholder="输入您的业务请求，例如：'创建一个新客户' 或 '显示本月销售报表'"
                autoSize={{ minRows: 1, maxRows: 4 }}
                disabled={loading}
                style={{ flex: 1, marginRight: '12px' }}
              />
              <Button
                type="primary"
                shape="circle"
                icon={<IconSend />}
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || loading}
              />
            </div>
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
              <Space size={16}>
                <Button type="text" icon={<IconPaperClip />}></Button>
                <Button type="text" icon={<IconFile />}></Button>
                <Button type="text" icon={<IconLink />}></Button>
              </Space>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                提示：您可以使用自然语言描述业务需求，系统将自动解析并执行相应操作
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChatUI;