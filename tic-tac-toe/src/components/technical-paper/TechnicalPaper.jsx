import React from "react";
import "./TechnicalPaper.css";

const TechnicalPaper = () => {
  return (
    <div className="tech-paper-container">
      <h1 className="tech-title">Real-Time Multiplayer Web Game</h1>

      <section className="tech-section">
        <h2 className="tech-subtitle">1. Introduction</h2>
        <p className="tech-paragraph">
          This document outlines the technical architecture, deployment strategy, and development
          process behind a real-time, multiplayer web-based Tic Tac Toe game.
        </p>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">2. Project Overview</h2>
        <ul className="tech-list">
          <li>User authentication (JWT-based)</li>
          <li>Real-time multiplayer gameplay via WebSockets</li>
          <li>AI opponent mode</li>
          <li>In-game chat system</li>
          <li>Rematch and game state persistence</li>
        </ul>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">3. Technical Architecture</h2>
        <p><strong>Frontend:</strong> React (Netlify)</p>
        <p><strong>Backend:</strong> Django + Channels + DRF (Heroku)</p>
        <p><strong>Messaging:</strong> WebSockets via Channels</p>
        <p><strong>Auth:</strong> JWT (cookies/localStorage)</p>
        <p><strong>Database:</strong> Heroku PostgreSQL</p>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">4. WebSocket Flow</h2>
        <ol className="tech-list">
          <li>Player joins a lobby and connects to a WebSocket room.</li>
          <li>When both players are present, the game begins.</li>
          <li>Game state updates are broadcast to all clients via Redis.</li>
          <li>Clients update UI in real-time.</li>
          <li>Rematch and leave-game logic handled with specific message types.</li>
        </ol>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">5. Authentication Flow</h2>
        <ul className="tech-list">
          <li>JWT tokens issued upon login/registration.</li>
          <li>Stored in localStorage (dev) or secure cookies (prod).</li>
          <li>Axios interceptors attach and refresh tokens automatically.</li>
          <li>WebSocket connections authenticate using access token in query string.</li>
        </ul>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">6. Deployment Details</h2>
        <p><strong>Frontend:</strong> Netlify with SPA routing via _redirects</p>
        <p><strong>Backend:</strong> Heroku with Uvicorn ASGI + Redis (Upstash)</p>
        <p><strong>Environment:</strong> Config vars set via Netlify and Heroku dashboards</p>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">7. Development Challenges and Resolutions</h2>
        <ul className="tech-list">
          <li><strong>React Router 404 on Netlify:</strong> Added _redirects file to route to index.html</li>
          <li><strong>Token unavailable in production WebSocket:</strong> Switched from localStorage to js-cookie lookup</li>
          <li><strong>WebSocket desync:</strong> Enabled Redis + set DEBUG=False in Heroku</li>
          <li><strong>Page reload drops auth:</strong> Switched to cookie-based token persistence</li>
        </ul>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">8. Future Improvements</h2>
        <ul className="tech-list">
          <li>Persistent match history</li>
          <li>Leaderboards and rankings</li>
          <li>Socket-based matchmaking</li>
          <li>Visual animations and effects</li>
          <li>Chat moderation and rate-limiting</li>
        </ul>
      </section>

      <section className="tech-section">
        <h2 className="tech-subtitle">9. Conclusion</h2>
        <p className="tech-paragraph">
          This full-stack application demonstrates real-time capabilities using modern web technologies.
          With Django Channels, React, WebSockets, and Redis, it delivers an interactive multiplayer experience
          with a production-grade deployment setup.
        </p>
      </section>

      <footer className="tech-footer">
        <p>Author: Anthony Narine</p>
        <p>Date: May 2025</p>
      </footer>
    </div>
  );
};

export default TechnicalPaper;
