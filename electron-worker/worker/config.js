const Store = require('electron-store');

const store = new Store({ name: 'worker-config' });

const config = {
  backendBaseUrl: store.get('backendBaseUrl', 'http://localhost:3000'),
  redisUrl: store.get('redisUrl', 'redis://127.0.0.1:6379'),
  docker: {
    defaultImage: store.get('dockerDefaultImage', 'your-ml-image:latest'),
    gpuEnabled: store.get('dockerGpuEnabled', true)
  },
  worker: {
    maxRetries: store.get('workerMaxRetries', 3),
    maxCpuPercent: store.get('workerMaxCpuPercent', 90),
    maxGpuUtilization: store.get('workerMaxGpuUtilization', 90)
  },
  auth: {
    workerId: store.get('workerId', null),
    token: store.get('workerToken', null)
  },
  updateAuth(workerId, token) {
    store.set('workerId', workerId);
    store.set('workerToken', token);
  },
  update(key, value) {
    store.set(key, value);
  }
};

module.exports = config;
