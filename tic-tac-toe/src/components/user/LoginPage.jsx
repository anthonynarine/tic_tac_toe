// # Filename: src/components/user/LoginPage.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useAuth } from "../../auth/hooks/useAuth";
import Card from "../ui/Card";
import Button from "../ui/Button";

const inputClass =
  "w-full px-4 py-3 text-sm rounded-xl bg-surface border border-border-soft text-text-primary placeholder:text-text-faint outline-none transition-colors duration-150 focus:border-brand-cyan/50";

const LoginPage = () => {
  const { login, isLoading, error } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(formData.email.trim()) && Boolean(formData.password.trim()),
    [formData.email, formData.password]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    await login(formData);
  };

  return (
    <div className="w-full max-w-[400px]">

      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-[10px] tracking-[0.4em] uppercase font-semibold mb-5 text-text-muted">
          Game Hub
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2 text-text-primary">
          Welcome Back
        </h1>
        <p className="text-sm text-text-secondary">
          Sign in to access friends, invites, and multiplayer.
        </p>
      </div>

      {/* Card */}
      <Card variant="glass" className="relative px-6 py-7">
        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="mb-5">
            <label
              htmlFor="email"
              className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 text-text-muted"
            >
              Email
            </label>
            <input
              id="email" name="email" type="email"
              value={formData.email} onChange={handleChange}
              placeholder="you@example.com"
              required autoComplete="email"
              className={inputClass}
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 text-text-muted"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password" name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password} onChange={handleChange}
                placeholder="••••••••"
                required autoComplete="current-password"
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 focus:outline-none text-text-faint transition-colors hover:text-brand-cyan"
              >
                {showPassword ? <AiOutlineEyeInvisible size={17} /> : <AiOutlineEye size={17} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 text-sm rounded-xl bg-brand-rose/10 border border-brand-rose/25 text-brand-rose">
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !canSubmit}
            className="w-full"
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      </Card>

      {/* Register link */}
      <p className="text-center mt-6 text-sm text-text-muted">
        No account?{" "}
        <Link to="/register" className="text-brand-cyan/80 transition-colors hover:text-brand-cyan">
          Register
        </Link>
      </p>
    </div>
  );
};

export default LoginPage;
