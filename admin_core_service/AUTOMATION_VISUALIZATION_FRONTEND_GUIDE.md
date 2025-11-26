# Automation Visualization - Frontend Implementation Guide

## Overview
This guide provides all the necessary information to implement workflow automation visualization features that display interactive diagrams of workflow processes.

---

## API Endpoint

### Get Workflow Automation Diagram

**Endpoint:** `GET /admin-core-service/v1/automations/{workflowId}/diagram`

**Description:** Fetches the visual diagram representation of a workflow's automation process, including nodes and connections.

**Authentication:** Required (JWT token)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workflowId` | String | Yes | The unique identifier of the workflow to visualize |

#### Request Example

```http
GET /admin-core-service/v1/automations/wf_demo_morning_001/diagram HTTP/1.1
Host: your-api-domain.com
Authorization: Bearer <your-jwt-token>
```

#### Response

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Response Body Structure:**

```json
{
  "nodes": [
    {
      "id": "trigger_001",
      "title": "New Student Registration",
      "description": "Triggered when a new student registers",
      "type": "TRIGGER",
      "details": {
        "eventType": "USER_REGISTERED",
        "conditions": ["userRole == STUDENT"],
        "description": "Automatically triggered when a student completes registration"
      }
    },
    {
      "id": "action_002",
      "title": "Send Welcome Email",
      "description": "Send welcome email to new student",
      "type": "ACTION",
      "details": {
        "actionType": "EMAIL_SEND",
        "template": "student_welcome",
        "recipients": ["new_student.email"],
        "subject": "Welcome to Our Institute!"
      }
    },
    {
      "id": "decision_003",
      "title": "Check Package Selection",
      "description": "Check if student selected a package",
      "type": "DECISION",
      "details": {
        "condition": "student.packageId != null",
        "truePath": "Enroll in Package",
        "falsePath": "Send Package Selection Reminder"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_001_002",
      "sourceNodeId": "trigger_001",
      "targetNodeId": "action_002",
      "label": "On Success"
    },
    {
      "id": "edge_002_003",
      "sourceNodeId": "action_002",
      "targetNodeId": "decision_003",
      "label": "After Email Sent"
    }
  ]
}
```

#### Response Fields

**Nodes Array:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier for the node |
| `title` | String | Display title for the node |
| `description` | String | Detailed description of what this node does |
| `type` | String | Node type: `TRIGGER`, `ACTION`, `DECISION`, `EMAIL`, etc. |
| `details` | Map<String, Object> | Rich configuration details specific to the node type |

**Edges Array:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier for the edge |
| `sourceNodeId` | String | ID of the source node |
| `targetNodeId` | String | ID of the target node |
| `label` | String | Label describing the connection (e.g., "On Success", "If condition met") |

#### Common Node Types

- **TRIGGER**: Starting point of workflow (events, schedules, webhooks)
- **ACTION**: Executable steps (API calls, database operations, notifications)
- **DECISION**: Conditional logic (if/else branches)
- **EMAIL**: Email sending actions
- **NOTIFICATION**: SMS/WhatsApp notifications
- **DATABASE**: Database operations
- **WEBHOOK**: External API integrations

#### Error Responses

**404 Not Found**
```json
{
  "error": "Workflow not found",
  "message": "No workflow found with ID: wf_demo_morning_001"
}
```

**400 Bad Request**
```json
{
  "error": "Invalid workflow ID",
  "message": "The provided workflow ID is not valid"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to generate diagram",
  "message": "An error occurred while parsing workflow configuration"
}
```

---

## Frontend Implementation Guide

### 1. TypeScript Interfaces

Create TypeScript interfaces for type safety:

```typescript
interface AutomationDiagram {
  nodes: Node[];
  edges: Edge[];
}

interface Node {
  id: string;
  title: string;
  description: string;
  type: NodeType;
  details: Record<string, any>;
}

interface Edge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string;
}

type NodeType = 'TRIGGER' | 'ACTION' | 'DECISION' | 'EMAIL' | 'NOTIFICATION' | 'DATABASE' | 'WEBHOOK';
```

### 2. API Service Function

Create a service function to fetch automation diagrams:

```typescript
// services/automationService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

export const getWorkflowDiagram = async (workflowId: string): Promise<AutomationDiagram> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/admin-core-service/v1/automations/${workflowId}/diagram`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching workflow diagram:', error);
    throw error;
  }
};
```

### 3. React Component Example (Workflow Diagram Viewer)

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getWorkflowDiagram } from '../services/automationService';

interface WorkflowDiagramViewerProps {
  workflowId: string;
  workflowName?: string;
}

const WorkflowDiagramViewer: React.FC<WorkflowDiagramViewerProps> = ({
  workflowId,
  workflowName
}) => {
  const [diagram, setDiagram] = useState<AutomationDiagram | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const fetchDiagram = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkflowDiagram(workflowId);
      setDiagram(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load workflow diagram');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchDiagram();
  }, [fetchDiagram]);

  const getNodeTypeColor = (type: NodeType): string => {
    const colors = {
      TRIGGER: 'bg-green-100 border-green-500 text-green-800',
      ACTION: 'bg-blue-100 border-blue-500 text-blue-800',
      DECISION: 'bg-yellow-100 border-yellow-500 text-yellow-800',
      EMAIL: 'bg-purple-100 border-purple-500 text-purple-800',
      NOTIFICATION: 'bg-indigo-100 border-indigo-500 text-indigo-800',
      DATABASE: 'bg-red-100 border-red-500 text-red-800',
      WEBHOOK: 'bg-orange-100 border-orange-500 text-orange-800'
    };
    return colors[type] || 'bg-gray-100 border-gray-500 text-gray-800';
  };

  const renderNode = (node: Node, index: number) => {
    const position = getNodePosition(index, diagram!.nodes.length);

    return (
      <div
        key={node.id}
        className={`absolute w-48 p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-lg ${getNodeTypeColor(node.type)}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
        onClick={() => setSelectedNode(node)}
      >
        <div className="text-sm font-semibold mb-2">{node.title}</div>
        <div className="text-xs opacity-80 line-clamp-2">{node.description}</div>
        <div className="mt-2 text-xs font-medium">{node.type}</div>
      </div>
    );
  };

  const renderEdge = (edge: Edge) => {
    const sourceNode = diagram!.nodes.find(n => n.id === edge.sourceNodeId);
    const targetNode = diagram!.nodes.find(n => n.id === edge.targetNodeId);

    if (!sourceNode || !targetNode) return null;

    const sourceIndex = diagram!.nodes.indexOf(sourceNode);
    const targetIndex = diagram!.nodes.indexOf(targetNode);

    const sourcePos = getNodePosition(sourceIndex, diagram!.nodes.length);
    const targetPos = getNodePosition(targetIndex, diagram!.nodes.length);

    // Calculate line position (simplified - you might want to use a proper SVG library)
    const midY = (sourcePos.y + targetPos.y) / 2;

    return (
      <div
        key={edge.id}
        className="absolute border-t-2 border-gray-400"
        style={{
          left: `${sourcePos.x + 96}px`, // Half width of node
          top: `${midY}px`,
          width: `${targetPos.x - sourcePos.x - 192}px`, // Distance between nodes minus node widths
        }}
      >
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-white px-2 text-xs text-gray-600 border rounded">
          {edge.label}
        </div>
      </div>
    );
  };

  // Simple positioning algorithm - arrange nodes vertically
  const getNodePosition = (index: number, total: number) => {
    const containerHeight = 600;
    const spacing = containerHeight / (total + 1);
    return {
      x: 100, // Fixed x position for vertical layout
      y: spacing * (index + 1) - 50 // Center vertically in spacing
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchDiagram}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!diagram || diagram.nodes.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-lg">No workflow diagram available</p>
        <p className="text-gray-400 text-sm mt-2">This workflow may not have any configured nodes</p>
      </div>
    );
  }

  return (
    <div className="workflow-diagram-container">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          {workflowName || 'Workflow'} - Automation Diagram
        </h2>
        <p className="text-gray-600 mt-1">
          {diagram.nodes.length} nodes, {diagram.edges.length} connections
        </p>
      </div>

      <div className="relative bg-white border border-gray-200 rounded-lg p-6 overflow-auto">
        <div className="relative min-h-screen">
          {/* Render edges first (behind nodes) */}
          {diagram.edges.map(renderEdge)}

          {/* Render nodes */}
          {diagram.nodes.map(renderNode)}
        </div>
      </div>

      {/* Node Details Modal/Panel */}
      {selectedNode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{selectedNode.title}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Type:</span>
                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded ${getNodeTypeColor(selectedNode.type)}`}>
                  {selectedNode.type}
                </span>
              </div>

              <div>
                <span className="text-sm font-medium text-gray-500">Description:</span>
                <p className="mt-1 text-sm text-gray-700">{selectedNode.description}</p>
              </div>

              {selectedNode.details && Object.keys(selectedNode.details).length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Details:</span>
                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(selectedNode.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowDiagramViewer;
```

---

## Advanced Visualization Features

### 1. Interactive Diagram Libraries

For production-ready diagrams, consider using libraries like:

- **React Flow**: Full-featured diagram library
```bash
npm install reactflow
```

- **D3.js**: Custom visualization with more control
```bash
npm install d3
```

### 2. React Flow Implementation Example

```tsx
import React, { useCallback, useMemo } from 'react';
import ReactFlow, { Node, Edge, Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';

const WorkflowDiagramReactFlow: React.FC<{ diagram: AutomationDiagram }> = ({ diagram }) => {
  const nodes: Node[] = useMemo(() =>
    diagram.nodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      position: { x: 100, y: index * 150 },
      data: {
        label: (
          <div className="p-2">
            <div className="font-semibold">{node.title}</div>
            <div className="text-sm opacity-75">{node.type}</div>
          </div>
        ),
        nodeData: node
      },
      className: getNodeTypeColor(node.type)
    })), [diagram.nodes]
  );

  const edges: Edge[] = useMemo(() =>
    diagram.edges.map(edge => ({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      label: edge.label,
      type: 'smoothstep'
    })), [diagram.edges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.data.nodeData);
    // Handle node click - show details modal
  }, []);

  return (
    <div className="h-96">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
```

### 3. Zoom and Pan Controls

```tsx
// Add to your diagram component
const [zoom, setZoom] = useState(1);
const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

// Zoom controls
<div className="flex gap-2 mb-4">
  <button onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>-</button>
  <span>{Math.round(zoom * 100)}%</span>
  <button onClick={() => setZoom(Math.min(2, zoom + 0.25))}>+</button>
  <button onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}>Reset</button>
</div>
```

### 4. Export Features

```typescript
const exportDiagram = () => {
  // Export as PNG, SVG, or JSON
  const canvas = document.querySelector('.workflow-diagram') as HTMLElement;
  // Use html2canvas or similar library
  html2canvas(canvas).then(canvas => {
    const link = document.createElement('a');
    link.download = 'workflow-diagram.png';
    link.href = canvas.toDataURL();
    link.click();
  });
};
```

---

## UI/UX Recommendations

### 1. Diagram Layout
- **Node Spacing**: Minimum 100px between nodes
- **Flow Direction**: Left-to-right or top-to-bottom
- **Color Coding**: Different colors for different node types
- **Interactive Elements**: Hover effects, clickable nodes

### 2. Node Design
Each node should show:
- **Icon**: Visual representation of node type
- **Title**: Concise name
- **Status Indicators**: Success/failure states (if applicable)
- **Connection Points**: Visual indicators for edges

### 3. Edge Styling
- **Line Types**: Solid for success, dashed for conditions
- **Arrow Heads**: Show flow direction
- **Labels**: Clear transition labels
- **Colors**: Match source node colors

### 4. Responsive Design
- **Mobile**: Simplified list view or horizontal scroll
- **Tablet**: Condensed diagram with zoom
- **Desktop**: Full interactive diagram

### 5. Accessibility
- **Keyboard Navigation**: Tab through nodes
- **Screen Reader Support**: Descriptive alt texts
- **High Contrast**: Ensure good visibility
- **Focus Indicators**: Clear focus states

---

## Integration with Workflow List

Combine with the workflow list page to create a complete experience:

```tsx
// In your workflow list component
const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

return (
  <div className="flex">
    {/* Workflow List Sidebar */}
    <div className="w-1/3 border-r">
      {workflows.map(workflow => (
        <div
          key={workflow.id}
          className={`p-4 cursor-pointer hover:bg-gray-50 ${
            selectedWorkflow?.id === workflow.id ? 'bg-blue-50' : ''
          }`}
          onClick={() => setSelectedWorkflow(workflow)}
        >
          <h3 className="font-semibold">{workflow.name}</h3>
          <p className="text-sm text-gray-600">{workflow.description}</p>
        </div>
      ))}
    </div>

    {/* Diagram Viewer */}
    <div className="w-2/3 p-6">
      {selectedWorkflow ? (
        <WorkflowDiagramViewer
          workflowId={selectedWorkflow.id}
          workflowName={selectedWorkflow.name}
        />
      ) : (
        <div className="text-center text-gray-500">
          Select a workflow to view its automation diagram
        </div>
      )}
    </div>
  </div>
);
```

---

## Testing Checklist

- [ ] API integration works correctly
- [ ] Loading states display properly
- [ ] Error handling works for all error types
- [ ] Empty diagram state displays when no nodes exist
- [ ] Node details modal opens and displays correct information
- [ ] Interactive features work (zoom, pan, click)
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Export functionality works (if implemented)
- [ ] Accessibility features are working
- [ ] Performance is acceptable with large diagrams

---

## Performance Considerations

### 1. Large Diagrams
- **Pagination**: Load diagrams in chunks for very large workflows
- **Virtualization**: Only render visible nodes
- **Lazy Loading**: Load node details on demand

### 2. Real-time Updates
```typescript
// WebSocket integration for live updates
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080/workflow-updates');
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    if (update.workflowId === workflowId) {
      fetchDiagram(); // Refresh diagram
    }
  };
  return () => ws.close();
}, [workflowId]);
```

### 3. Caching
- **Browser Cache**: Cache diagram data for faster reloads
- **Service Worker**: Cache for offline viewing
- **Memoization**: Prevent unnecessary re-renders

---

## Related API Endpoints

Based on the automation system, you may need these additional endpoints:

- **Get Workflow List**: `GET /admin-core-service/v1/workflow/institute/{instituteId}` (already documented)
- **Update Node Configuration**: `PUT /admin-core-service/v1/workflows/{workflowId}/nodes/{nodeId}` (to be documented)
- **Execute Workflow**: `POST /admin-core-service/v1/workflows/{workflowId}/execute` (to be documented)
- **Get Execution History**: `GET /admin-core-service/v1/workflows/{workflowId}/executions` (to be documented)

---

## Support & Questions

For any questions or issues regarding this implementation:
1. Check the backend service logs for API errors
2. Verify the workflow ID exists and is accessible
3. Ensure authentication token is valid and has necessary permissions
4. Contact the backend team for additional endpoint documentation

---

**Last Updated:** November 3, 2025  
**API Version:** v1  
**Service:** Admin Core Service

