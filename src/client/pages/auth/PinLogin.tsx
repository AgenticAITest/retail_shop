import { Button } from "@client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@client/components/ui/card";
import { useAuth } from "@client/provider/AuthProvider";
import axios from "axios";
import { Delete, Loader2, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

const PIN_LENGTH = 6;

export default function PinLogin() {
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();

  // Check if there's a stored username for quick re-auth
  useEffect(() => {
    const storedUsername = localStorage.getItem("pos_username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  const handlePinSubmit = useCallback(async (fullPin: string) => {
    if (!username) {
      setError("Please enter your username first");
      return;
    }

    setLoading(true);
    setError("");
    setRemainingAttempts(null);
    setLockedUntil(null);

    try {
      const response = await axios.post("/api/auth/login/pin", {
        username,
        pin: fullPin,
      });

      const { accessToken } = response.data;
      localStorage.setItem("pos_username", username);
      setToken(accessToken);

      // Fetch user info
      const userResponse = await axios.get("/api/auth/user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setUser(userResponse.data);

      navigate("/console/dashboard");
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 423) {
        setLockedUntil(data?.lockedUntil);
        setError(data?.message || "Account locked");
      } else {
        setError(data?.message || "Invalid PIN");
        if (data?.remainingAttempts !== undefined) {
          setRemainingAttempts(data.remainingAttempts);
        }
      }
      setPin("");
    } finally {
      setLoading(false);
    }
  }, [username, setToken, setUser, navigate]);

  const handleDigit = useCallback((digit: string) => {
    if (loading) return;
    setPin((prev) => {
      const next = prev + digit;
      if (next.length === PIN_LENGTH) {
        handlePinSubmit(next);
      }
      return next.length <= PIN_LENGTH ? next : prev;
    });
  }, [loading, handlePinSubmit]);

  const handleBackspace = useCallback(() => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
  }, [loading]);

  const handleClear = useCallback(() => {
    if (loading) return;
    setPin("");
    setError("");
  }, [loading]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleDigit, handleBackspace, handleClear]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">POS PIN Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Username input (shown if no stored username) */}
          {!localStorage.getItem("pos_username") && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user@tenant"
                className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          {localStorage.getItem("pos_username") && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Logged in as</p>
              <p className="font-medium">{username}</p>
              <button
                onClick={() => {
                  localStorage.removeItem("pos_username");
                  setUsername("");
                }}
                className="text-xs text-primary underline mt-1"
              >
                Switch user
              </button>
            </div>
          )}

          {/* PIN dots */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full border-2 transition-all ${
                  i < pin.length
                    ? "bg-primary border-primary scale-110"
                    : "border-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          {/* Error display */}
          {error && (
            <div className="text-center">
              <p className="text-sm text-destructive">{error}</p>
              {remainingAttempts !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {remainingAttempts} attempt(s) remaining
                </p>
              )}
            </div>
          )}

          {loading && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Number pad - large touch targets (min 48px) */}
          <div className="grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-14 text-xl font-semibold"
                onClick={() => handleDigit(digit)}
                disabled={loading || !!lockedUntil}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="outline"
              className="h-14 text-sm"
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              className="h-14 text-xl font-semibold"
              onClick={() => handleDigit("0")}
              disabled={loading || !!lockedUntil}
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-14"
              onClick={handleBackspace}
              disabled={loading}
            >
              <Delete className="h-5 w-5" />
            </Button>
          </div>

          {/* Link to full login */}
          <div className="text-center">
            <button
              onClick={() => navigate("/auth/login")}
              className="text-sm text-muted-foreground underline"
            >
              Use password login instead
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
