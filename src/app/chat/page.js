"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import {
  MessageSquare,
  Send,
  Sparkles,
  Crown,
  LogOut,
  CheckCircle,
  Loader2,
  User,
  Coffee,
  X,
  CreditCard
} from "lucide-react";

export default function ChatPage() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [socket, setSocket] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(true);


  const [upgrading, setUpgrading] = useState(false);
  const [showMockPaymentModal, setShowMockPaymentModal] = useState(false);
  const [mockOrderDetails, setMockOrderDetails] = useState(null);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);


  const [suggesting, setSuggesting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [chatSummary, setChatSummary] = useState("");
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const messagesEndRef = useRef(null);
  const router = useRouter();


  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      router.push("/");
      return;
    }

    const parsedUser = JSON.parse(storedUser);
    setUser(parsedUser);


    fetchMessages(token);


    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL, {
      transports: ["websocket", "polling"]
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected to server:", socketInstance.id);
      socketInstance.emit("register", parsedUser.id);
    });


    socketInstance.on("new_message", (message) => {
      setMessages((prev) => {

        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });


    socketInstance.on("payment_success", (data) => {
      console.log("Payment success event received via Socket:", data);


      const updatedUser = { ...parsedUser, isPremium: true };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      setShowSuccessOverlay(true);
      setTimeout(() => {
        setShowSuccessOverlay(false);
      }, 8000);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [router]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async (token) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else if (res.status === 401) {
        console.warn("Session invalid. Logging out.");
        handleLogout();
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !socket || !user) return;

    socket.emit("send_message", {
      senderId: user.id,
      text: inputText.trim()
    });

    setInputText("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    if (socket) socket.disconnect();
    router.push("/");
  };

  const initiateUpgrade = async () => {
    setUpgrading(true);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payment/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: 499 })
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const orderData = await response.json();

      if (!response.ok) {
        throw new Error(orderData.message || "Failed to create payment order.");
      }

      if (orderData.isMock) {
        setMockOrderDetails(orderData);
        setShowMockPaymentModal(true);
        setUpgrading(false);
        return;
      }


      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "AetherChat Premium",
          description: "Unlock AI replies and chat summaries",
          order_id: orderData.id,
          handler: async function (response) {

            verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature);
          },
          prefill: {
            name: user.name,
            email: user.email,
          },
          theme: {
            color: "#5f5bf6",
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        setUpgrading(false);
      };
      document.body.appendChild(script);

    } catch (err) {
      alert("Payment Initiation Failed: " + err.message);
      setUpgrading(false);
    }
  };

  const verifyPayment = async (orderId, paymentId, signature) => {
    setUpgrading(true);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payment/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature
        })
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const verifyData = await response.json();

      if (response.ok && verifyData.status === "success") {

        const updatedUser = { ...user, isPremium: true };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
      } else {
        alert("Payment verification failed: " + verifyData.message);
      }
    } catch (err) {
      console.error("Payment verification error:", err);
      alert("Failed to verify payment status.");
    } finally {
      setUpgrading(false);
      setShowMockPaymentModal(false);
    }
  };

  const executeMockPaymentSuccess = () => {

    const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(7)}`;
    const mockSignature = `sig_mock_${Math.random().toString(36).substring(7)}`;
    verifyPayment(mockOrderDetails.id, mockPaymentId, mockSignature);
  };


  const handleAISuggestReply = async () => {
    if (!user?.isPremium) return;
    setSuggesting(true);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();

      if (response.ok && data.suggestion) {
        setInputText(data.suggestion);
      } else {
        console.error("AI Reply Suggest Error:", data.message);
      }
    } catch (err) {
      console.error("Suggest AI Error:", err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleAIChatSummary = async () => {
    if (!user?.isPremium) return;
    setSummarizing(true);
    const token = localStorage.getItem("token");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();

      if (response.ok && data.summary) {
        setChatSummary(data.summary);
        setShowSummaryModal(true);
      } else {
        console.error("AI Summary Error:", data.message);
      }
    } catch (err) {
      console.error("Summary AI Error:", err);
    } finally {
      setSummarizing(false);
    }
  };

  if (!user) {
    return (
      <div style={styles.loadingContainer}>
        <Loader2 className="animate-spin" size={40} color="#5f5bf6" />
        <p style={{ marginTop: "12px", color: "#9ca3af" }}>Loading session...</p>
      </div>
    );
  }

  return (
    <div style={styles.dashboard}>
      <div style={styles.topDecorationGlow}></div>

      {/* Main Container */}
      <div style={styles.mainGrid}>

        <div className="glass-panel" style={styles.sidebar}>

          {/* User profile section */}
          <div style={styles.profileBox}>
            <div style={styles.avatarWrapper}>
              {user.picture ? (
                <img src={user.picture} alt={user.name} style={styles.avatarImg} />
              ) : (
                <div style={styles.avatarPlaceholder}><User size={24} color="#9ca3af" /></div>
              )}
            </div>

            <div style={styles.profileDetails}>
              <h3 style={styles.profileName}>{user.name}</h3>
              <p style={styles.profileEmail}>{user.email}</p>

              <div style={{ marginTop: "8px" }}>
                {user.isPremium ? (
                  <span className="badge-premium"><Crown size={12} /> Premium</span>
                ) : (
                  <span className="badge-free">Free User</span>
                )}
              </div>
            </div>
          </div>

          <div style={styles.divider}></div>


          {!user.isPremium && (
            <div style={styles.premiumCtaBox}>
              <div style={styles.ctaHeader}>
                <Crown size={20} color="#f5b041" />
                <h4 style={{ fontWeight: "700", color: "#fff", fontSize: "0.85rem" }}>Upgrade to Premium</h4>
              </div>
              <p style={styles.ctaText}>
                Unlock advanced Google Gemini features: Smart suggestions and instant chat summaries.
              </p>
              <div style={styles.pricingTag}>
                <span style={styles.price}>₹499</span>
                <span style={styles.frequency}>/ one-time</span>
              </div>

              <button
                onClick={initiateUpgrade}
                disabled={upgrading}
                className="btn-premium"
                style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem" }}
              >
                {upgrading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  "Unlock AI Features"
                )}
              </button>
            </div>
          )}

          {user.isPremium && (
            <div style={styles.premiumSuccessCard}>
              <div style={styles.successHeader}>
                <Crown size={24} color="#f5b041" />
                <h4 style={{ fontWeight: "800", color: "#fff", fontSize: "0.9rem" }}>Aether Premium Active</h4>
              </div>
              <p style={styles.successCardText}>
                Gemini AI integration is enabled. Enjoy smart replies and chat summarizations.
              </p>
            </div>
          )}

          <div style={{ flex: 1 }}></div>


          <button onClick={handleLogout} style={styles.logoutBtn}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>


        <div className="glass-panel" style={styles.chatArea}>


          <div style={styles.chatHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={styles.roomIcon}>
                <MessageSquare size={20} color="#00e5ff" />
              </div>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "#fff" }}>Global Discussion</h3>
                <p style={{ fontSize: "0.75rem", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={styles.onlinePulse}></span> Connected
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleAIChatSummary}
                disabled={!user.isPremium || summarizing}
                className="btn-icon"
                title={user.isPremium ? "Summarize Conversation" : "Premium feature - Please upgrade"}
                style={{
                  opacity: user.isPremium ? 1 : 0.4,
                  cursor: user.isPremium ? "pointer" : "not-allowed"
                }}
              >
                {summarizing ? (
                  <Loader2 size={18} className="animate-spin" color="#00e5ff" />
                ) : (
                  <Sparkles size={18} color={user.isPremium ? "#00e5ff" : "#9ca3af"} />
                )}
              </button>
            </div>
          </div>


          <div style={styles.messageBox}>
            {loadingMessages ? (
              <div style={styles.chatStateCentered}>
                <Loader2 size={24} className="animate-spin" color="#5f5bf6" />
                <p style={{ marginTop: "8px", fontSize: "0.85rem", color: "#9ca3af" }}>Loading chat history...</p>
              </div>
            ) : messages.length === 0 ? (
              <div style={styles.chatStateCentered}>
                <Coffee size={36} color="#6b7280" />
                <p style={{ marginTop: "12px", fontSize: "0.85rem", color: "#9ca3af" }}>No messages yet. Say hello!</p>
              </div>
            ) : (
              <div style={styles.messagesList}>
                {messages.map((msg) => {
                  const isOwnMessage = msg.sender?._id === user.id || msg.sender === user.id;

                  return (
                    <div
                      key={msg._id}
                      style={{
                        ...styles.messageRow,
                        justifyContent: isOwnMessage ? "flex-end" : "flex-start"
                      }}
                      className="animate-fade-in-up"
                    >
                      {!isOwnMessage && (
                        <div style={styles.msgAvatarWrapper}>
                          {msg.sender?.picture ? (
                            <img src={msg.sender.picture} alt="" style={styles.msgAvatarImg} />
                          ) : (
                            <div style={styles.msgAvatarPlaceholder}><User size={12} color="#9ca3af" /></div>
                          )}
                        </div>
                      )}

                      <div style={styles.bubbleContainer}>
                        {!isOwnMessage && (
                          <div style={styles.senderHeader}>
                            <span style={styles.senderName}>{msg.sender?.name || "User"}</span>
                            {msg.sender?.isPremium && (
                              <span style={styles.miniPremiumBadge}><Crown size={8} /></span>
                            )}
                          </div>
                        )}
                        <div style={{
                          ...styles.msgBubble,
                          background: isOwnMessage ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                          borderBottomRightRadius: isOwnMessage ? "4px" : "12px",
                          borderBottomLeftRadius: isOwnMessage ? "12px" : "4px",
                        }}>
                          <p style={styles.bubbleText}>{msg.text}</p>
                          <span style={styles.bubbleTime}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {user.isPremium && (
            <div style={styles.aiHelperBar}>
              <button
                onClick={handleAISuggestReply}
                disabled={suggesting}
                style={styles.aiPillBtn}
              >
                <Sparkles size={12} color="#00e5ff" />
                {suggesting ? "Generating..." : "Suggest Smart Reply"}
              </button>
            </div>
          )}


          <form onSubmit={handleSendMessage} style={styles.chatInputForm}>
            <input
              type="text"
              placeholder={user.isPremium ? "Ask AI to suggest replies or type message..." : "Type your message..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              style={styles.textInput}
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="btn-primary"
              style={styles.sendBtn}
            >
              <Send size={18} />
            </button>
          </form>
        </div>

      </div>


      {showSuccessOverlay && (
        <div style={styles.overlay} className="animate-success-pop">
          <div style={styles.successPopup} className="glass-panel">
            <div style={styles.successIconBox}>
              <CheckCircle size={48} color="#10b981" />
            </div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#fff", marginBottom: "8px" }}>
              Premium Unlocked!
            </h2>
            <p style={{ fontSize: "0.9rem", color: "#9ca3af", textAlign: "center", lineHeight: "1.5", marginBottom: "16px" }}>
              Welcome to Aether Premium. Google Gemini AI features are now active for you.
            </p>
            <span className="badge-premium"><Crown size={14} /> Premium Account</span>
          </div>
        </div>
      )}


      {showMockPaymentModal && mockOrderDetails && (
        <div style={styles.modalOverlay}>
          <div style={styles.mockModal} className="glass-panel animate-scale-in">
            <h3 style={{ fontSize: "1.2rem", fontWeight: "800", color: "#fff", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CreditCard color="#f5b041" /> Mock Razorpay Sandbox
            </h3>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", lineHeight: "1.5", marginBottom: "18px" }}>
              The backend generated a test order <strong>{mockOrderDetails.id}</strong> because live keys are not configured in `.env`. Complete payment to unlock premium features.
            </p>

            <div style={styles.receiptBox}>
              <div style={styles.receiptLine}>
                <span>Product</span>
                <span>AetherChat Premium</span>
              </div>
              <div style={styles.receiptLine}>
                <span>Amount</span>
                <span style={{ fontWeight: "700", color: "#fff" }}>₹499.00</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", width: "100%" }}>
              <button
                onClick={() => setShowMockPaymentModal(false)}
                style={styles.modalCancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={executeMockPaymentSuccess}
                style={styles.modalPayBtn}
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      )}


      {showSummaryModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.summaryModal} className="glass-panel animate-scale-in">
            <div style={styles.summaryModalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={20} color="#00e5ff" />
                <h3 style={{ fontSize: "1.1rem", fontWeight: "800", color: "#fff" }}>AI Conversation Summary</h3>
              </div>
              <button onClick={() => setShowSummaryModal(false)} style={styles.closeModalBtn}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.summaryContent}>
              <p style={{ fontSize: "0.9rem", color: "#f3f4f6", lineHeight: "1.6", fontWeight: "400" }}>
                {chatSummary}
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="btn-primary"
                style={{ padding: "8px 20px", fontSize: "0.85rem" }}
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  loadingContainer: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#08090d",
  },
  dashboard: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    display: "flex",
    background: "#08090d",
    padding: "24px",
    overflow: "hidden",
  },
  topDecorationGlow: {
    position: "absolute",
    width: "600px",
    height: "200px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(95, 91, 246, 0.08) 0%, rgba(95, 91, 246, 0) 80%)",
    top: "-50px",
    left: "25%",
    pointerEvents: "none",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    width: "100%",
    height: "100%",
    gap: "24px",
    zIndex: 2,
  },
  sidebar: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "24px",
  },
  profileBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  avatarWrapper: {
    width: "80px",
    height: "80px",
    borderRadius: "24px",
    overflow: "hidden",
    background: "rgba(255, 255, 255, 0.03)",
    border: "2px solid rgba(255, 255, 255, 0.08)",
    marginBottom: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255, 255, 255, 0.05)",
  },
  profileDetails: {
    width: "100%",
  },
  profileName: {
    fontSize: "1.1rem",
    fontWeight: "800",
    color: "#fff",
    letterSpacing: "-0.01em",
  },
  profileEmail: {
    fontSize: "0.8rem",
    color: "#9ca3af",
    marginTop: "2px",
    wordBreak: "break-all",
  },
  divider: {
    height: "1px",
    background: "rgba(255, 255, 255, 0.06)",
    width: "100%",
    margin: "24px 0",
  },
  premiumCtaBox: {
    background: "radial-gradient(circle at top left, rgba(245, 176, 65, 0.06) 0%, rgba(245, 176, 65, 0.01) 100%)",
    border: "1px solid rgba(245, 176, 65, 0.15)",
    padding: "20px",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  ctaHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  ctaText: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    lineHeight: "1.5",
  },
  pricingTag: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    margin: "4px 0",
  },
  price: {
    fontSize: "1.5rem",
    fontWeight: "800",
    color: "#f5b041",
  },
  frequency: {
    fontSize: "0.75rem",
    color: "#6b7280",
  },
  premiumSuccessCard: {
    background: "radial-gradient(circle at top left, rgba(95, 91, 246, 0.06) 0%, rgba(0, 229, 255, 0.02) 100%)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    padding: "20px",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  successHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  successCardText: {
    fontSize: "0.75rem",
    color: "#9ca3af",
    lineHeight: "1.5",
  },
  logoutBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    background: "rgba(239, 68, 68, 0.06)",
    border: "1px solid rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.2s ease",
  },
  chatArea: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatHeader: {
    padding: "16px 24px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roomIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "rgba(0, 229, 255, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  onlinePulse: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#10b981",
    boxShadow: "0 0 8px #10b981",
  },
  messageBox: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
    background: "rgba(0,0,0,0.15)",
  },
  chatStateCentered: {
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  messagesList: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  messageRow: {
    display: "flex",
    gap: "12px",
    maxWidth: "75%",
    alignItems: "flex-end",
  },
  msgAvatarWrapper: {
    width: "32px",
    height: "32px",
    borderRadius: "10px",
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.02)",
  },
  msgAvatarImg: {
    width: "100%",
    height: "100%",
  },
  msgAvatarPlaceholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  senderHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    paddingLeft: "4px",
  },
  senderName: {
    fontSize: "0.75rem",
    fontWeight: "600",
    color: "#9ca3af",
  },
  miniPremiumBadge: {
    display: "inline-flex",
    background: "var(--premium-gold)",
    color: "#121424",
    padding: "1px 3px",
    borderRadius: "4px",
    fontSize: "0.55rem",
    fontWeight: "900",
  },
  msgBubble: {
    padding: "12px 16px",
    borderRadius: "12px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  bubbleText: {
    fontSize: "0.9rem",
    color: "#fff",
    lineHeight: "1.45",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  bubbleTime: {
    fontSize: "0.65rem",
    color: "rgba(255,255,255,0.5)",
    alignSelf: "flex-end",
  },
  aiHelperBar: {
    padding: "8px 24px 0 24px",
    display: "flex",
    gap: "8px",
  },
  aiPillBtn: {
    background: "rgba(0, 229, 255, 0.08)",
    border: "1px solid rgba(0, 229, 255, 0.15)",
    color: "#00e5ff",
    borderRadius: "20px",
    padding: "6px 12px",
    fontSize: "0.75rem",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    transition: "all 0.2s ease",
  },
  chatInputForm: {
    padding: "16px 24px 24px 24px",
    display: "flex",
    gap: "12px",
  },
  textInput: {
    flex: 1,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: "12px",
    padding: "12px 18px",
    color: "#fff",
    outline: "none",
    fontSize: "0.9rem",
    transition: "all 0.2s ease",
  },
  sendBtn: {
    height: "46px",
    width: "46px",
    borderRadius: "12px",
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  successPopup: {
    width: "360px",
    padding: "36px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  successIconBox: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "rgba(16, 185, 129, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 90,
  },
  mockModal: {
    width: "400px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
  },
  receiptBox: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  receiptLine: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.8rem",
    color: "#9ca3af",
  },
  modalCancelBtn: {
    flex: 1,
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    color: "#9ca3af",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
  },
  modalPayBtn: {
    flex: 1.5,
    padding: "10px",
    borderRadius: "10px",
    border: "none",
    background: "var(--success)",
    color: "#fff",
    fontSize: "0.85rem",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(16, 185, 129, 0.2)",
  },
  summaryModal: {
    width: "500px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
  },
  summaryModalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    paddingBottom: "14px",
    marginBottom: "16px",
  },
  closeModalBtn: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
  },
  summaryContent: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: "10px",
    padding: "16px",
    maxHeight: "300px",
    overflowY: "auto",
  },
};
