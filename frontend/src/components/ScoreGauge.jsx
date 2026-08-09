function scoreColor(score) {
  if (score >= 70) return '#6EE7C0'; // ok
  if (score >= 50) return '#F5B45A'; // warn
  return '#FF6B5E'; // error
}

function scoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

export default function ScoreGauge({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32 flex-shrink-0">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="#332F3F" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-semibold">{score}</span>
          <span className="text-xs text-textMuted">/ 100</span>
        </div>
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-textMuted mb-1">
          Code health
        </p>
        <p className="font-display text-xl font-medium" style={{ color }}>
          {scoreLabel(score)}
        </p>
      </div>
    </div>
  );
}
