const axios = require('axios');
const { machineIdSync } = require('node-machine-id');
const config = require('./config');
const logger = require('./logger');

class BackendClient {
  constructor(bus) {
    this.bus = bus;
    this.baseUrl = config.backendBaseUrl;
  }

  async registerOrLogin(systemInfo) {
    const deviceId = machineIdSync();
    const payload = {
      deviceId,
      systemInfo,
      existingWorkerId: config.auth.workerId
    };

    const { data } = await axios.post(`${this.baseUrl}/api/worker/register`, payload);
    config.updateAuth(data.workerId, data.token);
    logger.info('Registered worker %s', data.workerId);
    this.bus.emit('status', { state: 'idle', workerId: data.workerId });
  }

  get headers() {
    return { Authorization: `Bearer ${config.auth.token}` };
  }

  async heartbeat(status) {
    await axios.post(
      `${this.baseUrl}/api/worker/heartbeat`,
      status,
      { headers: this.headers }
    );
  }

  async reportJobCompletion(jobId, result) {
    await axios.post(
      `${this.baseUrl}/api/jobs/${jobId}/complete`,
      result,
      { headers: this.headers }
    );
  }

  async reportJobFailure(jobId, reason) {
    await axios.post(
      `${this.baseUrl}/api/jobs/${jobId}/fail`,
      { reason },
      { headers: this.headers }
    );
  }
}

module.exports = BackendClient;
