# Workflow List Page - Frontend Implementation Guide

## Overview
This guide provides all the necessary information to implement a workflow list page that displays all active workflows for an institute.

---

## API Endpoint

### Get Active Workflows by Institute ID

**Endpoint:** `GET /admin-core-service/v1/workflow/institute/{instituteId}`

**Description:** Fetches all active workflows for a specific institute.

**Authentication:** Required (JWT token)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `instituteId` | String | Yes | The unique identifier of the institute |

#### Request Example

```http
GET /admin-core-service/v1/workflow/institute/550e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: your-api-domain.com
Authorization: Bearer <your-jwt-token>
```

#### Response

**Status Code:** `200 OK`

**Content-Type:** `application/json`

**Response Body Structure:**

```json
[
  {
    "id": "workflow-uuid-1",
    "name": "Student Onboarding Workflow",
    "description": "Automated workflow for new student onboarding process",
    "status": "ACTIVE",
    "workflowType": "ONBOARDING",
    "createdByUserId": "user-uuid-123",
    "instituteId": "institute-uuid-456",
    "createdAt": "2025-10-15T10:30:00.000Z",
    "updatedAt": "2025-11-01T14:20:00.000Z"
  },
  {
    "id": "workflow-uuid-2",
    "name": "Fee Reminder Workflow",
    "description": "Send automated reminders for pending fee payments",
    "status": "ACTIVE",
    "workflowType": "NOTIFICATION",
    "createdByUserId": "user-uuid-789",
    "instituteId": "institute-uuid-456",
    "createdAt": "2025-09-20T08:15:00.000Z",
    "updatedAt": "2025-10-28T16:45:00.000Z"
  }
]
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique identifier of the workflow |
| `name` | String | Name of the workflow |
| `description` | String | Detailed description of the workflow's purpose |
| `status` | String | Current status (always "ACTIVE" from this endpoint) |
| `workflowType` | String | Type/category of the workflow |
| `createdByUserId` | String | User ID who created the workflow |
| `instituteId` | String | Institute ID this workflow belongs to |
| `createdAt` | Date | Timestamp when the workflow was created |
| `updatedAt` | Date | Timestamp when the workflow was last updated |

#### Error Responses

**400 Bad Request**
```json
{
  "error": "Invalid institute ID format",
  "message": "The provided institute ID is not valid"
}
```

**404 Not Found**
```json
{
  "error": "Institute not found",
  "message": "No institute found with the provided ID"
}
```

**500 Internal Server Error**
```json
{
  "error": "Failed to fetch active workflows",
  "message": "An error occurred while retrieving workflows"
}
```

---

## Frontend Implementation Guide

### 1. TypeScript Interface

Create a TypeScript interface for type safety:

```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  status: string;
  workflowType: string;
  createdByUserId: string;
  instituteId: string;
  createdAt: string;
  updatedAt: string;
}
```

### 2. API Service Function

Create a service function to fetch workflows:

```typescript
// services/workflowService.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

export const getActiveWorkflows = async (instituteId: string): Promise<Workflow[]> => {
  try {
    const response = await axios.get(
      `${API_BASE_URL}/admin-core-service/v1/workflow/institute/${instituteId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching workflows:', error);
    throw error;
  }
};
```

### 3. React Component Example (using React Hooks)

```tsx
import React, { useState, useEffect } from 'react';
import { getActiveWorkflows } from '../services/workflowService';

const WorkflowListPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get instituteId from your auth context or props
  const instituteId = 'your-institute-id'; // Replace with actual institute ID

  useEffect(() => {
    fetchWorkflows();
  }, [instituteId]);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getActiveWorkflows(instituteId);
      setWorkflows(data);
    } catch (err) {
      setError('Failed to load workflows. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
        <button 
          onClick={fetchWorkflows}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Active Workflows</h1>
        <span className="text-gray-600">{workflows.length} workflows</span>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 text-lg">No active workflows found</p>
          <p className="text-gray-400 text-sm mt-2">Create your first workflow to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <div 
              key={workflow.id}
              className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {/* Navigate to workflow details */}}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {workflow.name}
                </h3>
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                  {workflow.status}
                </span>
              </div>
              
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                {workflow.description}
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Type:</span>
                  <span className="font-medium text-gray-700">{workflow.workflowType}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span className="text-gray-700">{formatDate(workflow.createdAt)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Updated:</span>
                  <span className="text-gray-700">{formatDate(workflow.updatedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkflowListPage;
```

---

## UI/UX Recommendations

### 1. Page Layout
- **Header Section**: Display page title "Active Workflows" with total count
- **Action Buttons**: Include "Create New Workflow" button (if applicable)
- **Search & Filter**: Add search bar and filters for workflow type
- **Sort Options**: Allow sorting by name, date created, date updated

### 2. Workflow Card Design
Each workflow card should display:
- **Workflow Name** (prominent, bold)
- **Description** (truncated with "Show More" if too long)
- **Status Badge** (green for ACTIVE)
- **Workflow Type** (as a tag/chip)
- **Metadata** (Created date, Updated date)
- **Action Buttons** (View, Edit, Delete/Deactivate)

### 3. Loading States
- Show skeleton loaders or spinner while fetching data
- Display shimmer effect for better UX

### 4. Empty State
When no workflows exist:
- Display an empty state illustration
- Show message: "No active workflows found"
- Include a CTA button to create the first workflow

### 5. Error Handling
- Display user-friendly error messages
- Provide a "Retry" button
- Log detailed errors to console for debugging

### 6. Responsive Design
- **Mobile**: Single column layout with stacked cards
- **Tablet**: 2 columns
- **Desktop**: 3 columns or list view with more details

---

## Additional Features to Consider

### 1. Search & Filter
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [selectedType, setSelectedType] = useState<string | null>(null);

const filteredWorkflows = workflows.filter(workflow => {
  const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
  const matchesType = !selectedType || workflow.workflowType === selectedType;
  return matchesSearch && matchesType;
});
```

### 2. Pagination
If the list becomes large, implement pagination:
- Show 10-20 workflows per page
- Add pagination controls at the bottom
- Consider infinite scroll for better UX

### 3. Bulk Actions
- Select multiple workflows
- Bulk deactivate/activate
- Bulk delete

### 4. Quick Actions
- Clone workflow
- View execution history
- View associated triggers/schedules

### 5. Analytics
- Show workflow execution statistics
- Display success/failure rates
- Show last execution time

---

## Testing Checklist

- [ ] API integration works correctly
- [ ] Loading state displays properly
- [ ] Error handling works for all error types
- [ ] Empty state displays when no workflows exist
- [ ] Workflows display all required information
- [ ] Date formatting is correct
- [ ] Click handlers work for card interactions
- [ ] Responsive design works on mobile, tablet, desktop
- [ ] Search and filter functionality works (if implemented)
- [ ] Pagination works correctly (if implemented)

---

## Related API Endpoints

Based on the workflow system, you may need these additional endpoints:

- **Create Workflow**: `POST /admin-core-service/v1/workflow` (to be documented)
- **Update Workflow**: `PUT /admin-core-service/v1/workflow/{id}` (to be documented)
- **Delete Workflow**: `DELETE /admin-core-service/v1/workflow/{id}` (to be documented)
- **Get Workflow by ID**: `GET /admin-core-service/v1/workflow/{id}` (to be documented)

---

## Support & Questions

For any questions or issues regarding this implementation:
1. Check the backend service logs for API errors
2. Verify the institute ID is correct
3. Ensure authentication token is valid
4. Contact the backend team for additional endpoint documentation

---

**Last Updated:** November 3, 2025  
**API Version:** v1  
**Service:** Admin Core Service

