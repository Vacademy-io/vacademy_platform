# Workflow Feature Setup

## Installation Required

To use the workflow visualization feature, you need to install React Flow:

```bash
# Clear npm cache (if you encounter permission issues)
npm cache clean --force

# Install React Flow with legacy peer deps
npm install reactflow --legacy-peer-deps
```

## Features Implemented

### 1. Workflow List Page
- **Route:** `/workflow/list`
- **Features:**
  - View all active workflows for your institute
  - Search workflows by name or description
  - Filter workflows by type (Event Driven, Scheduled, etc.)
  - Beautiful card-based grid layout
  - Click on any workflow card to view details

### 2. Workflow Details Page
- **Route:** `/workflow/{workflowId}`
- **Features:**
  - View workflow information (name, description, status, type, dates)
  - Interactive automation diagram using React Flow
  - Visual representation of workflow nodes and connections
  - Click on nodes to see detailed configuration
  - Zoom, pan, and minimap controls for easy navigation

### 3. Workflow Diagram Visualization
- **Node Types:**
  - 🚀 TRIGGER - Starting points (green)
  - ⚙️ ACTION - Executable steps (blue)
  - 🔀 DECISION - Conditional logic (yellow)
  - 📧 EMAIL - Email sending (purple)
  - 🔔 NOTIFICATION - Notifications (indigo)
  - 💾 DATABASE - Database operations (red)
  - 🔗 WEBHOOK - API integrations (orange)
  - ❓ UNKNOWN - Undefined types (gray)

- **Features:**
  - Animated edges showing workflow flow
  - Interactive nodes with hover effects
  - Detailed node configuration viewer
  - Minimap for large diagrams
  - Zoom and pan controls

## API Endpoints Used

1. **Get Active Workflows:**
   - `GET /admin-core-service/v1/workflow/institute/{instituteId}`

2. **Get Workflow Diagram:**
   - `GET /admin-core-service/v1/automations/{workflowId}/diagram`

## File Structure

```
src/
├── routes/
│   └── workflow/
│       ├── list/
│       │   ├── index.tsx                    # Workflow list route
│       │   └── -components/
│       │       ├── workflow-list-page.tsx   # Main list component
│       │       └── workflow-card.tsx        # Workflow card component
│       └── $workflowId/
│           ├── index.tsx                    # Workflow details route
│           └── -components/
│               ├── workflow-details-page.tsx        # Main details component
│               ├── workflow-diagram-viewer.tsx      # React Flow viewer
│               └── workflow-node-component.tsx      # Custom node component
├── services/
│   └── workflow-service.ts                 # API service functions
├── types/
│   └── workflow/
│       └── workflow-types.ts               # TypeScript interfaces
└── constants/
    └── urls.ts                             # API endpoint constants
```

## Usage

### Accessing Workflows
1. Navigate to the sidebar and click on "Workflows"
2. Browse the list of active workflows
3. Use the search bar to find specific workflows
4. Filter by workflow type using the filter buttons

### Viewing Workflow Details
1. Click on any workflow card in the list
2. View the workflow information at the top
3. Interact with the automation diagram:
   - Scroll to zoom in/out
   - Drag to pan around
   - Click on nodes to see configuration details
   - Use the minimap for navigation in large diagrams

### Node Details
- Click on any node in the diagram to open a modal
- View node type, description, and full configuration
- Configuration details are displayed in a readable format

## Troubleshooting

### React Flow Not Working
If you see errors related to React Flow:
1. Make sure you've installed the library: `npm install reactflow --legacy-peer-deps`
2. Clear your npm cache: `npm cache clean --force`
3. Restart your development server

### Diagram Not Loading
- Check browser console for API errors
- Verify the workflow ID exists in the database
- Ensure you have proper authentication tokens
- Check that the backend service is running

### Permission Issues with npm
If you encounter EACCES errors:
```bash
# Fix npm permissions
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config

# Then try installing again
npm install reactflow --legacy-peer-deps
```

## Next Steps (Optional Enhancements)

1. **Workflow Execution:**
   - Add ability to manually trigger workflows
   - Show execution history and logs

2. **Workflow Editor:**
   - Create/edit workflows in the UI
   - Drag-and-drop node creation
   - Visual connection editing

3. **Advanced Filtering:**
   - Filter by creation date
   - Filter by creator
   - Sort by various criteria

4. **Export Features:**
   - Export diagram as PNG/SVG
   - Export workflow configuration as JSON

5. **Real-time Updates:**
   - WebSocket integration for live workflow status
   - Auto-refresh on workflow changes

---

**Last Updated:** November 3, 2025
**Created by:** AI Assistant

