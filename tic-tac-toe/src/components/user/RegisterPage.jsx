// # Filename: RegisterPage.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom"; 
import { useAuth } from "../auth/hooks/useAuth";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai"; 
import "./Registration.css";

const RegistrationPage = () => {
  const { register, isLoading, error } = useAuth(); 
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    password: "",
  });


  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // STEP 1: Merge the previous form state with the updated field
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();


    if (isLoading) return;

    await register(formData);
  };

  return (
    <div id="registration-container">
      <form id="registration-form" onSubmit={handleSubmit}>
        <h2>Create Account</h2>

        <div className="input-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="first_name" className="form-label">
            First Name
          </label>
          <input
            id="first_name"
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="last_name" className="form-label">
            Last Name
          </label>
          <input
            id="last_name"
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleInputChange}
            required
          />
        </div>

        {/* Password Input + Toggle */}
        <div className="input-group">
          <label htmlFor="password" className="form-label">
            Password
          </label>
          <input
            id="password"
            type={showPassword ? "text" : "password"} 
            name="password"
            value={formData.password}
            onChange={handleInputChange}
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

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Submit"}
        </button>


        <div className="register-link">
          <Link to="/login">Already have an account? Login</Link>
        </div>
      </form>
    </div>
  );
};

export default RegistrationPage;
