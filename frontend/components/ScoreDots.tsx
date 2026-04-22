/**
 * ScoreDots — simple editorial visual indicator for a 0-4 score.
 *
 * A score of 0.0 shows no filled dots; 4.0 shows all five filled.
 * Partial fills round to nearest full dot. Deliberately low-fidelity —
 * the precise number is shown numerically elsewhere.
 */

interface ScoreDotsProps {
  score: number;           // 0.0 to 4.0
  className?: string;
}

export function ScoreDots({ score, className = "" }: ScoreDotsProps) {
  // Map 0.0-4.0 score onto 0-5 filled dots
  // (so a 4.0 fills all 5, a 2.0 fills ~3)
  const filledCount = Math.round((score / 4) * 5);

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label={`Maturity score ${score.toFixed(2)} out of 4`}
      role="img"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${
            i < filledCount
              ? "bg-garabyte-primary-500"
              : "bg-garabyte-ink-100"
          }`}
        />
      ))}
    </span>
  );
}
