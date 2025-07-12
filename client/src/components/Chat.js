import React, { useState, useEffect, useRef } from "react";

export default function Chat({ roomId, username, socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    // Join the chat room
    socket.emit("JOIN_ROOM", { roomId, username });

    // Listen for incoming messages
    socket.on("chat-message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Only emit LEAVE_ROOM on actual page unload
    const handleBeforeUnload = () => {
      socket.emit("LEAVE_ROOM", { roomId, username });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      socket.off("chat-message");
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [roomId, username, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (input.trim() && socket) {
      socket.emit("chat-message", {
        roomId,
        username,
        message: input,
        timestamp: Date.now(),
      });
      setInput("");
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <strong style={{ color: "#ffd700" }}>{msg.username}:</strong>{" "}
            <span style={{ color: "#f8f9fa" }}>{msg.message}</span>
            <span style={{ fontSize: "0.75em", color: "#bbb", marginLeft: 8 }}>
              {msg.timestamp && new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="d-flex mt-2" style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: "100%",
        background: "#23272f",
        padding: "10px"
      }}>
        <input
          className="form-control"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          style={{ background: "#2c2f36", color: "#f8f9fa", border: "1px solid #495057", borderRadius: "4px" }}
        />
        <button
          className="btn btn-success chat-send-btn"
          type="submit"
          style={{ minWidth: 70, marginLeft: 10 }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
