# Frontend (React + Cytoscape)

React application for uploading PDFs and visualizing extracted knowledge graphs using Cytoscape.js. The app is responsive, offering different layouts for desktop and mobile.

## Setup and Run Instructions

### 1. Install dependencies 

```powershell
npm install
```

### 2. Start the development server

```powershell
npm start
```

The frontend will start at http://localhost:3000

### 3. Connect to the backend

The frontend expects the backend to be running at http://localhost:8000

If you need to change the API URL, you can set the environment variable:

```powershell
$env:REACT_APP_API_BASE="http://your-backend-url"; npm start
```

## Features

- **File Upload**: Submit PDFs to the backend for processing
- **Interactive Graph**: Visualize and explore knowledge graphs with Cytoscape.js
- **Responsive Design**:
  - Desktop: Three-column layout with side panel showing selected node details
  - Mobile: Single-column layout; tap nodes to expand their connections

## Troubleshooting

- **'react-scripts' is not recognized**: Run `npm install` to install all dependencies
- **Network Error**: Make sure the backend server is running at http://localhost:8000
- **Empty Graph**: No data in Neo4j yet - upload and process a PDF first
