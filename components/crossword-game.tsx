"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import confetti from "canvas-confetti";
import { createClient } from "@/lib/supabase/client";
import FriendsSidebar from "@/components/friends-sidebar";
import { VirtualKeyboard } from "@/components/virtual-keyboard";

type ClueDetail = {
  clue: string;
  answer: string;
  row: number;
  col: number;
};

type CrosswordData = {
  id: string;
  ipuzData: {
    puzzle: (number | string)[][];
    clues: {
      Down: [number, string][];
      Across: [number, string][];
    };
    dimensions: { width: number; height: number };
    solution: string[][];
    fromIpuz?: {
      down: Record<string, ClueDetail>;
      across: Record<string, ClueDetail>;
    };
  };
};

export default function CrosswordGame() {
  const [data, setData] = useState<CrosswordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<string[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    r: number;
    c: number;
  } | null>(null);
  const [direction, setDirection] = useState<"across" | "down">("across");
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showLoginWarning, setShowLoginWarning] = useState(false);
  const [user, setUser] = useState<any>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchCrossword(date);
  }, [date]);

  useEffect(() => {
    if (selectedCell && inputRefs.current[selectedCell.r]?.[selectedCell.c]) {
      inputRefs.current[selectedCell.r][selectedCell.c]?.focus();
    }
  }, [selectedCell]);

  const saveResult = async (time: number) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("game_results").insert({
      user_id: user.id,
      date: date,
      time_seconds: time,
    });
  };

  useEffect(() => {
    if (!data || isCompleted || grid.length === 0) return;

    const { solution } = data.ipuzData;
    let isCorrect = true;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        if (data.ipuzData.puzzle[r][c] !== "#") {
          if (grid[r][c] !== solution[r][c]) {
            isCorrect = false;
            break;
          }
        }
      }
      if (!isCorrect) break;
    }

    if (isCorrect) {
      setIsCompleted(true);
      setShowSuccessDialog(true);
      saveResult(elapsedTime);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [grid, data, isCompleted, startTime, elapsedTime]);

  useEffect(() => {
    if (!startTime || isCompleted) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, isCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAutocomplete = () => {
    if (!data) return;
    const { solution } = data.ipuzData;
    // Create a deep copy of the solution to avoid reference issues
    const newGrid = solution.map((row) => [...row]);
    setGrid(newGrid);
  };

  const fetchCrossword = async (dateStr: string) => {
    setLoading(true);
    setIsCompleted(false);
    setHasStarted(false);
    setStartTime(null);
    setElapsedTime(0);
    try {
      const res = await fetch(`/api/crossword?date=${dateStr}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();

      // Polyfill fromIpuz if missing
      if (!json.ipuzData.fromIpuz) {
        json.ipuzData.fromIpuz = generateFromIpuz(json.ipuzData);
      }

      setData(json);
      initializeGrid(json);
      // Timer starts when user clicks "Jugar"
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartClick = () => {
    if (user) {
      handleStartGame();
    } else {
      setShowLoginWarning(true);
    }
  };

  const handleStartGame = () => {
    setShowLoginWarning(false);
    setHasStarted(true);
    setStartTime(Date.now());
    // Focus the selected cell
    if (selectedCell && inputRefs.current[selectedCell.r]?.[selectedCell.c]) {
      inputRefs.current[selectedCell.r][selectedCell.c]?.focus();
    }
  };

  const generateFromIpuz = (ipuzData: CrosswordData["ipuzData"]) => {
    const { puzzle, clues, solution, dimensions } = ipuzData;
    const { width, height } = dimensions;
    const fromIpuz = {
      across: {} as Record<string, ClueDetail>,
      down: {} as Record<string, ClueDetail>,
    };

    // Helper to find coordinates of a number
    const findNumber = (num: number) => {
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          if (puzzle[r][c] === num) return { r, c };
        }
      }
      return null;
    };

    // Process Across clues
    clues.Across.forEach(([num, text]) => {
      const coords = findNumber(num);
      if (coords) {
        let answer = "";
        let c = coords.c;
        while (c < width && puzzle[coords.r][c] !== "#") {
          answer += solution[coords.r][c];
          c++;
        }
        fromIpuz.across[num] = {
          clue: text,
          answer,
          row: coords.r,
          col: coords.c,
        };
      }
    });

    // Process Down clues
    clues.Down.forEach(([num, text]) => {
      const coords = findNumber(num);
      if (coords) {
        let answer = "";
        let r = coords.r;
        while (r < height && puzzle[r][coords.c] !== "#") {
          answer += solution[r][coords.c];
          r++;
        }
        fromIpuz.down[num] = {
          clue: text,
          answer,
          row: coords.r,
          col: coords.c,
        };
      }
    });

    return fromIpuz;
  };

  const initializeGrid = (data: CrosswordData) => {
    const { height, width } = data.ipuzData.dimensions;
    const newGrid = Array(height)
      .fill(null)
      .map(() => Array(width).fill(""));
    setGrid(newGrid);

    // Initialize refs
    inputRefs.current = Array(height)
      .fill(null)
      .map(() => Array(width).fill(null));

    // Find first playable cell
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const cell = data.ipuzData.puzzle[r][c];
        if (cell !== "#") {
          setSelectedCell({ r, c });
          return;
        }
      }
    }
  };

  const handleCellClick = (r: number, c: number) => {
    const cell = data?.ipuzData.puzzle[r][c];
    if (cell === "#") return;

    if (selectedCell?.r === r && selectedCell?.c === c) {
      setDirection((prev) => (prev === "across" ? "down" : "across"));
    } else {
      setSelectedCell({ r, c });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (!data) return;
    const { height, width } = data.ipuzData.dimensions;

    if (e.key === "Backspace") {
      e.preventDefault();
      handleVirtualKey("BACKSPACE");
    } else if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
      e.preventDefault();
      handleVirtualKey(e.key.toUpperCase());
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (direction === "down") setDirection("across");
      else moveCell(0, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (direction === "down") setDirection("across");
      else moveCell(0, -1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (direction === "across") setDirection("down");
      else moveCell(1, 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (direction === "across") setDirection("down");
      else moveCell(-1, 0);
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleVirtualKey("TAB");
    }
  };

  const handleVirtualKey = (key: string) => {
    if (!selectedCell || !data) return;
    const { r, c } = selectedCell;

    if (key === "BACKSPACE") {
      const newGrid = [...grid];
      if (newGrid[r][c] !== "") {
        newGrid[r][c] = "";
        setGrid(newGrid);
      } else {
        moveSelection(-1);
      }
    } else if (key === "TAB") {
      // Logic to jump to next clue
      // For now, just toggle direction as a simple placeholder or implement next clue logic
      // Let's implement a simple next clue finder
      // Or just do nothing for now if not requested
    } else if (key.length === 1) {
      const newGrid = [...grid];
      newGrid[r][c] = key;
      setGrid(newGrid);
      moveSelection(1);
    }
  };

  const handlePrevClue = () => {
    // Logic to go to previous clue
    // This requires finding the previous clue number and selecting its first cell
    // Simplified: just move selection back until a new clue starts?
    // Or iterate through clues keys.
    if (!data || !currentClue) return;
    const clues =
      direction === "across"
        ? data.ipuzData.clues.Across
        : data.ipuzData.clues.Down;
    const currentIndex = clues.findIndex(
      ([num]) => String(num) === currentClue.number
    );
    if (currentIndex > 0) {
      const [prevNum] = clues[currentIndex - 1];
      const detail = data.ipuzData.fromIpuz?.[direction][prevNum];
      if (detail) setSelectedCell({ r: detail.row, c: detail.col });
    }
  };

  const handleNextClue = () => {
    if (!data || !currentClue) return;
    const clues =
      direction === "across"
        ? data.ipuzData.clues.Across
        : data.ipuzData.clues.Down;
    const currentIndex = clues.findIndex(
      ([num]) => String(num) === currentClue.number
    );
    if (currentIndex < clues.length - 1) {
      const [nextNum] = clues[currentIndex + 1];
      const detail = data.ipuzData.fromIpuz?.[direction][nextNum];
      if (detail) setSelectedCell({ r: detail.row, c: detail.col });
    }
  };

  const moveCell = (dr: number, dc: number) => {
    if (!selectedCell || !data) return;
    const { height, width } = data.ipuzData.dimensions;
    let nr = selectedCell.r + dr;
    let nc = selectedCell.c + dc;

    if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
      const cell = data.ipuzData.puzzle[nr][nc];
      if (cell !== "#") {
        setSelectedCell({ r: nr, c: nc });
      }
    }
  };

  const moveSelection = (step: number) => {
    if (!selectedCell || !data) return;
    const { height, width } = data.ipuzData.dimensions;
    let { r, c } = selectedCell;

    let attempts = 0;
    while (attempts < height * width) {
      if (direction === "across") {
        c += step;
        if (c >= width) {
          c = 0;
          r++;
        }
        if (c < 0) {
          c = width - 1;
          r--;
        }
      } else {
        r += step;
        if (r >= height) {
          r = 0;
          c++;
        }
        if (r < 0) {
          r = height - 1;
          c--;
        }
      }

      if (r >= 0 && r < height && c >= 0 && c < width) {
        const cell = data.ipuzData.puzzle[r][c];
        if (cell !== "#") {
          setSelectedCell({ r, c });
          return;
        }
      } else {
        // Wrap around logic or stop at edges?
        // Simple wrap for now, but might need boundary checks to stop
        if (r < 0 || r >= height || c < 0 || c >= width) break;
      }
      attempts++;
    }
  };

  // Helper to get current clue
  const getCurrentClue = () => {
    if (!selectedCell || !data) return null;
    const { r, c } = selectedCell;

    // We need to find the clue number associated with the current cell and direction
    // This is tricky because we only have the starting numbers in the grid.
    // We can use `fromIpuz` to find which clue covers this cell.

    const fromIpuz = data.ipuzData.fromIpuz;
    if (!fromIpuz) return null;
    const clues = direction === "across" ? fromIpuz.across : fromIpuz.down;

    // Iterate through clues to find one that contains the current cell
    for (const [num, detail] of Object.entries(clues)) {
      const { row, col, answer } = detail;
      const len = answer.length;

      if (direction === "across") {
        if (row === r && c >= col && c < col + len) {
          return { number: num, text: detail.clue, direction };
        }
      } else {
        if (col === c && r >= row && r < row + len) {
          return { number: num, text: detail.clue, direction };
        }
      }
    }
    return null;
  };

  const currentClue = getCurrentClue();

  // Highlight logic
  const isHighlighted = (r: number, c: number) => {
    if (!selectedCell || !currentClue || !data || !data.ipuzData.fromIpuz)
      return false;
    const fromIpuz = data.ipuzData.fromIpuz;
    const clues = direction === "across" ? fromIpuz.across : fromIpuz.down;
    const detail = clues[currentClue.number];

    if (!detail) return false;

    const { row, col, answer } = detail;
    const len = answer.length;

    if (direction === "across") {
      return r === row && c >= col && c < col + len;
    } else {
      return c === col && r >= row && r < row + len;
    }
  };

  const isWordCorrect = (direction: "across" | "down", num: string) => {
    if (!data || !data.ipuzData.fromIpuz) return false;
    const detail = data.ipuzData.fromIpuz[direction][num];
    if (!detail) return false;

    const { row, col, answer } = detail;
    const len = answer.length;

    for (let i = 0; i < len; i++) {
      let r = row;
      let c = col;
      if (direction === "across") c += i;
      else r += i;

      if (grid[r]?.[c] !== answer[i]) return false;
    }
    return true;
  };

  const checkGame = () => {
    if (!data) return;
    let correct = true;
    const { solution } = data.ipuzData;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        if (data.ipuzData.puzzle[r][c] !== "#") {
          if (grid[r][c] !== solution[r][c]) {
            correct = false;
          }
        }
      }
    }
    if (correct) alert("¡Felicitaciones! Has completado el crucigrama.");
    else alert("Hay errores en el crucigrama.");
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!data) return <div>Error loading crossword</div>;

  return (
    <div className="flex flex-col items-center p-2 sm:p-4 max-w-[1600px] mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between w-full items-center mb-4 gap-3 sm:gap-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl sm:text-2xl font-bold">Crucigrama Diario</h1>
          <div className="flex items-center gap-2 text-muted-foreground font-mono bg-neutral-100 px-3 py-1 rounded-full">
            <Clock className="h-4 w-4" />
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {process.env.NODE_ENV === "development" && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAutocomplete}
              title="Autocompletar (Dev)"
            >
              <Wand2 className="h-4 w-4 text-purple-500" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(date);
              d.setDate(d.getDate() - 1);
              setDate(d.toISOString().split("T")[0]);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="flex items-center font-mono">{date}</span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const d = new Date(date);
              d.setDate(d.getDate() + 1);
              setDate(d.toISOString().split("T")[0]);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="w-full mb-6">
        <CardContent className="p-4 flex items-center justify-center min-h-16 bg-blue-50 text-center font-medium">
          {!hasStarted ? (
            <span className="text-muted-foreground italic">
              Inicia el juego para ver las pistas
            </span>
          ) : currentClue ? (
            <span className="text-lg">
              <span className="font-bold mr-2">
                {currentClue.number}{" "}
                {direction === "across" ? "Horizontal" : "Vertical"}:
              </span>
              {currentClue.text}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Selecciona una casilla
            </span>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col xl:flex-row gap-8 w-full items-start">
        {/* Main Game Area */}
        <div className="flex-1 flex flex-col lg:flex-row gap-8 w-full min-w-0 relative">
          {!hasStarted && (
            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-lg border border-neutral-200">
              <div className="text-center p-8 bg-white shadow-lg rounded-xl border border-neutral-100 max-w-sm mx-4">
                <h2 className="text-2xl font-bold mb-2">Crucigrama Diario</h2>
                <p className="text-muted-foreground mb-6">
                  ¿Listo para desafiar tu mente hoy?
                </p>
                <Button
                  size="lg"
                  onClick={handleStartClick}
                  className="w-full font-bold text-lg"
                >
                  Jugar
                </Button>
              </div>
            </div>
          )}

          {/* Grid */}
          <div className="w-full lg:w-auto flex justify-center overflow-x-auto pb-4 lg:pb-0 shrink-0">
            <div
              className="grid bg-neutral-200 border border-neutral-200 shadow-sm mx-auto"
              style={{
                gridTemplateColumns: `repeat(${data.ipuzData.dimensions.width}, max-content)`,
                gridTemplateRows: `repeat(${data.ipuzData.dimensions.height}, max-content)`,
                width: "fit-content",
                height: "fit-content",
                gap: "1px",
              }}
            >
              {data.ipuzData.puzzle.map((row, r) =>
                row.map((cell, c) => {
                  const isBlock = cell === "#";
                  const cellNumber = typeof cell === "number" ? cell : null;
                  const isSelected =
                    selectedCell?.r === r && selectedCell?.c === c;
                  const isWordHighlighted = !isBlock && isHighlighted(r, c);

                  return (
                    <div
                      key={`${r}-${c}`}
                      className={cn(
                        "relative w-7 sm:w-10 aspect-square flex items-center justify-center text-base sm:text-lg font-bold uppercase select-none cursor-pointer transition-colors duration-150",
                        isBlock ? "bg-neutral-900" : "bg-white",
                        isWordHighlighted && !isSelected && "bg-blue-50",
                        isSelected && "bg-yellow-100"
                      )}
                      onClick={() => handleCellClick(r, c)}
                    >
                      {!isBlock && (
                        <>
                          {cellNumber && (
                            <span className="absolute top-0.5 left-0.5 text-[6px] sm:text-[10px] leading-none font-normal text-gray-500">
                              {cellNumber}
                            </span>
                          )}
                          {isSelected ? (
                            <input
                              ref={(el) => {
                                inputRefs.current[r][c] = el;
                              }}
                              className="w-full h-full text-center bg-transparent outline-none p-0 m-0 border-none"
                              value={grid[r][c]}
                              onChange={() => {}} // Handled by onKeyDown
                              onKeyDown={(e) => handleKeyDown(e, r, c)}
                              autoFocus
                              inputMode="none"
                            />
                          ) : (
                            <span>{grid[r][c]}</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Clues */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full ">
            <Card className="flex flex-col border-none shadow-none bg-transparent pt-0">
              <CardHeader className=" px-0">
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
                  Horizontales
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[250px] sm:h-[450px] pr-4">
                <div className="space-y-1">
                  {data.ipuzData.clues.Across.map(([num, text]) => (
                    <div
                      key={`across-${num}`}
                      className={cn(
                        "text-sm p-2 rounded-md cursor-pointer hover:bg-neutral-100 transition-all duration-200 border border-transparent",
                        currentClue?.number === String(num) &&
                          direction === "across" &&
                          "bg-blue-50 border-blue-100 font-medium text-blue-900 shadow-sm",
                        isWordCorrect("across", String(num)) &&
                          "line-through text-muted-foreground opacity-50 bg-transparent border-transparent shadow-none"
                      )}
                      onClick={() => {
                        const detail = data.ipuzData.fromIpuz?.across[num];
                        if (detail) {
                          setSelectedCell({ r: detail.row, c: detail.col });
                          setDirection("across");
                        }
                      }}
                    >
                      <span className="font-bold mr-2 text-xs text-neutral-500">
                        {num}.
                      </span>
                      {text}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            <Card className="flex flex-col border-none shadow-none bg-transparent pt-0">
              <CardHeader className=" px-0">
                <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
                  Verticales
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[250px] sm:h-[450px] pr-4">
                <div className="space-y-1">
                  {data.ipuzData.clues.Down.map(([num, text]) => (
                    <div
                      key={`down-${num}`}
                      className={cn(
                        "text-sm p-2 rounded-md cursor-pointer hover:bg-neutral-100 transition-all duration-200 border border-transparent",
                        currentClue?.number === String(num) &&
                          direction === "down" &&
                          "bg-blue-50 border-blue-100 font-medium text-blue-900 shadow-sm",
                        isWordCorrect("down", String(num)) &&
                          "line-through text-muted-foreground opacity-50 bg-transparent border-transparent shadow-none"
                      )}
                      onClick={() => {
                        const detail = data.ipuzData.fromIpuz?.down[num];
                        if (detail) {
                          setSelectedCell({ r: detail.row, c: detail.col });
                          setDirection("down");
                        }
                      }}
                    >
                      <span className="font-bold mr-2 text-xs text-neutral-500">
                        {num}.
                      </span>
                      {text}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full xl:w-80 shrink-0 mt-8 xl:mt-0 pt-8 xl:pt-0 border-t xl:border-t-0 xl:border-l xl:pl-8 border-neutral-200">
          <FriendsSidebar date={date} />
        </div>
      </div>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              ¡Felicitaciones!
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              Has completado el crucigrama correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4 space-y-4">
            <div className="text-4xl font-bold text-primary">
              {formatTime(elapsedTime)}
            </div>
            <p className="text-muted-foreground">Tiempo total</p>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button
              onClick={() => setShowSuccessDialog(false)}
              className="w-full sm:w-auto"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLoginWarning} onOpenChange={setShowLoginWarning}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Jugar sin cuenta?</DialogTitle>
            <DialogDescription>
              Si juegas sin iniciar sesión, tu tiempo no se guardará en el
              ranking diario ni podrás competir con amigos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button className="w-full" asChild>
              <a href="/login">Iniciar Sesión / Crear Cuenta</a>
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleStartGame}
            >
              Jugar de todos modos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Virtual Keyboard - Only visible on mobile/tablet via CSS media queries or always if preferred */}
      <div className="lg:hidden">
        <VirtualKeyboard
          onKey={handleVirtualKey}
          currentClue={currentClue}
          onPrevClue={handlePrevClue}
          onNextClue={handleNextClue}
        />
      </div>
    </div>
  );
}
