import { cpus, freemem, totalmem, loadavg, platform, arch, uptime } from 'os';

/**
 * Collects and returns various operating system metrics.
 * @returns Object containing platform info, memory usage, CPU info, and load averages
 */
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