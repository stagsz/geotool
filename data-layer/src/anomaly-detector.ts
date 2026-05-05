export class AnomalyDetector {
  detectIpRangeChange(previous: number, current: number): boolean {
    if (previous === 0) return current > 0;
    return Math.abs(current - previous) / previous > 0.1;
  }

  detectCitationDrop(previous: number, current: number): boolean {
    if (previous === 0) return false;
    return (previous - current) / previous >= 0.2;
  }
}
