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

The application has a foundational test suite built with **Vitest** and **React Testing Library**, covering components, global state, mocked API calls, and user interactions.

### Commands

```bash
# Run all tests once
npm test

# Run in watch mode (re-runs on file changes)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Structure

Tests are co-located with their source files in `__tests__` subdirectories:

```
src/
├── components/
│   ├── board/__tests__/
│   │   ├── TaskCard.test.tsx     # Renders title, subtask count, modal on click
│   │   └── Column.test.tsx       # Renders name, task count, empty state
│   ├── modals/__tests__/
│   │   └── AddBoardModal.test.tsx # Form input, submit, validation
│   └── __tests__/
│       └── ProtectedRoute.test.tsx # Auth redirect, authenticated access
├── context/__tests__/
│   └── ThemeContext.test.tsx     # Theme toggle, persistence, document class
├── pages/__tests__/
│   ├── Dashboard.test.tsx        # Loading/error/empty/data states
│   ├── Login.test.tsx            # Form rendering, input values
│   └── NotFound.test.tsx         # 404 page rendering
├── services/__tests__/
│   └── boardApi.test.ts          # Mocked Appwrite CRUD + error paths + localStorage fallback
└── store/__tests__/
    └── boardSlice.test.ts        # fetchBoards, createBoard, deleteBoard state transitions
```

### What Is Tested

| Area | Test File(s) | Key Assertions |
|---|---|---|
| **Environment** | `vitest.config.ts`, `setupTests.ts` | jsdom, globals, jest-dom matchers |
| **Components** | `TaskCard`, `Column`, `Dashboard` | Props → DOM, loading/error/empty states |
| **State** | `boardSlice.test.ts` | Loading flags, data population, error handling |
| **API (Mocked)** | `boardApi.test.ts` | vi.mock on Appwrite, success + error + fallback |
| **User Interactions** | `AddBoardModal`, `ProtectedRoute` | userEvent / fireEvent, form submission, redirects |

### Configuration

- **Framework:** Vitest v2 with jsdom environment
- **Config file:** `vitest.config.ts`
- **Setup file:** `src/setupTests.ts` (registers `@testing-library/jest-dom` matchers)
- **Coverage provider:** v8 with text + HTML reporters
- **Coverage report:** `coverage/index.html` after running `npm run test:coverage`

### Adding New Tests

1. Create a `__tests__/` folder next to the file you want to test
2. Name the file `ComponentName.test.tsx` (or `.test.ts` for non-React)
3. Mock any external dependencies with `vi.mock()`
4. Use `useStore.setState(...)` to set up Zustand state for component tests

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
