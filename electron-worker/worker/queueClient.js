const Redis = require('ioredis');
const config = require('./config');
const logger = require('./logger');

class QueueClient {
  constructor(bus) {
    this.bus = bus;
    this.redis = new Redis(config.redisUrl);
    this.sub = new Redis(config.redisUrl);
  }

  connect() {
    this.sub.subscribe('jobs.new', 'jobs.cancel', (err) => {
      if (err) logger.error('Redis subscribe error: %s', err.message);
      else logger.info('Subscribed to job channels');
    });

    this.sub.on('message', (channel, message) => {
      try {
        const payload = JSON.parse(message);
        if (channel === 'jobs.new') {
          this.bus.emit('job:new', payload);
        } else if (channel === 'jobs.cancel') {
          this.bus.emit('job:cancel', payload.jobId);
        }
      } catch (e) {
        logger.error('Invalid job message: %s', e.message);
      }
    });
  }
}

module.exports = QueueClient;
