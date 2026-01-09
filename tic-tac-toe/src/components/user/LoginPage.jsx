// # Filename: LoginPage.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "./Login.css";

const LoginPage = () => {
  const { login, isLoading, error } = useAuth(); 
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
  const { name, value } = e.target;

  // STEP 1: Merge the previous form state with the updated field
  setFormData((prev) => ({ ...prev, [name]: value }));
};

  const handleSubmit = async (e) => {
    e.preventDefault();


    if (isLoading) return;

    await login(formData);
  };

  return (
    <div id="login-container">
      <form id="login-form" onSubmit={handleSubmit}>
        <h2>Welcome Back</h2>

        {/* Email Input */}
        <div className="input-group">
          <label htmlFor="email" className="form-label">
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
          />
        </div>

        {/* Password Input */}
        <div className="input-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={formData.password}
            onChange={handleInputChange}
            placeholder="••••••••"
            required
          />
          <span
            className="toggle-password"
            onClick={() => setShowPassword((prev) => !prev)}
            role="button" 
            tabIndex={0} 
            aria-label={showPassword ? "Hide password" : "Show password"} 
          >
            {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
          </span>
        </div>


        {error ? <div className="auth-error">{error}</div> : null}

        {/* Submit Button */}
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Logging in..." : "Login"}
        </button>

        {/* Register Link */}
        <div className="register-link">
          <Link to="/register/">Don't have an account? Register here</Link>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
