class MetricsCollector {
  constructor(bus) {
    this.bus = bus;
    this.interval = null;
  }

  start(getMetrics) {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(async () => {
      const metrics = await getMetrics();
      this.bus.emit('metrics', metrics);
    }, 2000);
  }
}

module.exports = MetricsCollector;
