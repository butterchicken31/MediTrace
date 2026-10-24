# MediTrace 

### AI-Assisted Prescription Safety Checker

MediTrace is a student-built health-tech prototype that explores how medicine lookup, prescription checks, and AI-assisted search can help users understand potential medication safety concerns.

The project combines a web-based frontend, a FastAPI backend, a medicine dataset, and an experimental Groq-powered AI integration.

> **Medical disclaimer:** MediTrace is an educational prototype, not a validated medical device. Its results may be incomplete or inaccurate and must not be used to diagnose conditions, prescribe medicines, or make treatment decisions. Always consult a qualified doctor or pharmacist.

---

## Features

- **Medicine Lookup:** Search for medicines through the backend API.
- **Prescription Safety Checks:** Explore potential medication-related concerns through the application's checking workflow.
- **AI-Assisted Search:** Experimental integration with Groq and a Qwen model for AI-assisted queries and explanations.
- **FastAPI Backend:** API endpoints for health checks, medicine search, prescription checks, and available rules.
- **Medicine Dataset:** Backend reports a catalogue of approximately 253,973 medicine records.
- **Automated Testing:** Backend test suite covering core application behaviour.
- **Web Interface:** A browser-based frontend connected to the backend API.

*AI capabilities and safety checks are experimental. Availability and accuracy depend on the configured services, underlying data, and implemented rules.*

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| API Server | Uvicorn |
| AI integration | Groq API with a Qwen model |
| Testing | pytest |
| Version Control | Git and GitHub |

## Getting Started

### Prerequisites

- Python 3.13 or a compatible Python version
- Git
- Windows PowerShell for the included frontend server script
- A Groq API key if using the AI integration

### 1. Clone the repository

```bash
git clone https://github.com/butterchicken31/MediTrace.git
cd MediTrace
```

### 2. Set up the Python environment

Create a virtual environment and install the backend dependencies:

```powershell
python -m venv .venv
# for windows
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

### 3. Configure environment variables

If the AI integration requires a Groq API key, configure it through an environment variable or a local `.env` file, according to the backend implementation.

Example environment variable name:

```text
$env:GROQ_API_KEY=your_api_key_here
```

Replace the placeholder locally. **Never commit actual API keys, passwords, or other secrets to GitHub.**

### 4. Start the backend

From the repository root:

```powershell
# for windows
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000
```

The backend should be available at:

- Health check: `http://localhost:8000/health`
- Interactive API documentation: `http://localhost:8000/docs`

### 5. Start the frontend

Open a second PowerShell terminal in the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1
```

Open `http://localhost:4173` in your browser.

### 6. Run the backend tests

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest .\backend\tests -q
```


##  Security and Responsible AI

- API keys must remain server-side and must not be exposed in frontend code.
- AI-generated content can be incorrect or incomplete.
- AI output must not be treated as verified clinical evidence.
- Potential safety alerts require review by a qualified healthcare professional.
- A missing alert does not establish that a prescription is safe.
- This prototype is not intended to replace professional medical judgment.

## Project Status

MediTrace is under active development. The team is improving its interface, API integration, AI-assisted functionality, and medication-safety workflows.

The project is intended for educational demonstration and further development. Its clinical accuracy and suitability for real-world healthcare use have not been established.

##  Team

**Team MediTrace**
1. Arjun Atroley (Team Leader)
2. Swaroop Dudhgaonkar
3. Mitisha Mahashabde
4. Tanishq Jain

## Vision

To explore how accessible medicine information, explainable safety checks, and AI-assisted interactions can support more informed conversations between patients and healthcare professionals.

---

*Built as a student hackathon project for hypnexis 2026.*

