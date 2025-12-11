const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');

class DockerRunner {
  constructor(bus) {
    this.bus = bus;
    this.docker = new Docker(); // uses local Docker socket
    this.runningContainers = new Map();
  }

  async runJob(job, bundle) {
    const image = job.dockerImage || config.docker.defaultImage;
    const cmd = job.command || ['python', path.basename(bundle.scriptPath)];
    const workdir = '/workspace';

    const binds = [
      `${bundle.jobDir}:${workdir}`
    ];

    const createOptions = {
      Image: image,
      Cmd: cmd,
      WorkingDir: workdir,
      HostConfig: {
        Binds: binds,
        AutoRemove: false,
        NetworkMode: 'bridge',
        Runtime: config.docker.gpuEnabled ? 'nvidia' : undefined
      },
      Env: [
        `JOB_ID=${job.id}`,
        `CONFIG_PATH=${path.join(workdir, path.relative(bundle.jobDir, bundle.configPath || ''))}`
      ]
    };

    const container = await this.docker.createContainer(createOptions);
    this.runningContainers.set(job.id, container);

    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    stream.on('data', chunk => {
      const line = chunk.toString('utf-8');
      this.bus.emit('log', { jobId: job.id, line });
    });

    await container.start();

    const finished = await container.wait();
    const exitCode = finished.StatusCode;

    const logs = await container.logs({ stdout: true, stderr: true, tail: 200 });
    const logText = logs.toString('utf-8');

    const outputDir = path.join(bundle.jobDir, 'outputs');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    await container.remove({ force: true });
    this.runningContainers.delete(job.id);

    if (exitCode !== 0) {
      throw new Error(`Container exited with code ${exitCode}`);
    }

    return {
      exitCode,
      logTail: logText,
      outputDir
    };
  }

  async cancel(jobId) {
    const container = this.runningContainers.get(jobId);
    if (!container) return;
    try {
      await container.stop({ t: 5 });
      await container.remove({ force: true });
    } catch (e) {
      logger.error('Error stopping container for job %s: %s', jobId, e.message);
    } finally {
      this.runningContainers.delete(jobId);
    }
  }

  async cleanup(job) {
    await this.cancel(job.id);
  }
}

module.exports = DockerRunner;
