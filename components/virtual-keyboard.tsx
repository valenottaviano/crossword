"use client";

import { Button } from "@/components/ui/button";
import { Delete, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface VirtualKeyboardProps {
  onKey: (key: string) => void;
  currentClue?: {
    number: string;
    text: string;
    direction: "across" | "down";
  } | null;
  onPrevClue: () => void;
  onNextClue: () => void;
}

export function VirtualKeyboard({
  onKey,
  currentClue,
  onPrevClue,
  onNextClue,
}: VirtualKeyboardProps) {
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Ñ"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-neutral-100 border-t border-neutral-200 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      {/* Clue Bar */}
      <div className="flex items-center justify-between px-2 py-2 bg-pink-50 border-b border-pink-100 mb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevClue}
          className="h-8 w-8 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center text-sm font-medium truncate px-2">
          {currentClue ? (
            <span>
              <span className="font-bold mr-1">
                {currentClue.direction === "across" ? "H" : "V"}
                {currentClue.number}.
              </span>
              {currentClue.text}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Selecciona una casilla
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextClue}
          className="h-8 w-8 shrink-0"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Keyboard */}
      <div className="flex flex-col gap-2 px-1 pb-4 max-w-3xl mx-auto select-none">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-center gap-1">
            {i === 2 && (
              <Button
                variant="secondary"
                className="h-11 px-2 min-w-[2.5rem] font-medium text-xs bg-white shadow-sm active:scale-95 transition-transform"
                onClick={() => onKey("TAB")}
              >
                Tab
              </Button>
            )}
            {row.map((char) => (
              <Button
                key={char}
                variant="secondary"
                className="h-11 w-[8.5%] max-w-[3rem] p-0 font-bold text-lg shadow-sm bg-white hover:bg-neutral-50 active:scale-95 transition-transform"
                onClick={() => onKey(char)}
              >
                {char}
              </Button>
            ))}
            {i === 2 && (
              <Button
                variant="secondary"
                className="h-11 px-2 min-w-[2.5rem] bg-white shadow-sm active:scale-95 transition-transform"
                onClick={() => onKey("BACKSPACE")}
              >
                <Delete className="h-5 w-5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
