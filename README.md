# 🎓 BMSCE AI Voice Assistant

An **AI-powered Voice Assistant** designed to answer queries related to **BMS College of Engineering (BMSCE)**.  
The system crawls information from the BMSCE website and documents, processes it into a structured knowledge dataset, and uses **Retrieval Augmented Generation (RAG)** with an LLM to provide accurate answers through a **voice interface**.

---

# 🚀 Features

- 🌐 Crawls BMSCE website pages and documents
- 📄 Extracts information from **HTML pages and PDFs**
- 🧠 Builds a **structured knowledge dataset**
- 🔎 Retrieval-Augmented Generation (RAG)
- 🎤 Voice input using **Deepgram Speech-to-Text**
- 🔊 Voice output using **Azure Speech Services**
- 🤖 AI responses generated using **LLM (Grok API)**

---

# 🏗 System Architecture

```

User Voice
↓
Speech-to-Text (Deepgram)
↓
User Question
↓
Knowledge Retrieval
↓
LLM Answer Generation (Grok API)
↓
Text-to-Speech (Azure)
↓
Voice Response

````

---

# 📂 Project Structure

```
bmsce-ai-voice-assistant
│
├── backend
│   │
│   ├── src
│   │   ├── crawler
│   │   │   ├── crawl.js
│   │   │   └── test-pdfs.js
│   │   │
│   │   ├── processors
│   │   │   └── process-dataset.js
│   │   │
│   │   ├── ai
│   │   │   └── rag.js
│   │   │
│   │   └── server.js
│   │
│   ├── data
│   │   ├── raw_bmsce.xlsx
│   │   └── knowledge.json
│   │
│   ├── package.json
│   └── .env.example
│
├── frontend
│   │
│   ├── src
│   ├── public
│   ├── package.json
│   └── .env.example
│
└── README.md
````

---

# ⚙️ Installation

## 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/bmsce-ai-voice-assistant.git
cd bmsce-ai-voice-assistant
```

---

## 2️⃣ Install Backend Dependencies

```bash
cd backend
npm install
```

---

## 3️⃣ Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

# 🔑 Environment Variables

The project requires environment variables for API keys and configuration.

Create `.env` files in both the **backend** and **frontend** folders using the examples below.

---

# Backend `.env`

Create:

```
backend/.env
```

Example configuration:

```env
PORT=3000

# LLM API
GROK_API_KEY=

# Speech-to-Text
DEEPGRAM_API_KEY=

# Azure Text-to-Speech
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=southeastasia
```

---

## Backend Environment Variables

| Variable            | Description                         |
| ------------------- | ----------------------------------- |
| PORT                | Backend server port                 |
| GROK_API_KEY        | API key used for Grok LLM responses |
| DEEPGRAM_API_KEY    | API key for Deepgram speech-to-text |
| AZURE_SPEECH_KEY    | Azure Speech Service key            |
| AZURE_SPEECH_REGION | Azure speech service region         |

---

# Frontend `.env`

Create:

```
frontend/.env
```

Example configuration:

```env
VITE_DEEPGRAM_API_KEY=
```

---

## Frontend Environment Variables

| Variable              | Description                                   |
| --------------------- | --------------------------------------------- |
| VITE_DEEPGRAM_API_KEY | API key used for browser speech transcription |

---

# ⚠️ Security Note

Never commit `.env` files to GitHub.

Only `.env.example` files should be committed.

Ensure `.gitignore` includes:

```
.env
```

---

# ▶️ Running the Project

## Start Backend

```bash
cd backend
node src/server.js
```

---

## Start Frontend

```bash
cd frontend
npm run dev
```

Frontend typically runs on:

```
http://localhost:5173
```

Backend runs on:

```
http://localhost:3000
```

---

# 📊 Dataset Pipeline

The system builds its knowledge dataset in two stages.

---

## Step 1 — Crawl BMSCE Website

Run the crawler:

```bash
node src/crawler/crawl.js
```

Output:

```
data/raw_bmsce.xlsx
```

This file contains raw extracted data from:

* BMSCE webpages
* PDF documents
* Notices
* Academic policies

---

## Step 2 — Process Dataset

Convert raw dataset into structured knowledge format:

```bash
node src/processors/process-dataset.js
```

Output:

```
data/knowledge.json
```

---

# 🧠 Knowledge Dataset Format

Example structure:

```json
{
  "id": 1,
  "source": "https://bmsce.ac.in/admissions",
  "content": "Admission process at BMSCE requires the following documents..."
}
```

This dataset is used for **retrieval in the RAG pipeline**.

---

# 🤖 AI Prompt Format

The system uses **Retrieval Augmented Generation (RAG)**.

Example prompt sent to the LLM:

```
You are an assistant for BMS College of Engineering.

Use the provided context to answer the question.

Context:
<retrieved documents>

Question:
<user question>
```

---

# 🧪 PDF Extraction Testing

To test PDF extraction:

```bash
node src/crawler/test-pdfs.js
```

Example output:

```
🧪 Testing BMSCE PDFs...

[1/5] 🔍 http://www.bmsce.in/...pdf
✅ Extracted Successfully
```

---

# 📦 Backend Dependencies

Key libraries used:

* **axios** – HTTP requests
* **cheerio** – HTML parsing
* **xlsx** – Excel dataset handling
* **fs** – File system operations
* **path** – Path utilities

---

# 🔮 Future Improvements

Planned improvements:

* Vector database integration (FAISS / Pinecone)
* Semantic search using embeddings
* Better dataset tagging
* Improved PDF extraction
* Conversation memory for the assistant

---

# 📜 License
BMSCE 

---

# 👨‍💻 Contributors

Project developed for **BMS College of Engineering AI Voice Assistant**.

Contributions and improvements are welcome.

# Authors
Anurodh Prasai
Shailesh Acharya
