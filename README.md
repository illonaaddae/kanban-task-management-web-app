# Kanban Task Management Web App

A full-featured, production-ready task management application built with **React 19**, **TypeScript**, and **appwrite** for the AmaliTech Module Lab. This project demonstrates scalable state management, secure authentication, and responsive design patterns.

![Kanban App Screenshot](./preview.jpg)

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Getting Started](#getting-started)
5. [Architecture](#architecture)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [License](#license)

---

## Overview

This application serves as a modern productivity tool allowing teams and individuals to organize tasks across customized boards. It moves beyond basic CRUD operations to offer a drag-and-drop interface, real-time updates, and a global state management system powered by **Zustand**.

### Live Demo
[View Live Application](#) <!-- Replace with actual deployment link -->

---

## Key Features

### Core Functionality
- **Multi-Board Management**: Create, edit, and delete boards to organize different projects.
- **Task Operations**: Full CRUD capabilities for tasks with subtasks support.
- **Drag & Drop**: Intuitive drag-and-drop interface for moving tasks between columns (ToDo / Doing / Done).
- **Subtask Tracking**: Monitor progress within individual tasks.

### User Experience
- **Responsive Interface**: Optimized layout for Mobile, Tablet, and Desktop devices.
- **Theme Support**: Integrated Dark and Light modes with local persistence.
- **Form Validation**: robust input validation and error handling.
- **Interactive Feedback**: Real-time toast notifications for user actions.

### Security & State
- **Authentication**: Secure login and registration powered by Appwrite.
- **Route Protection**: Guarded routes ensuring restricted access to private boards.
- **State Persistence**: Automatic saving of user preferences and session data.

---

## Technology Stack

### Frontend Core
- **React 19**
- **TypeScript 5**
- **Vite** (Build Tool)

### State Management & Routing
- **Zustand** (Global Store)
- **React Router 7**
- **Context API** (Theme/Auth)

### UI & UX
- **CSS Modules** (Scoped Styling)
- **@dnd-kit** (Drag and Drop primitives)
- **react-hot-toast** (Notifications)
- **React Hook Form** (Form Handling)

### Backend & Services
- **Appwrite** (Auth, Database, Storage)

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Appwrite instance (local or cloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kanban-task-management-web-app.git
   cd kanban-task-management-web-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env` file in the root directory:
   ```env
   VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=your_project_id
   VITE_APPWRITE_DATABASE_ID=your_database_id
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

---

## Architecture

The project follows a modular architecture designed for scalability:

```
src/
├── components/       # Reusable UI components (Modals, Inputs, Cards)
├── context/          # React Contexts (Theme, Auth wrappers)
├── hooks/            # Custom hooks (useBoardDnd, useAuth)
├── pages/            # Page-level components (Dashboard, BoardView)
├── services/         # API integration layer (Appwrite, Mock)
├── store/            # Zustand store slices (Auth, Board, Task)
├── styles/           # Global styles and variables
└── types/            # TypeScript interface definitions
```

---

## Testing

The application includes a comprehensive test suite covering unit and integration tests.

```bash
# Run all tests
npm test

# Run with UI coverage report
npm run test:ui
```

**Coverage Areas:**
- Authentication Logic
- Protected Routes
- Theme Context
- State Store Reducers

---

## Deployment

### Deploy to Vercel
```bash
npm install -g vercel
vercel
```

### Deploy to Netlify
1. Build the project: `npm run build`
2. Deploy the `dist` directory.
3. Ensure redirect rules are configured for SPA routing (`/* /index.html 200`).

---

## License

This project is open-source and available under the **MIT License**.
