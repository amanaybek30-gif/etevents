import { useEffect, useState } from "react";

interface Props {
  targetDate: string;
  label?: string;
}

const CountdownTimer = ({ targetDate, label }: Props) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    };

    setTimeLeft(calculate());
    const timer = setInterval(() => setTimeLeft(calculate()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const blocks = [
    { value: timeLeft.days, label: "Days" },
    { value: timeLeft.hours, label: "Hours" },
    { value: timeLeft.minutes, label: "Min" },
    { value: timeLeft.seconds, label: "Sec" },
  ];

  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-muted-foreground uppercase tracking-wider text-center">{label}</p>}
      <div className="flex gap-1.5">
        {blocks.map((b) => (
          <div key={b.label} className="flex flex-col items-center rounded-lg bg-background/80 border border-border px-2 py-1 min-w-[36px]">
            <span className="font-display text-sm font-bold text-primary tabular-nums">{String(b.value).padStart(2, "0")}</span>
            <span className="text-[8px] text-muted-foreground uppercase">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CountdownTimer;
