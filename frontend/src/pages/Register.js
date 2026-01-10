import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/auth.css";

export default function Register() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  // Registration is now admin-only
  // This page shows information that users cannot self-register
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  // SAME BACKGROUND ANIMATION AS LOGIN
  useEffect(() => {
    const canvas = document.getElementById("graph-bg");
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const NODE_COUNT = 95;
    const MAX_DISTANCE = 150;

    const nodes = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 2 + Math.random() * 1.5,
        dx: (Math.random() - 0.5) * 0.5,
        dy: (Math.random() - 0.5) * 0.5
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      nodes.forEach(n => {
        ctx.beginPath();
        ctx.fillStyle = "#ffffffaa";
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fill();

        n.x += n.dx;
        n.y += n.dy;

        if (n.x < 0 || n.x > canvas.width) n.dx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.dy *= -1;
      });

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
      <canvas id="graph-bg"></canvas>

      <div className="container-center">
        <div className="auth-container modern-glass">
          <h2>🔒 Registration Disabled</h2>
          <p className="subtitle">User accounts can only be created by administrators</p>

          <div className="info-message" style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '20px',
            margin: '20px 0',
            textAlign: 'center'
          }}>
            <p style={{ margin: '10px 0', color: '#e6eef8' }}>
              User registration is restricted to administrators only.
              <br />
              <br />
              Please contact an administrator to create an account.
            </p>
            <p style={{ marginTop: '20px', fontSize: '14px', color: '#aaa' }}>
              Redirecting to login in {countdown} seconds...
            </p>
          </div>

          <Link to="/login" className="btn-login" style={{
            display: 'block',
            textAlign: 'center',
            textDecoration: 'none',
            marginTop: '20px'
          }}>
            Go to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
