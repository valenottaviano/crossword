"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Clock, User, LogOut, Trophy } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type FriendResult = {
  username: string;
  time_seconds: number;
};

type FriendRequest = {
  id: string;
  user: {
    username: string;
  };
};

export default function FriendsSidebar({ date }: { date: string }) {
  const [user, setUser] = useState<any>(null);
  const [results, setResults] = useState<FriendResult[]>([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchResults(user.id);
        fetchPendingRequests(user.id);
      }
    };
    getUser();
  }, [date]);

  const fetchResults = async (userId: string) => {
    // Fetch friends
    const { data: friendships } = await supabase
      .from("friendships")
      .select("friend_id, user_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq("status", "accepted");

    if (!friendships) return;

    const friendIds = friendships.map((f) =>
      f.user_id === userId ? f.friend_id : f.user_id
    );
    friendIds.push(userId); // Include self

    // Fetch results for these users on this date
    const { data: gameResults } = await supabase
      .from("game_results")
      .select(
        `
        time_seconds,
        profiles:user_id (username)
      `
      )
      .in("user_id", friendIds)
      .eq("date", date)
      .order("time_seconds", { ascending: true });

    if (gameResults) {
      setResults(
        gameResults.map((r: any) => ({
          username: r.profiles.username,
          time_seconds: r.time_seconds,
        }))
      );
    }
  };

  const fetchPendingRequests = async (userId: string) => {
    const { data } = await supabase
      .from("friendships")
      .select(
        `
        id,
        user:user_id (username)
      `
      )
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (data) {
      setPendingRequests(data as any);
    }
  };

  const sendFriendRequest = async () => {
    if (!user) return;

    // Find user by username
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", friendUsername)
      .single();

    if (!profiles) {
      alert("Usuario no encontrado");
      return;
    }

    if (profiles.id === user.id) {
      alert("No puedes añadirte a ti mismo");
      return;
    }

    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: profiles.id,
    });

    if (error) {
      alert("Error al enviar solicitud (quizás ya existe)");
    } else {
      alert("Solicitud enviada");
      setFriendUsername("");
    }
  };

  const acceptRequest = async (requestId: string) => {
    await supabase
      .from("friendships")
      .update({ status: "accepted" })
      .eq("id", requestId);

    fetchPendingRequests(user.id);
    fetchResults(user.id);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!user) {
    return (
      <Card className="h-full border-none shadow-none bg-transparent">
        <CardContent className="p-4 flex flex-col items-center justify-center h-full space-y-4">
          <p className="text-center text-muted-foreground">
            Inicia sesión para competir con amigos
          </p>
          <Button asChild>
            <a href="/login">Iniciar Sesión</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span>Ranking Diario</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                supabase.auth.signOut().then(() => window.location.reload())
              }
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {results.length === 0 ? (
                <div className="text-center p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                  <p className="text-sm text-muted-foreground italic">
                    Nadie ha jugado hoy aún.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ¡Sé el primero!
                  </p>
                </div>
              ) : (
                results.map((result, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-neutral-400 w-4">
                        {i + 1}
                      </span>
                      <span className="font-medium">{result.username}</span>
                    </div>
                    <span className="font-mono text-sm font-bold text-blue-600">
                      {formatTime(result.time_seconds)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 py-2">
          <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
            Amigos
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Username..."
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              className="h-8"
            />
            <Button size="sm" onClick={sendFriendRequest}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>

          {pendingRequests.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Solicitudes pendientes:
              </p>
              {pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-2 bg-yellow-50 rounded-md border border-yellow-100"
                >
                  <span className="text-sm">{req.user.username}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => acceptRequest(req.id)}
                  >
                    Aceptar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
