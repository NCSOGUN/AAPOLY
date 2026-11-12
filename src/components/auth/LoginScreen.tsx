import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, LoaderCircle, LockKeyhole } from "lucide-react";
import logo from "../../../assets/aap-logo-img.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type Credentials = z.infer<typeof credentialsSchema>;

export function LoginScreen({
  onSignIn,
  hasSavedSession,
  notice,
}: {
  onSignIn: (email: string, password: string) => Promise<void>;
  hasSavedSession: boolean;
  notice?: string;
}) {
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });

  async function submit(credentials: Credentials) {
    setServerError("");
    try {
      await onSignIn(credentials.email, credentials.password);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Sign-in failed. Please try again.",
      );
    }
  }

  return (
    <main className="auth-page">
      <header className="auth-header">
        <img src={logo} alt="Abraham Adesanya Polytechnic" />
        <span className="auth-brand-divider" />
        <span className="auth-brand-name">ENT-Care <small>HOSPITAL WORKSPACE</small></span>
      </header>
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <div className="auth-lock"><LockKeyhole size={19} /></div>
        <h1 id="sign-in-heading">Sign in</h1>
        <p className="auth-subtitle">Use your hospital account to access the desktop workspace.</p>
        <form className="auth-form" onSubmit={handleSubmit(submit)} noValidate>
          {notice && <div className="auth-error" role="status"><AlertCircle size={16} /><span>{notice}</span></div>}
          <label className="field">
            <span className="field-label">Hospital email</span>
            <Input
              className="field-control"
              type="email"
              autoComplete="username"
              placeholder="name@hospital.org"
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && <span className="field-error" role="alert">{errors.email.message}</span>}
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <Input
              className="field-control"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              disabled={isSubmitting}
              {...register("password")}
            />
            {errors.password && <span className="field-error" role="alert">{errors.password.message}</span>}
          </label>
          {serverError && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}
          <Button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle size={16} className="spin" />}
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <div className="auth-security"><LockKeyhole size={14} /> {hasSavedSession ? "Your secure workspace can unlock automatically for 24 hours after sign-in. After that, sign in again with your hospital account." : "Your sign-in is handled by ENT-Care."}</div>
      </section>
      <footer className="auth-footer">For authorised hospital and specialist staff only.</footer>
    </main>
  );
}
