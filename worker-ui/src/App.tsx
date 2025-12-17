import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [logs, setLogs] = useState("");
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (window.worker) {
      window.worker.onLog((line: string) => {
        setLogs((prev) => prev + line);
      });
    }
  }, []);

  const runJob = async () => {
    setLogs("");
    setRunning(true);
    try {
      const result = await window.worker.runTestJob();
      if (result.success) {
        setLogs((prev) => prev + "\n🎉 All tests passed!");
      }
    } catch (err) {
      setLogs((prev) => prev + "\n❌ Error: " + err);
    }
    setRunning(false);
  };

  return (
    <div className="container">
      <header>
        <h1>🚀 DTrain Worker - Docker Test</h1>
        <p>Testing Electron + Docker + Python execution locally</p>
      </header>

      <div className="controls">
        <button 
          onClick={runJob} 
          disabled={running}
          className={running ? "button-disabled" : "button-primary"}
        >
          {running ? "⏳ Running..." : "▶ Run Test Job"}
        </button>
      </div>

      <div className="log-section">
        <div className="log-header">
          <h3>📋 Execution Logs</h3>
          <button 
            onClick={() => setLogs("")}
            className="button-clear"
            disabled={!logs}
          >
            Clear
          </button>
        </div>
        
        <pre className="log-output">
          {logs || "Click 'Run Test Job' to start execution...\n\nMake sure:\n✅ Docker Desktop is running\n✅ job.zip is in test-job/ folder\n✅ ZIP contains main.py and requirements.txt"}
        </pre>
      </div>

      <footer>
        <p>Status: {running ? "🟢 Running" : "⚪ Idle"}</p>
      </footer>
    </div>
  );
}

export default App;
