const logsEl = document.getElementById('logs');
const workerStateEl = document.getElementById('workerState');
const currentJobEl = document.getElementById('currentJob');
const cpuEl = document.getElementById('cpuPercent');
const memEl = document.getElementById('memUsage');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

startBtn.addEventListener('click', () => {
  window.electronAPI.sendUiCommand({ action: 'start-worker' });
});
stopBtn.addEventListener('click', () => {
  window.electronAPI.sendUiCommand({ action: 'stop-worker' });
});

window.electronAPI.onWorkerEvent(data => {
  if (data.type === 'log') {
    const div = document.createElement('div');
    div.textContent = `[${data.payload.jobId || 'sys'}] ${data.payload.line}`;
    logsEl.appendChild(div);
    logsEl.scrollTop = logsEl.scrollHeight;
  } else if (data.type === 'status') {
    workerStateEl.textContent = data.payload.state;
    currentJobEl.textContent = data.payload.jobId || 'None';
  } else if (data.type === 'metrics') {
    cpuEl.textContent = data.payload.cpuPercent.toFixed(1);
    memEl.textContent = `${(data.payload.memUsed / 1024 / 1024 / 1024).toFixed(2)} / ${(data.payload.memTotal / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }
});

window.electronAPI.onUiControl(data => {
  // if needed, reflect tray actions back into UI
});
