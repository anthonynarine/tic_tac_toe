import React, { useEffect, useRef, useState } from "react";
import "./TechnicalPaper.css";
import DrawerSection from "./DrawerSection";
import { FaGithub } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";

// 🧭 Section metadata for drawer navigation
const sections = [
  { id: "intro", title: "1. Introduction" },
  { id: "overview", title: "2. Project Overview" },
  { id: "architecture", title: "3. Technical Architecture" },
  { id: "wsflow", title: "4. WebSocket Flow" },
  { id: "authflow", title: "5. Authentication Flow" },
  { id: "deployment", title: "6. Deployment" },
  { id: "challenges", title: "7. Challenges" },
  { id: "future", title: "8. Future Improvements" },
  { id: "gameviews", title: "9. Gameplay Flow & Views" },
  { id: "conclusion", title: "10. Conclusion" },
];

const TechnicalPaper = () => {
  const [activeSection, setActiveSection] = useState(null);
  const observer = useRef(null);
  const navigate = useNavigate();

  // 🎯 Set active drawer section on scroll using IntersectionObserver
  useEffect(() => {
    const handleIntersect = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    observer.current = new IntersectionObserver(handleIntersect, {
      rootMargin: "-40% 0% -50% 0%",
      threshold: 0.1,
    });

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.current.observe(el);
    });

    return () => observer.current.disconnect();
  }, []);

  return (
    <div className="tech-page-root">
      <div className="tech-layout">
        {/* 📄 Main Content */}
        <div className="tech-paper-container">
            <div className="tech-header-row">
              <button className="back-button" onClick={() => navigate(-1)}>
                <FaArrowLeft />
              </button>
              <h1 className="tech-title">Real-Time Multiplayer Game</h1>
            </div>
          <p className="tech-paragraph" style={{ textAlign: "center", marginBottom: "2rem", color: "#aaa" }}>
            A full-stack multiplayer game built using Django, React, Channels, WebSockets & Redis.
          </p>

          {/* 📦 Drawer Sections */}
          <DrawerSection id="intro" title="1. Introduction" defaultOpen>
            <p className="tech-paragraph">
              This project began as an effort to understand how WebSockets are used to build real-time chat systems.
              Along the way, it evolved into a complete multiplayer game with authenticated WebSocket connections,
              persistent state management, and live player interactions. What started as a chat demo became a
              hands-on journey into system design, architecture, and interactive application development.
            </p>
          </DrawerSection>

          <DrawerSection id="overview" title="2. Project Overview">
            <ul className="tech-list">
              <li>User authentication (JWT-based)</li>
              <li>Real-time multiplayer gameplay via WebSockets</li>
              <li>Single player vs AI opponent mode</li>
              <li>In-game chat system</li>
              <li>Rematch and game state persistence</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="architecture" title="3. Technical Architecture">
            <p><strong>Frontend:</strong> React (Netlify)</p>
            <p><strong>Backend:</strong> Django + Channels + DRF (Heroku)</p>
            <p><strong>Messaging:</strong> WebSockets via Channels</p>
            <p><strong>Auth:</strong> JWT (cookies/localStorage)</p>
            <p><strong>Database:</strong> Heroku PostgreSQL</p>
          </DrawerSection>

          <DrawerSection id="wsflow" title="4. WebSocket Flow">
            <ol className="tech-list">
              <li>Player joins a lobby and connects to a WebSocket room.</li>
              <li>When both players are present, the game begins.</li>
              <li>Game state updates are broadcast to all clients via Redis.</li>
              <li>Clients update UI in real-time.</li>
              <li>Rematch and leave-game logic handled with specific message types.</li>
            </ol>
          </DrawerSection>

          <DrawerSection id="authflow" title="5. Authentication Flow">
            <ul className="tech-list">
              <li>JWT tokens issued upon login/registration.</li>
              <li>Stored in localStorage (dev) or secure cookies (prod).</li>
              <li>Axios interceptors attach and refresh tokens automatically.</li>
              <li>WebSocket connections authenticate using access token in query string.</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="deployment" title="6. Deployment Details">
            <p><strong>Frontend:</strong> Netlify with SPA routing via _redirects</p>
            <p><strong>Backend:</strong> Heroku with Uvicorn ASGI + Redis (Upstash)</p>
            <p><strong>Environment:</strong> Config vars set via Netlify and Heroku dashboards</p>
          </DrawerSection>

          <DrawerSection id="challenges" title="7. Development Challenges and Resolutions">
            <ul className="tech-list">
              <li><strong>React Router 404 on Netlify:</strong> Added _redirects file to route to index.html</li>
              <li><strong>Token unavailable in production WebSocket:</strong> Switched from localStorage to js-cookie lookup</li>
              <li><strong>WebSocket desync:</strong> Enabled Redis + set DEBUG=False in Heroku</li>
              <li><strong>Page reload drops auth:</strong> Switched to cookie-based token persistence</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="future" title="8. Future Improvements">
            <ul className="tech-list">
              <li>Persistent match history</li>
              <li>Leaderboards and rankings</li>
              <li>Socket-based matchmaking</li>
              <li>Visual animations and effects</li>
              <li>Chat moderation and rate-limiting</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="gameviews" title="9. Gameplay Flow & Views">
            <p className="tech-paragraph">
              Backend views like `perform_create`, `join_game`, and `make_move` handle core game logic and player actions.
              The frontend communicates through WebSocket messages to update board state and trigger real-time feedback.
              Game states are synchronized via Redis broadcast channels, ensuring UI state is consistent across all connected players.
            </p>
          </DrawerSection>

          <DrawerSection id="conclusion" title="10. Conclusion">
            <p className="tech-paragraph">
              This full-stack application demonstrates real-time capabilities using modern web technologies. With Django Channels,
              React, WebSockets, and Redis, it delivers an interactive multiplayer experience with secure authentication,
              persistent state, and a scalable deployment strategy.
            </p>
          </DrawerSection>

          {/* 👤 Footer */}
          <footer className="tech-footer">
            <p>Author: Anthony Narine</p>
            <p>Date: May 2025</p>
            <a
              href="https://github.com/anthonynarine/tic_tac_toe"
              target="_blank"
              rel="noopener noreferrer"
              className="github-link"
            >
              <FaGithub style={{ marginRight: "0.5rem" }} />
              View source on GitHub
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default TechnicalPaper;
