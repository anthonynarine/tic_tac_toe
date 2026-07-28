// # Filename: src/components/user/RegisterPage.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { useAuth } from "../../auth/hooks/useAuth";
import Card from "../ui/Card";
import Button from "../ui/Button";

const inputClass =
  "w-full px-4 py-3 text-sm rounded-xl bg-surface border border-border-soft text-text-primary placeholder:text-text-faint outline-none transition-colors duration-150 focus:border-brand-cyan/50";

function Field({ id, label, type = "text", name, value, onChange, placeholder, autoComplete, children }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] font-semibold tracking-[0.2em] uppercase mb-2 text-text-muted"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id} type={type} name={name} value={value} onChange={onChange}
          placeholder={placeholder} required autoComplete={autoComplete}
          className={inputClass}
        />
        {children}
      </div>
    </div>
  );
}

const RegistrationPage = () => {
  const { register, isLoading, error } = useAuth();
  const [formData, setFormData] = useState({ email: "", first_name: "", last_name: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit = useMemo(
    () => Object.values(formData).every((v) => Boolean(v.trim())),
    [formData]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    await register(formData);
  };

  return (
    <div className="w-full max-w-[440px]">

      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-[10px] tracking-[0.4em] uppercase font-semibold mb-5 text-text-muted">
          Game Hub
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mb-2 text-text-primary">
          Create Account
        </h1>
        <p className="text-sm text-text-secondary">
          Join to play, invite friends, and chat in real time.
        </p>
      </div>

      {/* Card */}
      <Card variant="glass" className="relative px-6 py-7 space-y-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field id="email" label="Email" type="email" name="email"
            value={formData.email} onChange={handleChange}
            placeholder="you@example.com" autoComplete="email" />

          <div className="grid grid-cols-2 gap-3">
            <Field id="first_name" label="First Name" name="first_name"
              value={formData.first_name} onChange={handleChange}
              placeholder="Anthony" autoComplete="given-name" />
            <Field id="last_name" label="Last Name" name="last_name"
              value={formData.last_name} onChange={handleChange}
              placeholder="Narine" autoComplete="family-name" />
          </div>

          <Field
            id="password" label="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password} onChange={handleChange}
            placeholder="Create a strong password" autoComplete="new-password"
          >
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 focus:outline-none text-text-faint transition-colors hover:text-brand-cyan"
            >
              {showPassword ? <AiOutlineEyeInvisible size={17} /> : <AiOutlineEye size={17} />}
            </button>
          </Field>

          {error && (
            <div className="px-4 py-3 text-sm rounded-xl bg-brand-rose/10 border border-brand-rose/25 text-brand-rose">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !canSubmit}
            className="w-full"
          >
            {isLoading ? "Creating account…" : "Create Account"}
          </Button>
        </form>
      </Card>

      <p className="text-center mt-6 text-sm text-text-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-cyan/80 transition-colors hover:text-brand-cyan">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default RegistrationPage;
