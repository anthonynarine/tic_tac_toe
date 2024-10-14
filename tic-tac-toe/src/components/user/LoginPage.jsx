import React, { useState } from "react";
import "./Login.css";
import { useAuth } from "../hooks/useAuth"
import { Link } from "react-router-dom";

const LoginPage = () => {
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(formData)
  };

  return (
    <div id="login-container">
      <form id="login-form" onSubmit={handleSubmit}>
        <h2>Login</h2>
        <input
          type="email"
          name="email"
          value={formData.email}
          placeholder="Email"
          onChange={handleInputChange}
          required
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          placeholder="Password"
          onChange={handleInputChange}
          required
        />
        <button type="submit">Submit</button>
        <div className="register-link">
          <Link to="/register/">Don't have an account? Register here</Link>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
