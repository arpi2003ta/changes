# SmartEdu Learning Platform

SanTra-AI is a full‑stack learning platform that combines classic e‑learning features with AI‑assisted tools. It provides separate experiences for **students** and **instructors**, including real‑time chat, course management, and AI‑powered exam and prediction utilities.

---

## Core Features

- **Role‑based access**  
  - Student and Instructor roles with distinct dashboards and routes.  
  - Protected routes and admin‑only sections on the same domain.

- **Course Management**  
  - Instructors can create, edit, and manage courses and lectures.  
  - Students can browse courses, enroll, and track course progress.

- **Student Dashboard**  
  - "My Learning" section for enrolled courses.  
  - Course progress view and detailed lecture pages.

- **Real‑Time Chat (Student ↔ Instructor)**  
  - One‑to‑one chat per course between student and instructor.  
  - Text, file, image, audio, and video messages.  
  - Read receipts and typing indicators.  
  - Online/offline status and unread message badges.  
  - Message and chat deletion (for both sides) with proper last‑message updates.

- **AI & Exam Features**  
  - AI‑assisted examiner flows for students and instructors.  
  - College predictor and roadmap utilities.  
  - OMR / prediction and reporting features planned or under development.

- **Authentication & Security**  
  - Email/password login with JWT (HTTP‑only cookies).  
  - Role embedded in the token and enforced on both backend and frontend.  
  - Protected API routes and admin‑only middleware.

- **UX Enhancements**  
  - Modern, responsive UI (React + Tailwind + Ant Design + Lucide icons).  
  - Error boundary with user‑friendly fallback UI.  
  - Browser compatibility and network/performance monitoring helpers.

---

## Tech Stack

- **Frontend**  
  - React (Vite)  
  - React Router  
  - Redux Toolkit & RTK Query (for auth & data fetching)  
  - Ant Design components  
  - TailwindCSS / custom styling  
  - Socket.IO client for real‑time chat

- **Backend**  
  - Node.js + Express  
  - MongoDB + Mongoose  
  - Socket.IO server for real‑time communication  
  - JWT authentication (HTTP‑only cookies)  
  - Cloudinary for media uploads (images, video, audio, files)  
  - Stripe (webhooks) for course purchase flows

---

## Project Structure (High Level)

```text
.
├─ client/                 # React frontend (Vite)
│  ├─ src/
│  │  ├─ pages/           # Student & admin pages
│  │  ├─ components/      # Reusable components (Chat, ProtectedRoutes, etc.)
│  │  ├─ features/        # Redux slices & RTK Query APIs
│  │  └─ app/             # Store configuration
│  └─ ...
├─ server/                 # Node/Express backend
│  ├─ controllers/        # Route controllers (user, chat, course, exam, ...)
│  ├─ models/             # Mongoose schemas (User, Course, Chat, Message, ...)
│  ├─ routes/             # Express routers
│  ├─ utils/              # Helpers (Cloudinary, JWT, socket utils)
│  └─ index.js            # Express + Socket.IO entry point
└─ README.md               # This file
```

---

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- MongoDB instance (local or hosted)
- Cloudinary account (for media)
- Stripe account (if you want to test purchase flows)

### 1. Clone the Repository

```bash
git clone &lt;your-repo-url&gt;
cd SanTra-AI
```

### 2. Install Dependencies

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd ../server
npm install
```

### 3. Environment Variables

Create `.env` (or similar) in the `server/` directory with at least:

```env
PORT=8080
MONGODB_URI=&lt;your-mongodb-uri&gt;
SECRET_KEY=&lt;jwt-secret&gt;
FRONTEND_URL=http://localhost:5173

STRIPE_SECRET_KEY=&lt;optional-for-purchases&gt;
STRIPE_WEBHOOK_SECRET=&lt;optional-for-webhooks&gt;

CLOUDINARY_CLOUD_NAME=&lt;your-cloud-name&gt;
CLOUDINARY_API_KEY=&lt;your-api-key&gt;
CLOUDINARY_API_SECRET=&lt;your-api-secret&gt;
```

For the frontend (`client/.env` or `client/.env.local`):

```env
VITE_API_URL=http://localhost:8080/api/v1
VITE_SOCKET_URL=http://localhost:8080
```

Adjust ports/URLs to match your setup.

### 4. Run the Backend

From `server/`:

```bash
npm run dev   # or npm start, depending on your scripts
```

The server will start Express + Socket.IO and expose all `/api/v1/*` routes.

### 5. Run the Frontend

From `client/`:

```bash
npm run dev
```

Open the URL shown by Vite (typically `http://localhost:5173`).

---

## Usage Overview

### Authentication

- Register or log in as a **student** or **instructor**.  
- Authentication is JWT‑based, stored in an HTTP‑only cookie named `token`.  
- The frontend loads the current user on app start using `useLoadUserQuery` and stores it in Redux.

### Student Flow

- Browse and search for courses.  
- Enroll (after purchase if required).  
- Access **My Learning** and **Course Progress**.  
- Open chat from a course to contact the instructor with questions, images, and files.

### Instructor (Admin) Flow

- Access the `/admin` area.  
- Manage courses and lectures (create, edit, update).  
- Open the embedded **Messages** panel to respond to student chats.  
- Use AI‑assisted examiner and reporting tools where configured.

### Real‑Time Chat

- Powered by **Socket.IO**.  
- Backend tracks connected users via `userSocketMap` (maps a user ID to all active socket IDs).  
- Events like `newMessage`, `messageDeleted`, `chatDeleted`, and `messagesRead` are emitted to all of a users active sockets, keeping multiple tabs/devices in sync.

---

## Contributing

1. Fork the repository.  
2. Create a feature branch: `git checkout -b feature/my-change`.  
3. Commit your changes with clear messages.  
4. Open a Pull Request describing:
   - What you changed.  
   - Any new environment variables.  
   - How to test the feature.

---

## Roadmap / Planned Work

- Complete and refine OMR & prediction flows.  
- Polish WhatsApp‑style chat UI (image zoom, media previews, emojis).  
- Google authentication and richer user profiles.  
- Additional reporting and analytics for instructors.

---

## License

This project is currently closed-source for personal/organizational use. If you plan to use or distribute it, please add an appropriate license or contact the author for permissions.
