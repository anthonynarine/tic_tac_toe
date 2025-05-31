import React, { useEffect, useRef, useState } from "react";
import DrawerSection from "../../components/technical-paper/DrawerSection";
import "./TechnicalPaper.css";

const TechnicalPaper = () => {
  const [activeSection, setActiveSection] = useState(null);
  const observer = useRef(null);

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

    const ids = [
      "intro",
      "overview",
      "architecture",
      "wsflow",
      "authflow",
      "deployment",
      "challenges",
      "future",
      "gameviews",
      "conclusion",
    ];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.current.observe(el);
    });

    return () => observer.current.disconnect();
  }, []);

  return (
    <div className="tech-page-root">
      <div className="tech-layout">
        <div className="tech-paper-container">
          <div className="tech-header-bar">
            <button className="back-button" onClick={() => window.history.back()}>
              ←
            </button>
            <h1 className="tech-title">Real-Time Multiplayer Game</h1>
            <p className="tech-subtitle">A full-stack multiplayer game built using Django, React, Channels, WebSockets & Redis.</p>
          </div>

          <DrawerSection id="intro" title="Introduction" defaultOpen>
            <p>
              This project began as an effort to understand how WebSockets are used to build real-time chat systems. Along the way, it evolved into a complete multiplayer game with authenticated WebSocket connections, persistent state management, and live player interactions. The goal was to get hands-on experience using Django, React, Channels, and Redis to implement secure, real-time communication — not just for gameplay and chat, but also to learn how to authenticate and protect these channels end to end. What started as a chat demo became a hands-on journey into system design, architecture, and interactive application development.
            </p>
          </DrawerSection>

          <DrawerSection id="overview" title="Project Overview">
            <ul>
              <li>User authentication (JWT-based)</li>
              <li>Real-time multiplayer gameplay via WebSockets</li>
              <li>Single player vs AI opponent mode</li>
              <li>In-game chat system</li>
              <li>Rematch and game state persistence</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="architecture" title="Technical Architecture">
            <ul>
              <li><strong>Frontend:</strong> React (Netlify)</li>
              <li><strong>Backend:</strong> Django + Channels + DRF (Heroku)</li>
              <li><strong>Messaging:</strong> WebSockets via Channels</li>
              <li><strong>Auth:</strong> JWT (cookies/localStorage)</li>
              <li><strong>Database:</strong> Heroku PostgreSQL</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="wsflow" title="WebSocket Flow">
            <ol>
              <li>Player joins a lobby and connects to a WebSocket room.</li>
              <li>When both players are present, the game begins.</li>
              <li>Game state updates are broadcast to all clients via Redis.</li>
              <li>Clients update UI in real-time.</li>
              <li>Rematch and leave-game logic handled with specific message types.</li>
            </ol>
          </DrawerSection>

          <DrawerSection id="authflow" title="Authentication Flow">
            <ul>
              <li>JWT tokens issued upon login/registration.</li>
              <li>Stored in localStorage (dev) or secure cookies (prod).</li>
              <li>Axios interceptors attach and refresh tokens automatically.</li>
              <li>WebSocket connections authenticate using access token in query string.</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="deployment" title="Deployment Details">
            <ul>
              <li><strong>Frontend:</strong> Netlify with SPA routing via _redirects</li>
              <li><strong>Backend:</strong> Heroku with Uvicorn ASGI + Redis (Upstash)</li>
              <li><strong>Environment:</strong> Config vars set via Netlify and Heroku dashboards</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="challenges" title="Development Challenges and Resolutions">
            <ul>
              <li><strong>UI & Design:</strong> The most challenging part of the project was building and styling the user interface. Design and CSS are currently my weakest areas as a developer, so achieving a polished, responsive, and cohesive UI required significant trial and error, research, and iteration.</li>
              <li><strong>Token unavailable in production WebSocket:</strong> Switched from localStorage to js-cookie lookup</li>
              <li><strong>WebSocket desync:</strong> Enabled Redis + set DEBUG=False in Heroku</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="future" title="Future Improvements">
            <ul>
              <li>Persistent match history</li>
              <li>Leaderboards and rankings</li>
              <li>Socket-based matchmaking</li>
              <li>Visual animations and effects</li>
              <li>Chat moderation and rate-limiting</li>
            </ul>
          </DrawerSection>

          <DrawerSection id="gameviews" title="Gameplay Flow & Views">
            <p>
              Backend views like <code>perform_create</code>, <code>join_game</code>, and <code>make_move</code> handle core game logic and player actions. The frontend communicates through WebSocket messages to update board state and trigger real-time feedback. The <code>make_move</code> method internally validates turns, checks win conditions, and queues AI responses. Game states are synchronized via Redis broadcast channels, ensuring UI state is consistent across all connected players.
            </p>
          </DrawerSection>

          <DrawerSection id="conclusion" title="Conclusion">
            <p>
              This full-stack application demonstrates real-time capabilities using modern web technologies. With Django Channels, React, WebSockets, and Redis, it delivers an interactive multiplayer experience with secure authentication, persistent state, and a scalable deployment strategy.
            </p>
          </DrawerSection>
        </div>
      </div>
    </div>
  );
};

export default TechnicalPaper;
