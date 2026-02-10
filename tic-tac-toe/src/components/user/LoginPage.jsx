// # Filename: src/components/user/LoginPage.jsx


import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

import { useAuth } from "../../auth/hooks/useAuth";

const LoginPage = () => {
  const { login, isLoading, error } = useAuth();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  // # Step 1: Derived state for button + simple UX
  const canSubmit = useMemo(() => {
    return Boolean(formData.email.trim()) && Boolean(formData.password.trim());
  }, [formData.email, formData.password]);

  // # Step 2: Handle field edits
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // STEP 1: Merge previous state with updated field
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // # Step 3: Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    await login(formData);
  };

  return (
    <div
      className={[
        // ✅ Match Register page: slightly higher than dead-center
        "min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-6rem)]",
        "flex items-start justify-center",
        "px-4 pt-10 pb-12",
        "md:pt-14",
      ].join(" ")}
    >
      <div className="w-full max-w-[520px]">
        <form
          onSubmit={handleSubmit}
          className={[
            "relative overflow-hidden rounded-2xl bg-black",
            "border border-[#1DA1F2]/15",
            "shadow-[0_0_10px_rgba(29,161,242,0.22),0_0_26px_rgba(29,161,242,0.12),0_18px_40px_rgba(0,0,0,0.6)]",
            "px-5 py-8 sm:px-8 sm:py-10",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(29,161,242,0.18),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1DA1F2]/30 to-transparent" />

          <div className="relative">
            <h2
              className={[
                "text-center font-extrabold tracking-tight",
                "text-3xl sm:text-4xl",
                "text-[#1DA1F2]",
                "drop-shadow-[0_0_10px_rgba(29,161,242,0.45)]",
              ].join(" ")}
            >
              Welcome Back
            </h2>

            <p className="mt-3 text-center text-sm sm:text-base text-white/70">
              Sign in to access friends, invites, and multiplayer.
            </p>

            <div className="mt-8">
              <label
                htmlFor="email"
                className="block text-xs font-medium tracking-wide text-[#1DA1F2]/90 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className={[
                  "w-full rounded-xl px-4 py-3 sm:py-3.5",
                  "bg-[#0A0A0A] text-white",
                  "border border-[#1DA1F2]/20",
                  "outline-none",
                  "focus:border-[#1DA1F2]/45 focus:shadow-[0_0_0_3px_rgba(29,161,242,0.14)]",
                  "placeholder:text-white/30",
                ].join(" ")}
              />
            </div>

            <div className="mt-6">
              <label
                htmlFor="password"
                className="block text-xs font-medium tracking-wide text-[#1DA1F2]/90 mb-2"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className={[
                    "w-full rounded-xl px-4 py-3 sm:py-3.5 pr-12",
                    "bg-[#0A0A0A] text-white",
                    "border border-[#1DA1F2]/20",
                    "outline-none",
                    "focus:border-[#1DA1F2]/45 focus:shadow-[0_0_0_3px_rgba(29,161,242,0.14)]",
                    "placeholder:text-white/30",
                  ].join(" ")}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className={[
                    "absolute right-3 top-1/2 -translate-y-1/2",
                    "p-2 rounded-lg",
                    "text-white/60 hover:text-white",
                    "hover:bg-white/5",
                    "focus:outline-none focus:ring-2 focus:ring-[#1DA1F2]/30",
                  ].join(" ")}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <AiOutlineEyeInvisible className="text-xl" />
                  ) : (
                    <AiOutlineEye className="text-xl" />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <div
                className={[
                  "mt-6 rounded-xl px-4 py-3",
                  "border border-red-500/25",
                  "bg-red-500/10",
                  "text-red-200 text-sm",
                ].join(" ")}
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading || !canSubmit}
              className={[
                "mt-8 w-full rounded-xl py-3.5 font-semibold",
                "bg-black text-white",
                "border-2 border-[#1DA1F2]/25",
                "shadow-[0_0_10px_rgba(29,161,242,0.22),0_0_18px_rgba(29,161,242,0.12)]",
                "transition-transform duration-200",
                "hover:shadow-[0_0_18px_rgba(29,161,242,0.28),0_0_32px_rgba(29,161,242,0.16)]",
                "hover:-translate-y-[1px]",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
              ].join(" ")}
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>

            <div className="mt-6 text-center">
              <Link
                to="/register"
                className="text-sm text-white/80 hover:text-[#1DA1F2] transition-colors"
              >
                Don&apos;t have an account? Register here
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
