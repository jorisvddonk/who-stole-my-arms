import { cpus, freemem, totalmem, loadavg, platform, arch, uptime } from 'os';

export function getOSMetrics() {
  return {
    platform: platform(),
    arch: arch(),
    uptime: uptime(),
    loadAverage: loadavg(),
    totalMemory: totalmem(),
    freeMemory: freemem(),
    cpuCount: cpus().length,
  };
}