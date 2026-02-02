// # Filename: src/components/user/RegisterPage.jsx


import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

import { useAuth } from "../../auth/hooks/useAuth";

const RegistrationPage = () => {
  const { register, isLoading, error } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  // # Step 1: Derived state for button UX
  const canSubmit = useMemo(() => {
    return (
      Boolean(formData.email.trim()) &&
      Boolean(formData.first_name.trim()) &&
      Boolean(formData.last_name.trim()) &&
      Boolean(formData.password.trim())
    );
  }, [formData]);

  // # Step 2: Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // STEP 1: Merge previous state with updated field
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // # Step 3: Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    await register(formData);
  };

  return (
    <div
      className={[
        // ✅ Better visual balance than dead-center:
        // - Mobile: naturally centered with padding
        // - Desktop: slightly higher (HUD vibe)
        "min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-6rem)]",
        "flex items-start justify-center",
        "px-4 pt-10 pb-12",
        "md:pt-14",
      ].join(" ")}
    >
      <div className="w-full max-w-[560px]">
        <form
          onSubmit={handleSubmit}
          className={[
            "relative overflow-hidden rounded-2xl bg-black",
            "border border-[#1DA1F2]/15",
            "shadow-[0_0_10px_rgba(29,161,242,0.22),0_0_26px_rgba(29,161,242,0.12),0_18px_40px_rgba(0,0,0,0.6)]",
            "px-5 py-8 sm:px-8 sm:py-10",
          ].join(" ")}
        >
          {/* Subtle HUD glow */}
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
              Create Account
            </h2>

            <p className="mt-3 text-center text-sm sm:text-base text-white/70">
              Join the hub to play, invite friends, and chat in real time.
            </p>

            {/* Email */}
            <div className="mt-8">
              <label
                htmlFor="email"
                className="block text-xs font-medium tracking-wide text-[#1DA1F2]/90 mb-2"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                autoComplete="email"
                placeholder="you@example.com"
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

            {/* First/Last name (responsive grid) */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="first_name"
                  className="block text-xs font-medium tracking-wide text-[#1DA1F2]/90 mb-2"
                >
                  First Name
                </label>

                <input
                  id="first_name"
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                  autoComplete="given-name"
                  placeholder="Anthony"
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

              <div>
                <label
                  htmlFor="last_name"
                  className="block text-xs font-medium tracking-wide text-[#1DA1F2]/90 mb-2"
                >
                  Last Name
                </label>

                <input
                  id="last_name"
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                  autoComplete="family-name"
                  placeholder="Narine"
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
            </div>

            {/* Password */}
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
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                  placeholder="Create a strong password"
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

            {/* Error */}
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

            {/* Submit */}
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
              {isLoading ? "Creating account..." : "Submit"}
            </button>

            {/* Link */}
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-sm text-white/80 hover:text-[#1DA1F2] transition-colors"
              >
                Already have an account? Login
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrationPage;
