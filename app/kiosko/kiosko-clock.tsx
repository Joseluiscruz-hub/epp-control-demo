"use client";

import { useEffect, useState } from "react";

export function KioskoClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };

    updateTime();
    const interval = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="font-mono text-[13px] text-muted-foreground" suppressHydrationWarning>
      {time}
    </div>
  );
}
