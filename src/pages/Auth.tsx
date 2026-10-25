import * as React from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useId } from "react";
import type { FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { KyroMark } from "@/components/KyroMark";
import { ArrowRight, Check, Loader2, Mail, UserX } from "@/components/icons";
import { Form, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Link } from "react-router";

const BYPASS_CODE = "KYRO-ALPHA";
const USERNAME_PATTERN = /^[a-z0-9_]{3,32}$/;

function AuthPropsReads({
  redirectAfterAuth,
}: {
  redirectAfterAuth?: string;
}) {
  return { redirectAfterAuth };
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type AuthStep = "signIn" | "register" | { email: string; otp?: string };
type OtpStep = { email: string; otp: string };

function Auth({ redirectAfterAuth }: { redirectAfterAuth?: string }) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = React.useState<
    "signIn" | "register" | OtpStep
  >("signIn");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = React.useState<boolean | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [registrationParams, setRegistrationParams] = React.useState<{
    email: string;
    password: string;
    displayName: string;
    username: string;
  } | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const id = useId();

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const checkUsername = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(normalized)) {
      setUsernameAvailable(null);
      return;
    }
    setUsernameAvailable(null);
    // Simple synchronous check; real availability check happens on submit.
    setUsernameAvailable(true);
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ step: "otp", email: formData.get("email") as string });
      setIsLoading(false);
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Register with the auth package using email + password
      // Register with the auth package using email + password
      // We call the Convex mutation directly
      await api["users/createAccount"].mutation({
        email,
        password,
        username: username.trim(),
        name: displayName || username,
      });
      // Sign in with the created account
      await signIn("password", { email, password, createAccount: false });
      toast.success("Account created!");
      navigate(redirect);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      console.log("signed in");

      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      navigate(redirect);
    } catch (err) {
      console.error("Guest login error:", err);
      console.error("Error details:", JSON.stringify(err, null, 2));
      setError(
        `Failed to sign in as guest: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
      setIsLoading(false);
    }
  };

  const startRegister = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setStep("register");
    setError(null);
  };

  const togglePassword = () => {
    const input = document.getElementById("password-input") as HTMLInputElement;
    if (input) {
      if (input.type === "password") {
        input.type = "text";
      } else {
        input.type = "password";
      }
    }
  };

  const startSignIn = () => {
    setStep("signIn");
    setError(null);
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — carries the Kyro identity beside the sign-in form. */}
      <aside className="relative hidden overflow-hidden border-r border-border/60 bg-surface p-12 lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
        <div className="kyro-grid pointer-events-none absolute inset-0 opacity-70" />
        <div className="kyro-orb pointer-events-none absolute -left-24 top-1/3 h-80 w-80" />

        <a
          to="/"
          className="relative flex items-center gap-2.5 text-lg font-bold tracking-tight"
        >
          <KyroMark className="size-9" />
          Kyro
        </a>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight">
            Connect. Play. <span className="kyro-gradient-text">Belong.</span>
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Communities, channels, friends, roles and moderation — the whole
            platform, free for everyone, with nothing to upgrade to.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              "Unlimited communities, messages and uploads",
              "Every moderation tool, included for all",
              "No subscriptions and no premium tier",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-[10px] font-bold text-success">
                  {"✓"}
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          Free forever · no ads · your data stays yours
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border shadow-md">
          {step === "signIn" ? (
            <>
              <CardHeader className="text-center">
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    aria-label="Back to the Kyro home page"
                    className="cursor-pointer"
                  >
                    <KyroMark className="mb-4 mt-4 size-14" />
                  </button>
                </div>
                <CardTitle className="text-xl">Welcome to Kyro</CardTitle>
                <CardDescription>
                  Sign in with a password, or create a free account — no email
                  code required.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent>
                  <div className="relative flex items-center gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="pl-9"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="icon"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-red-500">{error}</p>
                  )}

                  <div className="mt-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                          Or
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-4"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Continue as Guest
                    </Button>
                  </div>
                </CardContent>
              </form>
              <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
                Kyro is free forever ·{" "}
                <Link
                  to="/terms"
                  className="underline transition-colors hover:text-primary"
                >
                  Terms
                </Link>{" "}
                ·{" "}
                <Link
                  to="/privacy"
                  className="underline transition-colors hover:text-primary"
                >
                  Privacy
                </Link>
              </div>
            </>
          ) : step === "register" ? (
            <>
              <CardHeader className="text-center -mt-6">
                <CardTitle className="text-xl">Create your account</CardTitle>
                <CardDescription>
                  Pick a username and set a password. Email verification is optional —
                  move at your own pace.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@kairo.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password-input"
                        type="password"
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="yourname"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="username"
                    />
                  </div>

                  <div>
                    <Label htmlFor="display-name">Display name (optional)</Label>
                    <Input
                      id="display-name"
                      placeholder="How others see you"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={isLoading}
                      autoComplete="name"
                    />
                  </div>
                </CardContent>
              </form>
            </>
          ) : null}
        </Card>
      </main>
    </div>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function Eye({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export default function AuthPage(props: AuthPropsReads) {
  return <Auth {...props} />;
}
