import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/auth.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    alert("Logged in!");
  };

useEffect(() => {
  const canvas = document.getElementById("graph-bg");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // === CONFIG ===
  const NODE_COUNT = 95;
  const MAX_DISTANCE = 150;

  const nodes = [];

  // === CREATE PARTICLES ===
  for (let i = 0; i < NODE_COUNT; i++) {
    nodes.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 2 + Math.random() * 1.5,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5
    });
  }

  // === ANIMATION ===
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw particles
    nodes.forEach(n => {
      ctx.beginPath();
      ctx.fillStyle = "#ffffffaa";
      ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
      ctx.fill();

      n.x += n.dx;
      n.y += n.dy;

      // bounce
      if (n.x < 0 || n.x > canvas.width) n.dx *= -1;
      if (n.y < 0 || n.y > canvas.height) n.dy *= -1;
    });

    // Draw lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MAX_DISTANCE) {
          ctx.strokeStyle = `rgba(255,255,255, ${1 - dist / MAX_DISTANCE})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();

  window.onresize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
}, []);



  return (
    <div className="login-page">
      {/* BACKGROUND */}
      <canvas id="graph-bg"></canvas>

      {/* CENTER LOGIN CARD */}
      <div className="container-center">
       

        <div className="auth-container modern-glass">
          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to continue your AI journey</p>

          <form onSubmit={submit}>
            <div className="input-group">
              <span className="input-icon">📧</span>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="input-group">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-login">Sign In</button>
          </form>

          <p className="register-text">
            No account? <Link to="/register">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
