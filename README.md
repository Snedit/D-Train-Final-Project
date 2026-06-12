<div align="center">

<img src="https://github.com/user-attachments/assets/ce7df309-b8cf-425c-9b7e-3e6fad9545ad" alt="DTrain Logo" width="130"/>

<h1>DTrain</h1>

<h3>Distributed AI Model Training Platform — Powered by the Crowd</h3>

**Final Year B.Tech Project — Department of Computer Science & Engineering**
<table align="center" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" width="120">
      <img src="https://github.com/user-attachments/assets/4813de92-b61f-4098-b97a-2103c76733f1" height="75" alt="HETC Logo"/>
    </td>
    <td align="center" width="420">
      <strong>Hooghly Engineering & Technology College, Hooghly</strong><br/>
      Department of Computer Science & Engineering<br/>
      <em>Affiliated to Maulana Abul Kalam Azad University of Technology, West Bengal</em><br/>
      <strong>2025–26</strong>
    </td>
    <td align="center" width="120">
      <img src="https://github.com/user-attachments/assets/46a8f717-f20f-41da-94b3-be3f536ff14d" height="75" alt="MAKAUT Logo"/>
    </td>
  </tr>
</table>
<br/>
</div>

---

## <img width="22" height="22" alt="clapperboard" src="https://github.com/user-attachments/assets/54966b81-fc6f-4bea-95ad-27d52dabc4d7" align="absmiddle"/> Demo
 
[DTrain Demo Video](https://your-demo-video-url-here.mp4)
 
> 📽️ *Replace the URL above with your actual video link (GitHub upload, Google Drive, or YouTube). GitHub supports direct .mp4 embeds in READMEs.*

---

## <img width="22" height="22" alt="table-of-contents" src="https://github.com/user-attachments/assets/d99e8c64-372d-4ddc-a94d-8a638872bd7b" align="absmiddle"/> Table of Contents

1. [About DTrain](#anchor-about)
2. [The Problem It Solves](#anchor-problem)
3. [Key Features](#anchor-features)
4. [System Architecture](#anchor-architecture)
5. [How It Works](#anchor-how-it-works)
   - [User Flow](#user-flow-step-by-step)
   - [Worker Flow](#worker-flow-step-by-step)
   - [The AI Pricing Engine](#the-ai-pricing-engine)
   - [Payment & Wallet System](#payment--wallet-system)
6. [Performance & Cost Analysis](#anchor-performance)
7. [Tech Stack](#anchor-tech-stack)
8. [Project Structure](#anchor-project-structure)
9. [Prerequisites](#anchor-prerequisites)
10. [Environment Variables](#anchor-env)
11. [Setup & Installation](#anchor-setup)
12. [Running the Project](#anchor-running)
13. [API Reference](#anchor-api)
14. [Full Walkthrough](#anchor-walkthrough)
15. [Team](#anchor-team)
16. [License](#anchor-license)

---

<a name="anchor-about"></a>
## <img width="22" height="22" alt="about" src="https://github.com/user-attachments/assets/bcbb8c2f-15d6-47a2-b70c-2382b25bb789" align="absmiddle"/> About DTrain

**DTrain** is a full-stack peer-to-peer distributed AI model training platform. It connects **ML researchers and developers** who need compute power with **GPU owners** who have idle machines — and handles everything in between: job analysis, pricing, payment escrow, execution, log streaming, and automatic payout.

Think of it as **Airbnb for GPU compute**. A user uploads their Python training code as a ZIP file, DTrain's two-layer AI pricing engine (rule-based scorer + Groq LLM) estimates job complexity and sets a flat price. The user reviews and pays. A worker's Electron desktop agent picks up the job, runs it inside an isolated Docker container, streams logs back live via Socket.IO, and uploads the trained model to Supabase when done. Payment settles automatically — the worker earns 80%, the platform takes 20%.

No cloud accounts. No infrastructure setup. No per-hour billing surprises.

---

<a name="anchor-problem"></a>
## <img width="22" height="22" alt="problem" src="https://github.com/user-attachments/assets/c0ba776e-9050-45e6-8078-0a1af076483a" align="absmiddle"/> The Problem It Solves

| Pain Point | Reality Today |
|---|---|
| **Cloud GPU costs** | AWS p3.2xlarge costs ~₹280/hr. A BERT fine-tune can run 3–4 hours = ₹840–₹1120 for one job |
| **Queue times** | Colab Pro disconnects. Kaggle limits. University HPC has multi-day queues |
| **Infrastructure complexity** | Setting up CUDA drivers, Docker, cloud IAM, storage buckets takes hours |
| **No live feedback** | Cloud batch jobs give you nothing until they're done — or crashed |
| **Wasted idle GPUs** | Millions of consumer GPUs (gaming PCs) sit at 0% utilisation every night |
| **No micropayment layer** | Sharing compute ad-hoc has no billing, escrow, or trust mechanism |

DTrain solves all six simultaneously.

---

<a name="anchor-features"></a>
## <img width="22" height="22" alt="features" src="https://github.com/user-attachments/assets/b55e2c71-c446-43c8-9280-e33995438d4e" align="absmiddle"/> Key Features

- **AI-powered job pricing** — Groq LLM + rule-based static analyser reads your `requirements.txt` and training script to estimate complexity and assign a fair flat price from a ₹10–₹500 tier ladder. No surprises.
- **Draft → Publish flow** — jobs are created as drafts with a price preview before any payment is taken. Users can review and cancel.
- **Stripe escrow** — funds are reserved (not charged) on publish. Charge only happens on successful completion. Full refund on failure.
- **Real-time log streaming** — every `stdout`/`stderr` line from the Docker container is pushed via Socket.IO to the user's browser as it happens.
- **Docker isolation** — every training job runs in a fresh, sandboxed Docker container. No cross-job interference, no host machine access.
- **Electron desktop agent** — a one-click Windows installer turns any gaming PC into a worker node. No terminal, no config files.
- **Automatic worker payout** — when a job completes, the worker's in-platform wallet is credited instantly. Payout requests go through Stripe Connect.
- **Worker hardware detection** — the Electron agent auto-detects OS, CPU, RAM, and GPU on registration.
- **80/20 revenue split** — workers keep 80% of every job's tier price. Platform takes 20%.

---

<a name="anchor-architecture"></a>
## <img width="22" height="22" alt="architecture" src="https://github.com/user-attachments/assets/376863df-5853-466a-a007-cf469bb0f51a" align="absmiddle"/> System Architecture
 
The platform has four distinct application layers that communicate via REST APIs and WebSockets:
 
![DTrain System Architecture](https://github.com/user-attachments/assets/1baa0c26-9f41-47d4-be91-da52cca65b38)
 
### Component Responsibilities

| Component | Tech | Purpose |
|---|---|---|
| `frontend/` | React 18, TypeScript, Tailwind, Vite | User dashboard — job submission, live log view, wallet top-up, model download |
| `backend/` | Express.js v5, Socket.IO, Mongoose | Central API — auth, job lifecycle, pricing, payment webhooks, log relay |
| `worker-ui/` | React, Tailwind, Vite | Browser UI for workers — view earnings, request payouts, set pricing preferences |
| `electron-worker/` | Electron, Node.js, Docker | Desktop agent — polls jobs, spins Docker containers, streams logs, uploads output |

---

<a name="anchor-how-it-works"></a>
## <img width="22" height="22" alt="settings" src="https://github.com/user-attachments/assets/8786cd6c-f8a1-48cb-85d6-bd436dc3703d" align="absmiddle"/> How It Works
 
### User Flow (Step by Step)
 
![DTrain User Flow Sequence](https://github.com/user-attachments/assets/014a0ee8-9498-48d5-ab02-4c8776709982)

---
 
### Worker Flow (Step by Step)

1. **Register** — Worker opens the Electron app, which auto-detects device specs (OS, CPU, RAM, GPU via `os` module + Docker stats) and calls `POST /api/worker/register`.
2. **Poll** — Every ~5 seconds, the agent calls `GET /api/worker/available-jobs?deviceId=...`. This also acts as a heartbeat — if no poll arrives in 60s, the backend marks the worker offline.
3. **Accept** — Agent accepts the first available job. Backend atomically assigns it (prevents two workers grabbing the same job).
4. **Execute** — Agent downloads the ZIP from Supabase, extracts it to a temp folder, and runs:
   ```bash
   docker run --rm -v /tmp/job_xyz:/workspace python:3.10-slim bash -c "pip install -r requirements.txt && python train.py"
   ```
5. **Stream** — Every line of `stdout`/`stderr` is POSTed to the backend, which relays it to the user via Socket.IO.
6. **Complete** — Output files are zipped and uploaded to Supabase. The agent calls `POST /api/worker/complete-job`. Backend settles payment and credits the worker wallet.

---

### The AI Pricing Engine

Job pricing uses a **two-layer scoring system** to prevent both under-pricing heavy jobs and over-pricing trivial ones:

**Layer 1 — Rule-based static analyser** (`paymentHelpers.js`)

Scans `requirements.txt` (comment lines stripped) and the main Python file for known signals:

| Signal | Score Added |
|---|---|
| `torch` / `pytorch` in requirements | +40 pts |
| `tensorflow` / `keras` | +40 pts |
| `transformers` / `diffusers` (Hugging Face) | +45 pts |
| `xgboost` / `lightgbm` / `catboost` | +20 pts |
| `scikit-learn` | +10 pts |
| `numpy` / `pandas` | +2 pts |
| `n_samples` ≥ 100,000 in code | +30 pts |
| `n_samples` ≥ 50,000 | +20 pts |
| Epoch count ≥ 100 | +15 pts |
| Multi-GPU / distributed training patterns | +20 pts |

**Layer 2 — Groq LLM** reads the full script and returns its own complexity score 0–100.

The final score = `max(rule_score, groq_score)`. This is then mapped to the tier ladder:

```
Score  0–10  → ₹10    Score 11–20  → ₹20    Score 21–30  → ₹30
Score 31–40  → ₹40    Score 41–50  → ₹50    Score 51–60  → ₹75
Score 61–70  → ₹100   Score 71–80  → ₹150   Score 81–88  → ₹200
Score 89–93  → ₹300   Score 94–97  → ₹400   Score 98–100 → ₹500
```

**Revenue split:**
```
Worker receives = tier_price × 0.80
Platform fee    = tier_price × 0.20
```

---

### Payment & Wallet System

DTrain uses a **reserve → charge** model powered by Stripe to protect both parties:

```
User tops up wallet  →  Stripe payment intent
                              ↓
User publishes job   →  Funds RESERVED (not charged)
                              ↓
Worker accepts job   →  Job locked to worker
                              ↓
  ┌── Job SUCCESS ─────────────────────────────────────────┐
  │   Funds CHARGED · Worker wallet +80% · Platform +20%   │
  └────────────────────────────────────────────────────────┘
  ┌── Job FAILED / TIMEOUT ────────────────────────────────┐
  │   Reservation RELEASED · Full refund to user wallet    │
  └────────────────────────────────────────────────────────┘
```

Workers can request a payout from their in-platform wallet to their bank account via Stripe Connect at any time.

---

<a name="anchor-performance"></a>
## <img width="22" height="22" alt="bar-chart" src="https://github.com/user-attachments/assets/b4d9d02b-eb7d-4446-bf20-09e1e1b4cf05" align="absmiddle"/> Performance & Cost Analysis

The following benchmarks compare estimated training time and cost across four compute setups for common ML workloads. All values are derived mathematically from published GPU TFLOPS specifications and real AWS spot pricing.

> **Methodology:** `Time = Total FLOPs ÷ (GPU TFLOPS × utilisation factor)`.
> GTX 1060 ≈ 4 TFLOPS @ 70% util · RTX 4090 ≈ 82.6 TFLOPS @ 85% util · AWS V100 ≈ 14 TFLOPS @ 90% util · DTrain assumes 3–5 mid-range workers (GTX 1080 Ti / RTX 3070, ~12 TFLOPS avg, 10% coordination overhead).
> AWS cost = time × ₹280/hr (p3.2xlarge spot). Local PC = electricity at ₹8/kWh. DTrain cost = flat tier price from the ₹10–₹500 platform ladder.

### Training Time Comparison

![Training Time Comparison](https://github.com/user-attachments/assets/53c1d118-05aa-4ae3-bc2a-fc3d44b3f5c7)

### Cost Per Job Comparison

![Cost Comparison](https://github.com/user-attachments/assets/f29dd6d8-6583-4049-8f60-ce0e1659b792)

### DTrain Speed-up Factor vs Low-end PC

![Speed-up Factor](https://github.com/user-attachments/assets/a22dfea3-3311-49f7-a1cf-d4ee97463f1c)

### Full Numbers at a Glance

| Model / Task | Low-end PC | ✅ DTrain | High-end PC | AWS Cloud |
|---|:---:|:---:|:---:|:---:|
| **Scikit-learn** — time | 1.4h | **0.35h** | 0.25h | 0.18h |
| **Scikit-learn** — cost | ₹9 | **₹20** | ₹4 | ₹50 |
| **XGBoost** — time | 5.2h | **1.1h** | 0.8h | 0.55h |
| **XGBoost** — cost | ₹33 | **₹40** | ₹12 | ₹154 |
| **PyTorch CNN** — time | 18.4h | **4.1h** | 2.7h | 1.8h |
| **PyTorch CNN** — cost | ₹118 | **₹100** | ₹43 | ₹504 |
| **BERT fine-tune** — time | 38.0h | **6.8h** | 5.2h | 3.4h |
| **BERT fine-tune** — cost | ₹243 | **₹200** | ₹83 | ₹952 |

### Platform Feature Comparison

| Platform | Cost (CNN job) | Setup Time | Live Logs | Auto Billing | Job Isolation |
|---|---|---|---|---|---|
| AWS EC2 p3.2xlarge | ₹504 | 30–60 min | ❌ | ❌ | Full VM |
| Google Colab Pro | ₹900/month flat | 5–10 min | ❌ | ❌ | Shared runtime |
| Paperspace Gradient | ₹400–₹800 | 15 min | Partial | ❌ | Container |
| Local machine only | ~₹118 (electricity) | 0 min | ❌ | N/A | None |
| **✅ DTrain** | **₹100 flat** | **~2 min** | **✅ Real-time** | **✅ Stripe** | **Docker** |

> **DTrain's sweet spot** is medium-to-heavy jobs (PyTorch CNNs, Transformers) where it is **4–6× faster** than a low-end PC and **74–80% cheaper** than AWS — with zero cloud account setup required.

---

<a name="anchor-tech-stack"></a>
## <img width="22" height="22" alt="tech-stack" src="https://github.com/user-attachments/assets/8fcd412e-4df8-4501-9a66-8225010cd620" align="absmiddle"/> Tech Stack
 
### Backend (`backend/`)
 
| Technology | Version | Role |
|---|---|---|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white) | v20+ | Runtime |
| ![Express.js](https://img.shields.io/badge/Express.js-000000?logo=express&logoColor=white) | v5 | REST API framework |
| ![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?logo=socket.io&logoColor=white) | 4.8 | Real-time bidirectional communication (log streaming, worker status) |
| ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white) ![Mongoose](https://img.shields.io/badge/Mongoose-880000?logo=mongoose&logoColor=white) | Atlas + v9 | Primary database — jobs, users, workers, billing, transactions |
| ![Redis](https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white) | v5 (ioredis) | Job queue, pub-sub messaging between backend and workers |
| ![Groq](https://img.shields.io/badge/Groq_SDK-F55036?logo=groq&logoColor=white) | v1.2 | LLM inference for job complexity analysis |
| ![Stripe](https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white) | v22 | Payment intents, webhooks, wallet management, Connect payouts |
| ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white) | v2 | Object storage for ZIP uploads and model output files |
| ![JWT](https://img.shields.io/badge/JWT-000000?logo=jsonwebtokens&logoColor=white) | v9 | Stateless auth — access tokens signed with `JWT_SECRET` |
| ![bcryptjs](https://img.shields.io/badge/bcryptjs-338?logoColor=white) | v3 | Password hashing |
| ![Multer](https://img.shields.io/badge/Multer-FF6600?logoColor=white) | v2 | Multipart file upload handling |
| ![adm-zip](https://img.shields.io/badge/adm--zip-F5A623?logoColor=white) | v0.5 | ZIP validation and file extraction on the server |
| ![Morgan](https://img.shields.io/badge/Morgan-555555?logoColor=white) | v1.10 | HTTP request logging |
 
### Frontend (`frontend/`) — User Dashboard
 
| Technology | Version | Role |
|---|---|---|
| ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) | 18.3 | UI framework |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) | 5.5 | Type safety |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white) | 5.4 | Build tool and dev server |
| ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white) | 3.4 | Utility-first styling |
| ![Socket.IO](https://img.shields.io/badge/Socket.IO_Client-010101?logo=socket.io&logoColor=white) | 4.8 | Real-time log streaming and job status updates |
| ![Stripe](https://img.shields.io/badge/Stripe_React-635BFF?logo=stripe&logoColor=white) | 6.6 / 9.7 | Embedded Stripe Checkout UI |
| ![Recharts](https://img.shields.io/badge/Recharts-22B5BF?logoColor=white) | 3.1 | Job stats and earnings charts |
| ![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?logo=framer&logoColor=white) | 12 | Page transition animations |
| ![React Router](https://img.shields.io/badge/React_Router-CA4245?logo=reactrouter&logoColor=white) | 7.13 | Client-side routing |
| ![React Dropzone](https://img.shields.io/badge/React_Dropzone-61DAFB?logo=react&logoColor=black) | 14 | ZIP file drag-and-drop upload |
| ![Lucide](https://img.shields.io/badge/Lucide_React-F56565?logoColor=white) | 0.344 | Icon set |
 
### Worker UI (`worker-ui/`) — Worker Dashboard
 
| Technology | Version | Role |
|---|---|---|
| ![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) | 18 / 5.5 | UI framework |
| ![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?logo=tailwindcss&logoColor=white) | 5.4 / 3.4 | Build + styling |
| ![Socket.IO](https://img.shields.io/badge/Socket.IO_Client-010101?logo=socket.io&logoColor=white) | 4.8 | Live job status updates |
 
### Electron Worker Agent (`electron-worker/`)
 
| Technology | Role |
|---|---|
| ![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white) | Desktop app shell — system tray, native window, IPC |
| ![Node.js](https://img.shields.io/badge/Node.js_child__process-339933?logo=node.js&logoColor=white) | Spawn Docker process, capture and stream stdout/stderr |
| ![Node.js](https://img.shields.io/badge/Node.js_os_module-339933?logo=node.js&logoColor=white) | Detect CPU, RAM, platform for worker registration |
| ![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white) | Run isolated training container for each job |
| ![node-fetch](https://img.shields.io/badge/node--fetch-339933?logo=node.js&logoColor=white) | HTTP calls to backend API (job polling, log push, completion) |
| ![adm-zip](https://img.shields.io/badge/adm--zip-F5A623?logoColor=white) | Extract job ZIP before passing to Docker |
 
---
 
<a name="anchor-project-structure"></a>
## <img width="22" height="22" alt="project-structure" src="https://github.com/user-attachments/assets/a1a9740f-b472-43b6-878f-b00cc790ca8e" align="absmiddle"/> Project Structure

<pre>
<img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> <b>dtrain/</b>
│
├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> <b>backend</b>                                       # Express.js REST API + Socket.IO server
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> middlewares
│   │   └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> authMiddleware.js                    # JWT verify → attaches req.user to every protected route
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> routes
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> JobRoutes.js                         # /create  /publish  /cancel  /list  /:id
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> PaymentRoutes.js                     # Stripe checkout, webhook handler, wallet top-up & payout
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> UserRoutes.js                        # /signup  /signin  /profile
│   │   └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> WorkerRoutes.js                      # /register  /available-jobs  /accept  /push-log  /complete  /fail
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> schemas                                   # Mongoose data models (MongoDB)
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> BillingSchema.js                     # Per-job billing record — links user ↔ job ↔ worker
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> JobMetricsSchema.js                  # Training duration, resource usage snapshots
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> JobSchema.js                         # Core model — status enum, pricing, logs[], config{}
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> QuoteSchema.js                       # Pricing quote audit trail per job
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> TransactionSchema.js                 # Wallet credit / debit ledger
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> UserSchema.js                        # email, passwordHash, walletBalance
│   │   └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> WorkerSchema.js                      # deviceId, gpu, currentStatus, walletBalance
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> utils
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> jwt.js                               # signToken / verifyToken helpers
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> <b>paymentHelpers.js</b> ⭐                  # Tier scoring engine + Groq LLM call + 80/20 split logic
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> redis.js                             # Redis publisher instance (job queue pub-sub)
│   │   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> stripeClient.js                      # Stripe SDK singleton
│   │   └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> supabaseClient.js                    # Supabase client (service role — ZIP upload & model fetch)
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> .gitignore
│   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> <b>index.js</b> ⭐                            # Entry point — Express app, Socket.IO setup, DB connect
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package-lock.json
│   └── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package.json
│
├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> <b>electron-worker</b>                               # Desktop worker agent (Windows .exe)
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> assets
│   │   ├── <img width="16" height="16" alt="image" src="https://github.com/user-attachments/assets/061bec95-2d34-4eb4-a44a-1f3de3b79fe2" align="absmiddle"/> icon.ico
│   │   └── <img width="16" height="16" alt="image" src="https://github.com/user-attachments/assets/061bec95-2d34-4eb4-a44a-1f3de3b79fe2" align="absmiddle"/> icon.png
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> release                                   # Build output — do not edit manually
│   │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> win-unpacked
│   │   │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> locales                          # Electron i18n locale packs (auto-generated)
│   │   │   │   └── <img width="16" height="16" alt="generic-files" src="https://github.com/user-attachments/assets/7c05b581-e5fc-4d89-a3b8-01205ef234fb" align="absmiddle"/> *.pak  (55 languages)
│   │   │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> resources
│   │   │   │   ├── <img width="16" height="16" alt="generic-files" src="https://github.com/user-attachments/assets/7c05b581-e5fc-4d89-a3b8-01205ef234fb" align="absmiddle"/> app.asar                     # Packaged Electron app bundle
│   │   │   │   └── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> elevate.exe
│   │   │   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> DTrain Worker.exe               # Unpacked executable (for testing)
│   │   │   └── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> *.dll / *.pak / *.bin           # Chromium runtime dependencies
│   │   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> <b>DTrain Worker Setup 1.0.0.exe</b> ⭐       # Distributable installer (electron-builder)
│   │   ├── <img width="16" height="16" alt="generic-files" src="https://github.com/user-attachments/assets/7c05b581-e5fc-4d89-a3b8-01205ef234fb" align="absmiddle"/> DTrain Worker Setup 1.0.0.exe.blockmap
│   │   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> builder-debug.yml
│   │   └── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> builder-effective-config.yaml
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> .gitignore
│   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> <b>main.js</b> ⭐                              # Core agent — job polling, Docker spawn, log streaming, upload
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package-lock.json
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package.json
│   └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> preload.js                                 # Electron contextBridge — IPC between main ↔ renderer
│
├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> <b>frontend</b>                                      # User-facing React app  (port 5173)
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> public
│   │   ├── <img width="16" height="16" alt="generic-files" src="https://github.com/user-attachments/assets/7c05b581-e5fc-4d89-a3b8-01205ef234fb" align="absmiddle"/> Favicon.ico
│   │   ├── <img width="16" height="16" alt="image" src="https://github.com/user-attachments/assets/061bec95-2d34-4eb4-a44a-1f3de3b79fe2" align="absmiddle"/> logo.png
│   │   └── <img width="16" height="16" alt="image" src="https://github.com/user-attachments/assets/061bec95-2d34-4eb4-a44a-1f3de3b79fe2" align="absmiddle"/> logo1.png
│   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> src
│   │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> components
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> ActiveWorkers.tsx               # Live map / list of online worker nodes
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>Dashboard.tsx</b> ⭐                   # Job list, status filters, stats overview
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> Documentation.tsx               # In-app how-to guide
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> HeroSection.tsx                 # Landing page — hero, CTA, feature highlights
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>JobDetail.tsx</b> ⭐                   # Live log stream, status timeline, model download
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>JobSubmission.tsx</b> ⭐               # Multi-step: upload → AI pricing preview → publish & pay
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> PendingJobs.tsx                 # Queue view of jobs awaiting a worker
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> ProfileDropdown.tsx             # User menu — profile info, sign out
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> RunningJobs.tsx                 # Live view of currently processing jobs
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> SignIn.tsx                      # Login form with JWT storage
│   │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> SignUp.tsx                      # Registration form
│   │   │   └── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>Wallet.tsx</b> ⭐                      # Balance card, Stripe top-up, transaction history
│   │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> types
│   │   │   └── <img width="16" height="16" alt="ts" src="https://github.com/user-attachments/assets/b85e4564-6bfc-41b9-a59e-5fbd71787cf6" align="absmiddle"/> index.ts                         # Shared TypeScript interfaces — Job, Worker, User, Billing...
│   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> App.tsx                             # Root component — router + auth guard
│   │   ├── <img width="16" height="16" alt="css" src="https://github.com/user-attachments/assets/020b2930-34ab-4bdd-b270-3ab6d49db9d9" align="absmiddle"/> index.css                            # Tailwind base styles
│   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> main.tsx                             # React DOM entry point
│   │   └── <img width="16" height="16" alt="ts" src="https://github.com/user-attachments/assets/b85e4564-6bfc-41b9-a59e-5fbd71787cf6" align="absmiddle"/> vite-env.d.ts                        # Vite env type declarations
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> .gitignore
│   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> eslint.config.js
│   ├── <img width="16" height="16" alt="html" src="https://github.com/user-attachments/assets/64650b83-ff5e-49f8-8776-a396ed9d3059" align="absmiddle"/> index.html                           # HTML shell — Vite injects bundle here
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package-lock.json
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package.json
│   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> postcss.config.js
│   ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> tailwind.config.js
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> tsconfig.app.json
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> tsconfig.json
│   ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> tsconfig.node.json
│   └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> vite.config.ts
│
└── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> <b>worker-ui</b>                                     # Worker browser dashboard  (port 3000)
    ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> public
    │   ├── <img width="16" height="16" alt="generic-files" src="https://github.com/user-attachments/assets/7c05b581-e5fc-4d89-a3b8-01205ef234fb" align="absmiddle"/> Favicon.ico
    │   ├── <img width="16" height="16" alt="image" src="https://github.com/user-attachments/assets/061bec95-2d34-4eb4-a44a-1f3de3b79fe2" align="absmiddle"/> logo.png
    │   └── <img width="16" height="16" alt="image" src="https://github.com/user-attachments/assets/061bec95-2d34-4eb4-a44a-1f3de3b79fe2" align="absmiddle"/> logo1.png
    ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> src
    │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> components
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> Documentation.tsx               # In-app guide for workers
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> HeroSection.tsx                 # Worker landing / onboarding page
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> JobDetail.tsx                   # Per-job detail with log preview
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>PayoutRequest.tsx</b> ⭐               # Payout form → POST /api/payment/payout-request
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> PricingSettings.tsx             # Worker sets minimum accepted job price
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> RunningJobs.tsx                 # Active job monitor with live log preview
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> SignIn.tsx                      # Worker login
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> SignUp.tsx                      # Worker registration
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> WalletCard.tsx                  # Earnings balance + payout trigger
    │   │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>WorkerDashboard.tsx</b> ⭐              # Earnings summary, recent jobs, wallet overview
    │   │   └── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> <b>WorkerRegistration.tsx</b> ⭐          # First-time device registration — sends hardware specs
    │   ├── <img width="16" height="16" alt="folder" src="https://github.com/user-attachments/assets/de395ce2-8800-4e62-82e5-a0fef0e4b385" align="absmiddle"/> types
    │   │   └── <img width="16" height="16" alt="ts" src="https://github.com/user-attachments/assets/b85e4564-6bfc-41b9-a59e-5fbd71787cf6" align="absmiddle"/> index.ts                         # Shared TypeScript interfaces
    │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> App.tsx                             # Router + auth guard
    │   ├── <img width="16" height="16" alt="css" src="https://github.com/user-attachments/assets/020b2930-34ab-4bdd-b270-3ab6d49db9d9" align="absmiddle"/> index.css
    │   ├── <img width="16" height="16" alt="tsx" src="https://github.com/user-attachments/assets/fe00f5d7-171e-4bbc-a1b4-fdec688d0f51" align="absmiddle"/> main.tsx
    │   └── <img width="16" height="16" alt="ts" src="https://github.com/user-attachments/assets/b85e4564-6bfc-41b9-a59e-5fbd71787cf6" align="absmiddle"/> vite-env.d.ts
    ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> .gitignore
    ├── <img width="16" height="16" alt="md" src="https://github.com/user-attachments/assets/5cb3af8a-3509-4660-912c-881f0e7d13cb" align="absmiddle"/> README.md
    ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> eslint.config.js
    ├── <img width="16" height="16" alt="html" src="https://github.com/user-attachments/assets/64650b83-ff5e-49f8-8776-a396ed9d3059" align="absmiddle"/> index.html
    ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package-lock.json
    ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> package.json
    ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> postcss.config.js
    ├── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> tailwind.config.js
    ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> tsconfig.app.json
    ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> tsconfig.json
    ├── <img width="16" height="16" alt="config" src="https://github.com/user-attachments/assets/5618d9e1-5db0-4d6a-ab92-35087bc1528a" align="absmiddle"/> tsconfig.node.json
    └── <img width="16" height="16" alt="js" src="https://github.com/user-attachments/assets/e8290f91-60ad-4ba0-9640-700a1a8ee589" align="absmiddle"/> vite.config.ts
</pre>

---

<a name="anchor-prerequisites"></a>
## <img width="22" height="22" alt="prerequisites" src="https://github.com/user-attachments/assets/0956021f-40c2-411c-8a49-dff1cbf783b2" align="absmiddle"/> Prerequisites

Ensure the following are installed and configured before running DTrain:

**Runtime & Tools**
- [Node.js](https://nodejs.org) v20 or later + npm v10+
- [Git](https://git-scm.com)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — required on any machine running the Electron worker agent

**Cloud Services (all have free tiers)**
- [MongoDB Atlas](https://cloud.mongodb.com) — free M0 cluster is sufficient for development
- [Supabase](https://supabase.com) — create a project and a storage bucket named `jobs`
- [Stripe](https://stripe.com) — test mode keys work for the full flow
- [Groq](https://console.groq.com) — free API key for `llama3-70b-8192` or compatible model
- [Redis](https://redis.io) — run locally via Docker (instructions below)

---

<a name="anchor-env"></a>
## <img width="22" height="22" alt="env" src="https://github.com/user-attachments/assets/cad6bd03-a0d1-483e-b165-3d4cd241c59b" align="absmiddle"/> Environment Variables

Create a file named `.env` inside the `backend/` directory. **Never commit this file** — it is already in `.gitignore`.

```env
# ── Database ─────────────────────────────────────────────────────────────────
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=DTrain

# ── Supabase (object storage for ZIPs and model outputs) ─────────────────────
SUPABASE_URL=https://<project-id>.supabase.co
SUPABASE_SERVICE_ROLE=eyJ...   # Service role key (NOT the anon key)

# ── Redis (job queue) ─────────────────────────────────────────────────────────
REDIS_URL=redis://127.0.0.1:6379

# ── Authentication ────────────────────────────────────────────────────────────
JWT_SECRET=<minimum-32-char-random-string>

# ── Stripe (payments) ─────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-stripe-webhook-secret>

# ── Groq AI (job complexity pricing) ─────────────────────────────────────────
GROQ_API_KEY=gsk_<your-groq-api-key>

# ── Server ────────────────────────────────────────────────────────────────────
PORT=5000
FRONTEND_URL=http://localhost:5173
```

### Where to find each value

| Variable | Where to get it |
|---|---|
| `MONGO_URI` | MongoDB Atlas → Clusters → Connect → Drivers |
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE` | Supabase dashboard → Project Settings → API → `service_role` key |
| `JWT_SECRET` | Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → signing secret |
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |

---

<a name="anchor-setup"></a>
## <img width="22" height="22" alt="setup" src="https://github.com/user-attachments/assets/576236e0-4ce0-40b2-804c-a04c7be79d30" align="absmiddle"/> Setup & Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/<your-org>/dtrain.git
cd dtrain
```

### Step 2 — Start Redis (via Docker)

DTrain uses Redis as a job queue and pub-sub channel. Start a Redis container:

```bash
docker run --name dtrain-redis -p 6379:6379 -d redis
```

Confirm it's running:

```bash
docker ps
# Should show dtrain-redis with status "Up"
```

To stop and remove later:
```bash
docker stop dtrain-redis && docker rm dtrain-redis
```

### Step 3 — Configure environment variables

```bash
cd backend
cp .env.example .env   # if .env.example exists, otherwise create from scratch
# Fill in all values as described in the Environment Variables section above
```

### Step 4 — Install all dependencies

Run from the project root:

```bash
# Backend
cd backend && npm install && cd ..

# User frontend
cd frontend && npm install && cd ..

# Worker browser UI
cd worker-ui && npm install && cd ..

# Electron desktop agent
cd electron-worker && npm install && cd ..
```

### Step 5 — Supabase storage bucket

In your Supabase project, create a storage bucket named `jobs` and set it to **public** (so the signed URLs the backend generates are accessible to workers and users).

---

<a name="anchor-running"></a>
## <img width="22" height="22" alt="play" src="https://github.com/user-attachments/assets/f86fe8bd-93a1-49ba-bd0a-a1d8a4c45630" align="absmiddle"/> Running the Project

Open **four separate terminal windows** from the project root directory:

### Terminal 1 — Backend API

```bash
cd backend
npm run dev
```

Expected output:
```
Server running on port 5000
MongoDB connected ✅
Redis connected ✅
```

### Terminal 2 — Frontend (User Dashboard)

```bash
cd frontend
npm run dev
```

Open → `http://localhost:5173`

### Terminal 3 — Worker UI

```bash
cd worker-ui
npm run dev
```

Open → `http://localhost:3000` 

### Terminal 4 — Electron Worker Agent

```bash
cd electron-worker
npm start
```

> ⚠️ **Docker Desktop must be running** before you launch the Electron agent. The agent spawns Docker containers to execute jobs. Without Docker running, job execution will fail immediately.

---

### Running order matters

```
Docker Desktop  →  Redis container  →  Backend  →  Frontend / Worker UI  →  Electron Agent
```

---

<a name="anchor-api"></a>
## <img width="22" height="22" alt="api" src="https://github.com/user-attachments/assets/2601e2c0-7f4d-4fca-904b-9e91bb15cba8" align="absmiddle"/> API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/user/signup` | None | Register new user |
| POST | `/api/user/signin` | None | Login, returns JWT |
| GET | `/api/user/profile` | JWT | Get current user |

### Jobs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/` | JWT | List user's jobs (all statuses) |
| POST | `/api/jobs/create` | JWT | Upload ZIP, analyse, save as draft |
| POST | `/api/jobs/publish/:id` | JWT | Pay & publish draft to workers |
| GET | `/api/jobs/:id` | JWT | Get single job with logs |
| POST | `/api/jobs/cancel/:id` | JWT | Cancel a draft or pending job |

### Workers

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/worker/register` | JWT | Register device + hardware specs |
| GET | `/api/worker/available-jobs` | None* | Poll for pending jobs (heartbeat) |
| POST | `/api/worker/accept-job` | None* | Claim a job |
| POST | `/api/worker/push-log` | None* | Stream a log line |
| POST | `/api/worker/complete-job` | None* | Mark job done + trigger payout |
| POST | `/api/worker/fail-job` | None* | Report failure + trigger refund |

*Worker endpoints use `deviceId` for identification rather than JWT.

### Payments

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/payment/checkout` | JWT | Create Stripe payment intent |
| POST | `/api/payment/webhook` | Stripe sig | Handle Stripe events |
| GET | `/api/payment/wallet` | JWT | Get wallet balance + history |
| POST | `/api/payment/topup` | JWT | Add funds to wallet |
| POST | `/api/payment/payout-request` | JWT | Worker requests bank payout |

---

<a name="anchor-walkthrough"></a>
## <img width="22" height="22" alt="walkthrough" src="https://github.com/user-attachments/assets/1d84c1d7-5144-4d72-99b5-1aecd9d126e0" align="absmiddle"/> Full Walkthrough

**Manual walkthrough to test the full flow:**

**As a User:**
1. Open `http://localhost:5173` → Sign up
2. Go to Wallet → Top Up → use Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC)
3. Go to Dashboard → Submit Job
4. Upload a ZIP containing your Python training script + `requirements.txt`
5. Enter your main filename (e.g. `train.py`)
6. Click **Analyse** — wait for the AI pricing engine to return a price
7. Review the price and click **Publish** — pay from your wallet
8. Navigate to the job detail page — wait for a worker to pick it up

**As a Worker:**
1. Open Docker Desktop — make sure it's running
2. Launch the Electron worker app (`npm start` in `electron-worker/`)
3. Open `http://localhost:3000` → Sign up as a worker → Register device
4. The agent will automatically poll and pick up the published job
5. Watch logs stream in real time on both the worker agent and the user's job detail page
6. When done, the model is uploaded and your wallet is credited

---

<a name="anchor-team"></a>
## <img width="22" height="22" alt="team" src="https://github.com/user-attachments/assets/d2b9b626-fa9c-4b94-bfe8-0fd6769a0803" align="absmiddle"/> Team
 
| Role | Name | Roll No. | GitHub | LinkedIn |
|---|---|---|---|---|
| <img width="18" height="18" alt="team-member" src="https://github.com/user-attachments/assets/c9206ee0-65f5-4998-8c10-54c79243c955" align="absmiddle"/> Team Member | **Debjit Mitra** | 17600122046 | [![GitHub](https://img.shields.io/badge/GitHub-171515?logo=github&logoColor=white)](https://github.com/debjitmitra000/) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/debjitmitra000/) |
| <img width="18" height="18" alt="team-member" src="https://github.com/user-attachments/assets/c9206ee0-65f5-4998-8c10-54c79243c955" align="absmiddle"/> Team Member | **Soham De** | 17600122062 | [![GitHub](https://img.shields.io/badge/GitHub-171515?logo=github&logoColor=white)](https://github.com/Snedit/) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/soham-de-b5bb2b25b/) |
| <img width="18" height="18" alt="team-member" src="https://github.com/user-attachments/assets/c9206ee0-65f5-4998-8c10-54c79243c955" align="absmiddle"/> Team Member | **Akash Poddar** | 17600122071 | [![GitHub](https://img.shields.io/badge/GitHub-171515?logo=github&logoColor=white)]() | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://github.com/akash150149/) |
| <img width="18" height="18" alt="team-member" src="https://github.com/user-attachments/assets/c9206ee0-65f5-4998-8c10-54c79243c955" align="absmiddle"/> Team Member | **Sourodip Ghosh** | 17600122040 | [![GitHub](https://img.shields.io/badge/GitHub-171515?logo=github&logoColor=white)](https://www.linkedin.com/in/sourodip-ghosh-177662253/) | [![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?logo=linkedin&logoColor=white)](https://github.com/RajSourodip/) |
| <img width="18" height="18" alt="mentor" src="https://github.com/user-attachments/assets/72bdb4b0-1549-4aef-ba6f-124b473b192b" align="absmiddle"/> Project Mentor | **Ms. Agnimita Banerjee** | Assistant Professor, Dept. of CSE | — | — |
 
---
 
## <img width="22" height="22" alt="roadmap" src="https://github.com/user-attachments/assets/baa78a47-b58c-4e66-866c-ed6981d86f35" align="absmiddle"/> Roadmap

Potential improvements and features for future versions:

- GPU-accelerated Docker containers (NVIDIA Container Toolkit)
- Multi-worker job parallelism (data-parallel training)
- Worker reputation and rating system
- macOS and Linux Electron agent builds
- Job template library (common training scripts)
- Webhook notifications (email/Slack on job completion)
- Admin dashboard for platform analytics
- Worker GPU benchmarking before job assignment

---

<a name="anchor-license"></a>
## <img width="22" height="22" alt="license" src="https://github.com/user-attachments/assets/56e9961d-014c-43ed-adbe-4ff655abbdb3" align="absmiddle"/> License

This project was submitted as an academic final year B.Tech capstone project. All rights reserved by the authors and institution. Not licensed for commercial use or redistribution without explicit written permission from the team.

---

<div align="center">
  <br/>
  <p>Built for reliability, distributed compute, and real-world ML accessibility</p>
  <a href="https://github.com/snedit/D-Train-Final-Project/stargazers">
    <img src="https://img.shields.io/badge/⭐_Star_This_Repo-171515?style=for-the-badge&logo=github&logoColor=white" alt="Star on GitHub"/>
  </a>
  <br/><br/>
  <sub>Made with ❤️ by Debjit, Soham, Akash & Sourodip &nbsp;·&nbsp; B.Tech Final Year Project 2025–26 &nbsp;·&nbsp; HETC, Hooghly</sub>
</div>
