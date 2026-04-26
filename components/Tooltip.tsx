"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export default function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<"above" | "below">("above");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos(rect.top < 120 ? "below" : "above");
    }
  }, [show]);

  return (
    <div
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <span className="ml-1 text-[9px] text-[#448aff] cursor-help select-none">ⓘ</span>
      {show && (
        <div
          className={`absolute z-50 w-56 px-3 py-2 rounded bg-[#1a1a2e] border border-[#2a2a3e] text-[10px] text-[#c0c0c0] leading-relaxed shadow-lg ${
            pos === "above" ? "bottom-full mb-1" : "top-full mt-1"
          } left-0`}
        >
          {text}
        </div>
      )}
    </div>
  );
}
