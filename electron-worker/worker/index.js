const { ipcMain } = require('electron');
const { EventEmitter } = require('events');
const config = require('./config');
const logger = require('./logger');
const { getSystemInfo, getLiveMetrics } = require('./systemInfo');
const BackendClient = require('./backendClient');
const QueueClient = require('./queueClient');
const DockerRunner = require('./dockerRunner');
const ArtifactsManager = require('./artifactsManager');
const MetricsCollector = require('./metricsCollector');

const workerBus = new EventEmitter();

const backend = new BackendClient(workerBus);
const queueClient = new QueueClient(workerBus);
const dockerRunner = new DockerRunner(workerBus);
const artifactsManager = new ArtifactsManager(workerBus);
const metricsCollector = new MetricsCollector(workerBus);

let currentJob = null;
let running = false;

async function init() {
  try {
    const sysInfo = await getSystemInfo();
    await backend.registerOrLogin(sysInfo);
    await backend.heartbeat({ status: 'online', sysInfo });

    queueClient.connect();
    metricsCollector.start(() => getLiveMetrics());

    workerBus.on('job:new', job => handleJob(job));
    workerBus.on('job:cancel', jobId => cancelJob(jobId));

    setInterval(
      () => backend.heartbeat({ status: running ? 'running' : 'idle' }),
      30000
    );
  } catch (err) {
    logger.error('Worker init failed: %s', err.stack || err.message);
  }
}

async function handleJob(job) {
  if (!running) return;
  if (currentJob) {
    // simple example: ignore if busy; you might support concurrency in real system
    return;
  }
  currentJob = { ...job, attempts: 0 };
  workerBus.emit('status', { state: 'running', jobId: job.id });

  try {
    const bundle = await artifactsManager.prepareJobArtifacts(job);
    const result = await dockerRunner.runJob(job, bundle);
    await artifactsManager.uploadOutputs(job, result);
    await backend.reportJobCompletion(job.id, result);
    workerBus.emit('status', { state: 'idle', jobId: null });
  } catch (err) {
    logger.error('Job %s failed: %s', job.id, err.stack || err.message);
    currentJob.attempts += 1;
    await backend.reportJobFailure(job.id, err.message);

    if (currentJob.attempts < config.worker.maxRetries) {
      workerBus.emit('log', { jobId: job.id, line: `Retrying attempt ${currentJob.attempts}` });
      handleJob(currentJob);
      return;
    } else {
      workerBus.emit('status', { state: 'error', jobId: null });
    }
  } finally {
    await dockerRunner.cleanup(job);
    await artifactsManager.cleanup(job);
    currentJob = null;
  }
}

function cancelJob(jobId) {
  if (currentJob && currentJob.id === jobId) {
    dockerRunner.cancel(jobId);
  }
}

// IPC for UI controls
ipcMain.on('ui-command', (_event, data) => {
  if (data.action === 'start-worker') {
    running = true;
    workerBus.emit('status', { state: 'idle', jobId: null });
  } else if (data.action === 'stop-worker') {
    running = false;
    workerBus.emit('status', { state: 'stopped', jobId: null });
  } else if (data.action === 'update-limits') {
    const { maxCpuPercent, maxGpuUtilization } = data;
    config.update('worker.maxCpuPercent', maxCpuPercent);
    config.update('worker.maxGpuUtilization', maxGpuUtilization);
  }
});

// forward events to renderer via main process
workerBus.on('status', payload => {
  process.emit('worker-event', { type: 'status', payload });
});
workerBus.on('log', payload => {
  process.emit('worker-event', { type: 'log', payload });
});
workerBus.on('metrics', payload => {
  process.emit('worker-event', { type: 'metrics', payload });
});

init();
