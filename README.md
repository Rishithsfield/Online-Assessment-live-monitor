# 🚀 Online Assessment Live Monitor

[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

An enterprise-grade, real-time algorithmic assessment and live proctoring platform. Features an interactive candidate IDE, zero-boilerplate multi-language code execution engine (C++17, Python 3, Java, JavaScript), dynamic fraud telemetry, and an interactive recruiter monitoring dashboard with Gemini AI challenge generation.

---

## 🌟 Key Features

### 1. Function-Level Multi-Language Execution Engine
- **Zero-Boilerplate Pure Solutions**: Candidates write only algorithmic solutions inside standard classes or functions (e.g. `class Solution { public: int solution(...) }`). No manual imports, headers, or `main()` boilerplate required.
- **Deep Data Structure Deserialization**:
  - **Binary Trees (`TreeNode`)**: Automatic level-order array parsing and reconstruction (e.g., `[1, 2, 3, null, 4]`).
  - **Linked Lists (`ListNode`)**: Automatic serialization to and from array representations.
  - **1D & 2D Vectors & Matrices**: Clean handling of nested matrices across C++ (`vector<vector<T>>`), Java (`int[][]`, `String[][]`), Python, and JavaScript.
  - **Non-Const Reference Binding**: Transparent wrapper templates (`__ref_wrap`, `__vec`, `__mat`, `__mat_char`) allowing array and string literals to bind seamlessly to non-const C++ references (e.g. `vector<int>& nums`).
  - **Void & Value-Returning Function Support**: C++17 `if constexpr (is_void_v<invoke_result_t<F>>)` and Java `isVoid` branches handle both in-place modifications and value-returning algorithms without compiler errors.
- **Resilient Dual Execution**:
  - **Primary**: Sandboxed **Judge0 CE** API client with automatic token polling and auth header support.
  - **Secondary**: Native container compiler fallback (`g++ -O2 -std=c++17`, `python3`, `javac -encoding UTF-8`, `node`) guaranteeing 100% execution reliability even when cloud Docker containers lack cgroup access.
- **Fuzzy Output Normalizer**: Normalizes quotes, booleans, floating-point precision, arrays, and JSON outputs to ensure accurate testcase verification.

### 2. Multi-Language IDE with Per-Language Draft Memory
- **Monaco Code Editor**: Full syntax highlighting, auto-completion, and keybindings for C++, Python, Java, and JavaScript.
- **Instant Language Switching**: Switching languages immediately swaps starter boilerplates or restores candidate drafts written in that language.
- **Per-Language State Persistence**: Candidate code drafts for every question and language are stored in a structured dictionary, preventing code loss when exploring multiple languages.

### 3. AI-Powered Question Generator (Google Gemini)
- **Instant Challenge Generation**: Generates novel algorithmic questions tailored by topic, difficulty (`easy`, `medium`, `hard`), and testcase constraints.
- **Standardized Solution Schemas**: Automatically produces valid signatures and starter boilerplates across all 4 supported languages.
- **Multi-Model Reliability**: Intelligent fallback across modern Gemini models (`gemini-flash-lite-latest`, `gemini-3.1-flash-lite`, `gemini-flash-latest`) with schema-enforced validation.

### 4. Real-Time Proctoring & Telemetry
- **Candidate Anomaly Detection**:
  - Tab switching and window blur tracking (`blur`)
  - Paste operations and clipboard inspection (`paste`)
  - Macro and mass-keystroke inputs (`macro`)
  - Clipboard copy operations (`copy`)
- **Dynamic Fraud Risk Scoring**: Computes a weighted 0–100 risk score based on proctoring infractions.
- **Batched Telemetry Buffer**: Telemetry logs are buffered in memory and bulk-inserted into MongoDB in batched transactions to minimize database load.
- **One-Click Disqualification**: Proctors can immediately terminate compromised candidate sessions.

### 5. Multi-Recruiter Isolation & Exam Lifecycle
- **Unlimited Recruiter Scalability**: Recruiter monitoring sockets are partitioned into isolated rooms (`recruiter_monitor_${recruiterId}`), allowing multiple recruiters to conduct independent exams simultaneously without event crosstalk.
- **Server-Authoritative Exam Timers**: Synchronized via server timestamps and `session_sync` socket events — candidate timers never reset on page refresh.
- **Resilient Database Queries**: Employs `buildRecruiterFilter` supporting both BSON `ObjectId` and `String` representations in MongoDB Atlas.
- **Live Code Inspector (`LiveCodeModal`)**:
  - Real-time candidate keystroke viewing with syntax highlighting.
  - History viewer to inspect past question submissions.
  - One-click PDF report export.
- **Proctor Chat**: Direct bidirectional communication between recruiters and candidates.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Monaco Editor (`@monaco-editor/react`), Lucide Icons, jsPDF |
| **Backend** | Node.js 20 (ESM), Express 4.21, Socket.io 4.8 |
| **Database** | MongoDB Atlas with Mongoose 9 |
| **AI Engine** | Google Gemini API (`@google/genai`) |
| **Execution** | Judge0 CE (REST API) & Native Host Fallback (`g++`, `python3`, `javac`, `node`) |
| **Deployment** | Docker (`node:20-bookworm-slim`), Railway |

---

## 🏗️ Architecture

```text
[ Candidate Browser (Monaco IDE) ]         [ Recruiter Browser (Console) ]
       |                                                |
       |--- Telemetry (blur, paste, macro) ------------>|
       |--- Code Sync (live keystrokes) --------------->|
       |--- Question Submissions ---------------------->|
       |<-- Sync (startTime, duration, scores, code) <--|
       |                                                |
       +--------------------+---------------------------+
                            |
                     [ Socket.io Gateway ]
                            |
               +------------+------------+
               |                         |
       [ Express REST API ]     [ MongoDB Atlas Database ]
               |                  - Sessions
        [ CodeRunner ]            - Exams & Questions
        - Judge0 (Docker/API)     - Question Templates
        - Native Host Fallback    - Telemetry Buffers
          (g++, python3, javac)   - Settings & Auth
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or higher (v20 recommended)
- **MongoDB**: Local MongoDB instance or MongoDB Atlas connection string
- **C++ / Python / Java**: Optional locally if you want native compilation fallbacks outside of Docker

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/Rishithsfield/Online-Assessment-live-monitor.git
cd Online-Assessment-live-monitor

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory (refer to `.env.example`):

```env
PORT=3000
APP_URL=http://localhost:3000

# MongoDB Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/examdb?retryWrites=true&w=majority

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_key_here

# Google Gemini API Key for question generation
GEMINI_API_KEY=your_gemini_api_key_here

# Judge0 Code Execution API URL (Optional / Recommended)
JUDGE0_API_URL=http://127.0.0.1:2358
```

### 3. Running Locally

```bash
# Start development server (Express backend + Vite HMR)
npm run dev
```

Open your browser at:
- **Application Portal**: [http://localhost:3000](http://localhost:3000)

### 4. Production Build

```bash
# Build the Vite frontend into dist/
npm run build

# Start the production Node server
npm start
```

---

## 🐳 Docker Deployment

The repository includes a production-ready `Dockerfile` based on `node:20-bookworm-slim` with `build-essential` (`g++`, `gcc`, `make`), `python3`, and `openjdk-17-jdk-headless` pre-installed:

```bash
# Build the Docker image
docker build -t assessment-monitor .

# Run the container
docker run -p 3000:3000 --env-file .env assessment-monitor
```

---

## 📖 User Workflows

### Recruiter Workflow
1. Navigate to [http://localhost:3000](http://localhost:3000) and click **Recruiter**.
2. Sign up or log in.
3. Open the **Exam Setup** panel:
   - Configure duration, title, and add questions manually or click **Generate with AI** to create algorithmic challenges with Gemini.
   - Click **Save Exam**.
4. Generate candidate **Invite Codes** under the Invites tab.
5. Click **Start Exam** to activate candidate entry.
6. Monitor candidate keystrokes, fraud risk scores, and submissions live on the dashboard.

### Candidate Workflow
1. Navigate to [http://localhost:3000](http://localhost:3000) and select **Candidate**.
2. Enter your name and valid invite code.
3. Complete the assessment in the Monaco IDE:
   - Switch between JavaScript, Python, C++, and Java anytime.
   - Press `Ctrl + '` to run code against sample test cases.
   - Press `Ctrl + Enter` to submit solutions.
4. When finished, submit the test or allow the timer to auto-submit upon expiration.

---

## 📁 Repository Structure

```text
Online-Assessment-live-monitor/
├── backend/
│   ├── config/         # Database and environment initialization
│   ├── controllers/    # Express route controllers (auth, execute, AI, invite, exam)
│   ├── middleware/     # JWT authentication middleware
│   ├── models/         # Mongoose schemas (Session, Exam, QuestionTemplate, Telemetry)
│   ├── routes/         # Express API routers
│   ├── services/       # CodeRunner (Judge0/native), Gemini AI, TelemetryBuffer
│   ├── sockets/        # Socket.io handlers (candidate, recruiter, chat, telemetry)
│   ├── utils/          # Recruiter query helpers ($or ObjectId/String matching)
│   └── server.js       # HTTP server, Vite middleware, and Socket.io bootstrap
├── frontend/
│   ├── src/
│   │   ├── components/ # Candidate IDE & Recruiter UI components
│   │   ├── context/    # SocketContext and authentication state
│   │   ├── hooks/      # Behavior tracker and custom hooks
│   │   ├── pages/      # Login, CandidateIDE, RecruiterConsole
│   │   └── lib/        # Utility helpers and output normalizer (compareOutputs)
│   └── index.html
├── Dockerfile          # Production container image (Debian 12 + compilers)
├── .dockerignore       # Docker build exclusions
├── .env.example        # Environment variable template
├── package.json        # Dependencies and scripts
└── README.md           # Project documentation
```
