# Online Assessment Live Monitor

A modern, real-time coding assessment and proctoring platform connecting a candidate IDE with automated sandboxed execution to a live recruiter console for proctoring, telemetry tracking, and assessment management.

---

## Key Features

### LeetCode-Style Multi-Language Execution Engine
- **Zero Boilerplate Overhead**: Candidates write only the solution class or function — no need to include headers, import libraries, or write `main()`.
- **First-Class Data Structure Support**:
  - **Binary Trees (`TreeNode`)**: Automatic level-order array parsing and reconstruction (e.g. `[1, 2, 3, null, 4]`).
  - **Linked Lists (`ListNode`)**: Automatic serialization to and from array representations.
  - **1D & 2D Vectors/Matrices**: Clean handling of nested arrays and matrices across C++ (`vector<vector<T>>`), Java (`int[][]`), Python, and JavaScript.
  - **Non-Const Reference Binding**: Temporary wrappers (`__ref_wrap`, `__vec`, `__mat`) allowing literals to bind seamlessly to non-const C++ references (e.g. `vector<int>& nums`).
- **Resilient Dual Execution**: Powered by **Judge0 CE** inside Docker with automatic native compiler fallback (`g++`, `python3`, `node`) for 100% execution reliability.
- **Robust Output Normalizer**: Normalizes quotes, booleans, floating-point precision, arrays, and JSON outputs to ensure accurate testcase verification.

### AI-Powered Question Generator (Gemini)
- **Instant Challenge Generation**: Generates novel coding questions tailored by topic, difficulty (`easy`, `medium`, `hard`), and testcase count.
- **Strict LeetCode Schemas**: Automatically produces valid signatures and starter boilerplates for C++, Java, Python, and JavaScript.
- **Arithmetic & Testcase Safeguards**: Step-by-step arithmetic verification rules preventing hallucinated outputs.

### Real-Time Proctoring & Anomaly Telemetry
- **Candidate Telemetry**: Real-time event detection for:
  - Tab switching / window blurring (`blur`)
  - Paste operations (`paste`)
  - Macro and mass-keystroke inputs (`macro`)
  - Clipboard copying outside the IDE (`copy`)
- **Dynamic Fraud Score Indexing**: Continuously computes a weighted 0–100 risk score based on proctoring infractions.
- **High-Performance Telemetry Buffer**: Telemetry logs are buffered in memory and bulk-inserted into MongoDB in batched transactions.
- **Candidate Lockout**: Proctors can immediately disqualify / lockout compromised sessions with a single click.

### Server-Authoritative Exam Timers & Code Persistence
- **Persistent Exam Timer**: Synchronized via server timestamps and `session_sync` socket events — candidate timers never restart from the full duration upon browser refresh.
- **Auto-Submission**: Automatically evaluates and finalizes the candidate test when the timer reaches zero.
- **Zero Code Loss on Refresh**: All candidate code and submissions are preserved in local storage and mirrored to server `codeHistory`. Refreshing the page or switching questions seamlessly restores previous solutions.

### Recruiter Dashboard & Analytics
- **Live Performance Matrix**: Displays real-time candidate statuses, questions solved (`X/Y Qs Solved`), and testcase breakdown.
- **Leaderboard & Top Performers**: Dynamically ranks candidates by solved questions, testcase completion, and fraud score.
- **Live Code Inspector (`LiveCodeModal`)**:
  - Live candidate code viewing with syntax highlighting.
  - History viewer to inspect earlier question submissions.
  - One-click assessment export to PDF.
- **Real-Time Proctor Chat**: Direct bidirectional communication between recruiter and candidates.

---

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, MongoDB, Mongoose, Judge0 CE (Docker)
- **Frontend**: React 19, Vite, Tailwind CSS, Monaco Editor, Lucide Icons, jsPDF
- **Compiler / Runner Support**: GCC 11+ (`g++`), Python 3.8+, Node.js 18+, OpenJDK 13+

---

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **MongoDB** (Local instance or MongoDB Atlas)
- **Docker** *(Optional, recommended for Judge0 sandbox)*
- **C++ Compiler** (`g++`) & **Python** *(Optional for host-level native runner fallback)*

### Installation

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-username/Online-Assessment-live-monitor.git
   cd Online-Assessment-live-monitor
   npm install
   ```

2. Create a `.env` file in the root directory (or copy `.env.example`):
   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/online_assessment_monitor
   JUDGE0_API_URL=http://127.0.0.1:2358
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running Locally

Start the combined Express backend and Vite frontend server:
```bash
npm run dev
```

The application will start on:
- **Application Portal**: [http://localhost:3000](http://localhost:3000)

---

## Workflow Guide

### 1. Recruiter Workflow
1. Navigate to `http://localhost:3000` and switch to the **Recruiter** tab.
2. Sign up or log in.
3. Open the **Exam Setup** panel:
   - Configure exam duration and add coding questions manually or click **Generate with AI** to create custom challenges using Gemini.
   - Click **Save Exam**.
4. Generate candidate **Invite Codes** under the Invites tab.
5. Click **Start Exam** to allow candidates to begin coding.
6. Monitor candidate risk scores, code changes, and test submissions in real time.

### 2. Candidate Workflow
1. Navigate to `http://localhost:3000` and select the **Candidate** tab.
2. Enter your name and valid invite code.
3. Complete the assessment in the Monaco IDE:
   - Switch between JavaScript, Python, C++, and Java.
   - Use `Ctrl + '` to run code against sample test cases.
   - Use `Ctrl + Enter` to submit solutions.
4. When finished, submit the test or let the timer auto-submit.

---

## Project Structure

```text
Online-Assessment-live-monitor/
├── backend/
│   ├── config/         # MongoDB and environment setup
│   ├── controllers/    # API controllers (auth, execute, AI, invite, exam)
│   ├── models/         # Mongoose schemas (Session, Exam, Settings, Telemetry)
│   ├── routes/         # Express API routes
│   ├── services/       # CodeRunner (Judge0/native), Gemini AI, Fraud scoring
│   ├── sockets/        # Candidate, recruiter, and telemetry Socket.io handlers
│   └── server.js       # Express + Socket.io + Vite dev middleware entry point
├── frontend/
│   ├── src/
│   │   ├── components/ # Candidate IDE & Recruiter UI components
│   │   ├── context/    # SocketContext and auth state
│   │   ├── hooks/      # Behavior tracker and custom hooks
│   │   ├── pages/      # Login, CandidateIDE, RecruiterConsole
│   │   └── lib/        # Utility helpers and testcase output comparison
│   └── index.html
├── .env.example
├── package.json
└── README.md
```

---

## License
This project is open-source and available under the [MIT License](LICENSE).
