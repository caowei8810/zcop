import React, { useState, useCallback } from 'react';
import { 
  Card, 
  Button, 
  Modal, 
  Form, 
  Input, 
  Select, 
  Tabs, 
  Typography, 
  Space, 
  Divider,
  Table,
  Tag,
  Popconfirm
} from '@arco-design/web-react';
import { IconPlus, IconEdit, IconDelete, IconSave, IconApps } from '@arco-design/web-react/icon';
import ReactFlow, { Controls, Background, useNodesState, useEdgesState, addEdge, Connection, Edge, Node, MarkerType } from 'react-flow-renderer';
import { v4 as uuidv4 } from 'uuid';

const { Title, Text } = Typography;
const { Option } = Select;
const TabPane = Tabs.TabPane;

// Define types
type EntityType = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  color?: string;
  properties: PropertyType[];
  relations: RelationType[];
};

type PropertyType = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'ENUM' | 'REFERENCE' | 'ARRAY' | 'OBJECT';
  required: boolean;
  unique: boolean;
  defaultValue?: any;
  enumValues?: string[];
};

type RelationType = {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  relationType: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY';
  fromEntityId: string;
  toEntityId: string;
};

const OntologyBuilder: React.FC = () => {
  const [entities, setEntities] = useState<EntityType[]>([
    {
      id: '1',
      name: 'Customer',
      displayName: '客户',
      description: '系统中的客户实体',
      properties: [
        { id: 'p1', name: 'name', displayName: '姓名', type: 'STRING', required: true, unique: false },
        { id: 'p2', name: 'email', displayName: '邮箱', type: 'STRING', required: true, unique: true },
        { id: 'p3', name: 'age', displayName: '年龄', type: 'NUMBER', required: false, unique: false }
      ],
      relations: [],
      icon: '👤',
      color: '#3AA2FF'
    },
    {
      id: '2',
      name: 'Order',
      displayName: '订单',
      description: '客户下的订单',
      properties: [
        { id: 'p4', name: 'orderNo', displayName: '订单号', type: 'STRING', required: true, unique: true },
        { id: 'p5', name: 'amount', displayName: '金额', type: 'NUMBER', required: true, unique: false }
      ],
      relations: [],
      icon: '📦',
      color: '#7BC617'
    }
  ]);
  
  const [currentTab, setCurrentTab] = useState('entities');
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EntityType | null>(null);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyType | null>(null);
  const [editingEntityForProperty, setEditingEntityForProperty] = useState<string | null>(null);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Initialize React Flow with entities
  React.useEffect(() => {
    const newNodes: Node[] = entities.map((entity, index) => ({
      id: entity.id,
      type: 'default',
      position: { x: 100 * index, y: 100 },
      data: { 
        label: `${entity.icon || '📦'} ${entity.displayName || entity.name}`, 
        entity 
      },
      style: { 
        background: entity.color || '#fff', 
        color: '#fff', 
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '10px',
        minWidth: '120px'
      }
    }));

    const newEdges: Edge[] = [];
    entities.forEach(entity => {
      entity.relations.forEach(rel => {
        newEdges.push({
          id: rel.id,
          source: rel.fromEntityId,
          target: rel.toEntityId,
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
          label: rel.displayName || rel.name,
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [entities]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Entity handlers
  const handleAddEntity = () => {
    setEditingEntity(null);
    setShowEntityModal(true);
  };

  const handleEditEntity = (entity: EntityType) => {
    setEditingEntity(entity);
    setShowEntityModal(true);
  };

  const handleDeleteEntity = (id: string) => {
    setEntities(entities.filter(e => e.id !== id));
  };

  const handleSaveEntity = (values: any) => {
    if (editingEntity) {
      // Update existing entity
      setEntities(entities.map(e => 
        e.id === editingEntity.id ? { ...e, ...values } : e
      ));
    } else {
      // Add new entity
      const newEntity: EntityType = {
        id: uuidv4(),
        name: values.name,
        displayName: values.displayName || values.name,
        description: values.description,
        properties: [],
        relations: [],
        icon: values.icon,
        color: values.color
      };
      setEntities([...entities, newEntity]);
    }
    setShowEntityModal(false);
  };

  // Property handlers
  const handleAddProperty = (entityId: string) => {
    setEditingEntityForProperty(entityId);
    setEditingProperty(null);
    setShowPropertyModal(true);
  };

  const handleEditProperty = (entityId: string, property: PropertyType) => {
    setEditingEntityForProperty(entityId);
    setEditingProperty(property);
    setShowPropertyModal(true);
  };

  const handleDeleteProperty = (entityId: string, propertyId: string) => {
    setEntities(entities.map(e => {
      if (e.id === entityId) {
        return {
          ...e,
          properties: e.properties.filter(p => p.id !== propertyId)
        };
      }
      return e;
    }));
  };

  const handleSaveProperty = (values: any) => {
    if (editingEntityForProperty) {
      if (editingProperty) {
        // Update existing property
        setEntities(entities.map(e => {
          if (e.id === editingEntityForProperty) {
            return {
              ...e,
              properties: e.properties.map(p => 
                p.id === editingProperty.id ? { ...p, ...values } : p
              )
            };
          }
          return e;
        }));
      } else {
        // Add new property
        const newProperty: PropertyType = {
          id: uuidv4(),
          name: values.name,
          displayName: values.displayName || values.name,
          description: values.description,
          type: values.type,
          required: values.required || false,
          unique: values.unique || false,
          defaultValue: values.defaultValue,
          enumValues: values.enumValues?.split(',')?.map((v: string) => v.trim()) || undefined
        };
        
        setEntities(entities.map(e => {
          if (e.id === editingEntityForProperty) {
            return {
              ...e,
              properties: [...e.properties, newProperty]
            };
          }
          return e;
        }));
      }
    }
    setShowPropertyModal(false);
  };

  // Columns for entities table
  const entityColumns = [
    {
      title: '实体名称',
      dataIndex: 'displayName',
      render: (text: string, record: EntityType) => (
        <Space>
          <span>{record.icon}</span>
          <strong>{text || record.name}</strong>
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description'
    },
    {
      title: '属性数量',
      dataIndex: 'properties',
      render: (properties: PropertyType[]) => properties.length
    },
    {
      title: '操作',
      render: (_, record: EntityType) => (
        <Space>
          <Button 
            type="text" 
            icon={<IconEdit />}
            onClick={() => handleEditEntity(record)}
          />
          <Popconfirm
            title="确定删除此实体吗？"
            onOk={() => handleDeleteEntity(record.id)}
          >
            <Button type="text" status="danger" icon={<IconDelete />} />
          </Popconfirm>
          <Button 
            type="text" 
            icon={<IconPlus />}
            onClick={() => handleAddProperty(record.id)}
          >
            添加属性
          </Button>
        </Space>
      )
    }
  ];

  // Columns for properties table
  const propertyColumns = [
    {
      title: '属性名',
      dataIndex: 'displayName',
      render: (text: string, record: PropertyType) => (
        <Space>
          <strong>{text || record.name}</strong>
          {record.required && <Tag color="red">必填</Tag>}
          {record.unique && <Tag color="blue">唯一</Tag>}
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      render: (type: string) => (
        <Tag color={
          type === 'STRING' ? 'arcoblue' : 
          type === 'NUMBER' ? 'green' : 
          type === 'BOOLEAN' ? 'orange' : 
          type === 'DATE' ? 'purple' : 'gray'
        }>
          {type}
        </Tag>
      )
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue'
    },
    {
      title: '操作',
      render: (_, record: PropertyType) => (
        <Space>
          <Button 
            type="text" 
            icon={<IconEdit />}
            onClick={() => handleEditProperty(editingEntity?.id || '', record)}
          />
          <Popconfirm
            title="确定删除此属性吗？"
            onOk={() => handleDeleteProperty(editingEntity?.id || '', record.id)}
          >
            <Button type="text" status="danger" icon={<IconDelete />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Title heading={4}>本体构建器</Title>
          <Space>
            <Button type="primary" icon={<IconPlus />} onClick={handleAddEntity}>
              新建实体
            </Button>
            <Button icon={<IconSave />}>保存模型</Button>
            <Button icon={<IconApps />}>查看图谱</Button>
          </Space>
        </div>

        <Tabs activeTab={currentTab} onChange={setCurrentTab}>
          <TabPane key="entities" title="实体管理">
            <Table 
              columns={entityColumns} 
              data={entities} 
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          
          <TabPane key="graph" title="关系图谱">
            <div style={{ height: '600px', border: '1px solid #eee', borderRadius: '4px' }}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
              >
                <Controls />
                <Background variant="dots" gap={12} size={1} />
              </ReactFlow>
            </div>
          </TabPane>
        </Tabs>
      </Card>

      {/* Entity Modal */}
      <Modal
        title={editingEntity ? '编辑实体' : '新建实体'}
        visible={showEntityModal}
        onCancel={() => setShowEntityModal(false)}
        footer={null}
        width={600}
      >
        <Form
          initialValues={editingEntity || {}}
          onSubmit={handleSaveEntity}
          autoComplete="off"
        >
          <Form.Item
            label="实体名称"
            field="name"
            rules={[{ required: true, message: '请输入实体名称' }]}
          >
            <Input placeholder="输入实体名称（英文）" />
          </Form.Item>
          
          <Form.Item
            label="显示名称"
            field="displayName"
          >
            <Input placeholder="输入显示名称（中文）" />
          </Form.Item>
          
          <Form.Item
            label="描述"
            field="description"
          >
            <Input.TextArea placeholder="输入实体描述" />
          </Form.Item>
          
          <Form.Item
            label="图标"
            field="icon"
          >
            <Input placeholder="输入图标（emoji或字符）" />
          </Form.Item>
          
          <Form.Item
            label="颜色"
            field="color"
          >
            <Input placeholder="输入颜色代码（如：#3AA2FF）" />
          </Form.Item>
          
          <Form.Item wrapperCol={{ offset: 5 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setShowEntityModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Property Modal */}
      <Modal
        title={editingProperty ? '编辑属性' : '新建属性'}
        visible={showPropertyModal}
        onCancel={() => setShowPropertyModal(false)}
        footer={null}
        width={600}
      >
        <Form
          initialValues={editingProperty || {}}
          onSubmit={handleSaveProperty}
          autoComplete="off"
        >
          <Form.Item
            label="属性名称"
            field="name"
            rules={[{ required: true, message: '请输入属性名称' }]}
          >
            <Input placeholder="输入属性名称（英文）" />
          </Form.Item>
          
          <Form.Item
            label="显示名称"
            field="displayName"
          >
            <Input placeholder="输入显示名称（中文）" />
          </Form.Item>
          
          <Form.Item
            label="类型"
            field="type"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Select placeholder="选择属性类型">
              <Option value="STRING">字符串</Option>
              <Option value="NUMBER">数字</Option>
              <Option value="BOOLEAN">布尔值</Option>
              <Option value="DATE">日期</Option>
              <Option value="DATETIME">日期时间</Option>
              <Option value="ENUM">枚举</Option>
              <Option value="REFERENCE">引用</Option>
              <Option value="ARRAY">数组</Option>
              <Option value="OBJECT">对象</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="描述"
            field="description"
          >
            <Input.TextArea placeholder="输入属性描述" />
          </Form.Item>
          
          <Form.Item
            label="是否必填"
            field="required"
            triggerPropName="checked"
          >
            <Select placeholder="选择是否必填">
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="是否唯一"
            field="unique"
            triggerPropName="checked"
          >
            <Select placeholder="选择是否唯一">
              <Option value={true}>是</Option>
              <Option value={false}>否</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="默认值"
            field="defaultValue"
          >
            <Input placeholder="输入默认值" />
          </Form.Item>
          
          <Form.Item
            label="枚举值"
            field="enumValues"
          >
            <Input placeholder="如果是枚举类型，请输入选项，用逗号分隔" />
          </Form.Item>
          
          <Form.Item wrapperCol={{ offset: 5 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => setShowPropertyModal(false)}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OntologyBuilder;