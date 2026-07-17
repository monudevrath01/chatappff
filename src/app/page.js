"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { MessageSquare, Sparkles, CreditCard, ArrowRight } from "lucide-react";

export default function Home() {
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState("mock"); // "mock" or "google"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/chat");
    }
  }, [router]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/config`);
        if (res.ok) {
          const data = await res.json();
          if (data.googleClientId) {
            setGoogleClientId(data.googleClientId);
          }
        }
      } catch (err) {
        console.error("Failed to load auth config from backend:", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (activeTab === "google" && googleClientId && typeof window !== "undefined" && window.google) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });

        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          {
            theme: "filled_blue",
            size: "large",
            width: 320,
            text: "signin_with",
            shape: "rectangular"
          }
        );
      } catch (err) {
        console.error("Google Identity Service initialization failed:", err);
      }
    }
  }, [activeTab, googleClientId, googleScriptLoaded]);

  const handleLogin = async (mockUsername) => {
    if (!mockUsername || mockUsername.trim() === "") {
      setError("Please enter a username to proceed.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sanitizedUser = mockUsername.trim().toLowerCase().replace(/\s+/g, "");
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: `mock_token_${sanitizedUser}`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to authenticate.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/chat");
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.message || "Something went wrong. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleMockTokenSubmit = (e) => {
    e.preventDefault();
    handleLogin(username);
  };

  const handleGoogleCredentialResponse = async (response) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: response.credential,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to verify Google Token on backend.");
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      router.push("/chat");
    } catch (err) {
      console.error("Google Auth error:", err);
      setError(err.message || "Google Sign-In failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.container}>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setGoogleScriptLoaded(true)}
      />

      <div style={styles.backgroundGlows}>
        <div style={styles.glow1}></div>
        <div style={styles.glow2}></div>
      </div>

      <div style={styles.wrapper} className="animate-scale-in">
        <div style={styles.brandHeader}>
          <div style={styles.logoIcon}>
            <MessageSquare size={28} color="#00e5ff" />
          </div>
          <h1 style={styles.brandTitle}>Aether<span style={{ color: "#5f5bf6" }}>Chat</span></h1>
          <p style={styles.brandSubtitle}>Real-time communication meets generative AI.</p>
        </div>

        <div style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <Sparkles size={20} color="#00e5ff" />
            <div>
              <h4 style={styles.featureTitle}>Gemini AI Integration</h4>
              <p style={styles.featureDesc}>Get smart suggestions and chat summaries instantly.</p>
            </div>
          </div>
          <div style={styles.featureCard}>
            <CreditCard size={20} color="#f5b041" />
            <div>
              <h4 style={styles.featureTitle}>Razorpay Gateway</h4>
              <p style={styles.featureDesc}>Unlock premium AI capabilities with an instant checkout upgrade.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={styles.loginPanel}>
          <div style={styles.tabHeader}>
            <button
              onClick={() => { setActiveTab("mock"); setError(""); }}
              style={{
                ...styles.tabBtn,
                borderBottomColor: activeTab === "mock" ? "#5f5bf6" : "transparent",
                color: activeTab === "mock" ? "#f3f4f6" : "#6b7280"
              }}
            >
              Mock Login
            </button>
            <button
              onClick={() => { setActiveTab("google"); setError(""); }}
              style={{
                ...styles.tabBtn,
                borderBottomColor: activeTab === "google" ? "#5f5bf6" : "transparent",
                color: activeTab === "google" ? "#f3f4f6" : "#6b7280"
              }}
            >
              Google OAuth
            </button>
          </div>

          <div style={styles.tabContent}>
            {error && <div style={styles.errorAlert}>{error}</div>}

            {activeTab === "mock" ? (
              <form onSubmit={handleGoogleMockTokenSubmit} style={styles.form}>
                <p style={styles.infoText}>
                  Type a username below. It registers a secure account in our DB and unlocks socket chat functionality.
                </p>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Enter Username</label>
                  <input
                    type="text"
                    placeholder="e.g., alex, monu, priya"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={styles.input}
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="btn-primary"
                  style={styles.submitBtn}
                >
                  {loading ? "Authenticating..." : "Join Chatroom"}
                  <ArrowRight size={18} />
                </button>
              </form>
            ) : (
              <div style={styles.googleTabContent}>
                <p style={styles.infoText}>
                  Authenticate via standard Google OAuth login.
                </p>

                {googleClientId ? (
                  <div style={styles.googleContainer}>
                    <div id="google-signin-btn" style={styles.googleBtnContainer}></div>
                    {loading && (
                      <p style={{ marginTop: "12px", fontSize: "0.8rem", color: "#9ca3af" }}>
                        Verifying credentials...
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={styles.warningBox}>
                    <p style={{ fontWeight: "700", marginBottom: "4px" }}>GOOGLE_CLIENT_ID NOT CONFIGURED</p>
                    Please configure Google OAuth client ID in the backend `.env` file, or use Mock Login for instant setup testing!
                  </div>
                )}

                <p style={styles.fineprint}>
                  Note: Please use Mock Login for quick developer configuration testing!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

const styles = {
  container: {
    position: "relative",
    width: "100%",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: "#08090d",
  },
  backgroundGlows: {
    position: "absolute",
    width: "100%",
    height: "100%",
    top: 0,
    left: 0,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 1,
  },
  glow1: {
    position: "absolute",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(95, 91, 246, 0.15) 0%, rgba(95, 91, 246, 0) 70%)",
    top: "10%",
    left: "15%",
  },
  glow2: {
    position: "absolute",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0, 229, 255, 0.08) 0%, rgba(0, 229, 255, 0) 70%)",
    bottom: "10%",
    right: "10%",
  },
  wrapper: {
    width: "100%",
    maxWidth: "460px",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    gap: "28px",
  },
  brandHeader: {
    textAlign: "center",
  },
  logoIcon: {
    width: "60px",
    height: "60px",
    borderRadius: "16px",
    background: "rgba(95, 91, 246, 0.15)",
    border: "1px solid rgba(95, 91, 246, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px auto",
    boxShadow: "0 0 20px rgba(95, 91, 246, 0.2)",
  },
  brandTitle: {
    fontSize: "2.25rem",
    fontWeight: "800",
    color: "#fff",
    letterSpacing: "-0.03em",
    marginBottom: "8px",
  },
  brandSubtitle: {
    fontSize: "0.95rem",
    color: "#9ca3af",
  },
  featureGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  featureCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: "16px",
    padding: "14px 18px",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
  },
  featureTitle: {
    fontSize: "0.85rem",
    fontWeight: "700",
    color: "#fff",
    marginBottom: "4px",
  },
  featureDesc: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    lineHeight: "1.4",
  },
  loginPanel: {
    padding: "24px",
  },
  tabHeader: {
    display: "flex",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    marginBottom: "24px",
  },
  tabBtn: {
    flex: 1,
    padding: "12px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    fontSize: "0.9rem",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  tabContent: {
    width: "100%",
  },
  errorAlert: {
    padding: "12px 16px",
    borderRadius: "8px",
    background: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    color: "#ef4444",
    fontSize: "0.85rem",
    marginBottom: "20px",
    lineHeight: "1.4",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  infoText: {
    fontSize: "0.825rem",
    color: "#9ca3af",
    lineHeight: "1.5",
    marginBottom: "6px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#f3f4f6",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    padding: "12px 16px",
    borderRadius: "10px",
    background: "rgba(0, 0, 0, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#fff",
    fontSize: "0.95rem",
    outline: "none",
    transition: "all 0.2s ease",
  },
  submitBtn: {
    justifyContent: "center",
    width: "100%",
    marginTop: "6px",
  },
  googleTabContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "18px",
    width: "100%",
  },
  googleContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  googleBtnContainer: {
    minHeight: "44px",
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },
  warningBox: {
    padding: "14px 18px",
    borderRadius: "10px",
    background: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.2)",
    color: "#f59e0b",
    fontSize: "0.75rem",
    lineHeight: "1.5",
    textAlign: "center",
  },
  fineprint: {
    fontSize: "0.7rem",
    color: "#6b7280",
    textAlign: "center",
  },
};
