import React, { useEffect, useRef, useState, useCallback } from "react";
import Client from "./Client";
import Editor from "./Editor";
import { initSocket } from "../Socket";
import { ACTIONS } from "../Actions";
import {
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";
import Chat from "./Chat";

// List of supported languages
const LANGUAGES = [
  "python3", "java", "cpp", "nodejs", "c", "ruby", "go", "scala", "bash",
  "sql", "pascal", "csharp", "php", "swift", "rust", "r",
];

function EditorPage() {
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");
  const [isCompileWindowOpen, setIsCompileWindowOpen] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("python3");
  const codeRef = useRef(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();

  // Always get username from localStorage as fallback
  const username = location.state?.username || localStorage.getItem("username");

  const socketRef = useRef(null);

  // Memoized code change handler
  const onCodeChange = useCallback((code) => {
    codeRef.current = code;
  }, []);

  useEffect(() => {
    // If username is missing, redirect to login/home
    if (!username || typeof username !== "string" || !username.trim()) {
      toast.error("Username not found. Please login again.");
      navigate("/login");
      return;
    }

    let socketInstance;

    const handleErrors = (err) => {
      console.error("Socket error:", err);
      toast.error("Socket connection failed, Try again later");
      navigate("/");
    };

    const init = async () => {
      socketInstance = await initSocket();
      socketRef.current = socketInstance;

      socketInstance.on("connect_error", handleErrors);
      socketInstance.on("connect_failed", handleErrors);

      // Only emit join if username is valid
      socketInstance.emit(ACTIONS.JOIN, {
        roomId,
        username,
      });

      socketInstance.on(
        ACTIONS.JOINED,
        ({ clients, username: joinedUsername, socketId }) => {
          if (joinedUsername !== username) {
            toast.success(`${joinedUsername} joined the room.`);
          }
          // Only show clients with valid usernames
          setClients(clients.filter(c => c.username && c.username.trim()));
          // Sync code to new user
          socketInstance.emit(ACTIONS.SYNC_CODE, {
            code: codeRef.current,
            socketId,
          });
        }
      );

      socketInstance.on(ACTIONS.DISCONNECTED, ({ socketId, username: leftUsername }) => {
        toast.success(`${leftUsername} left the room`);
        setClients((prev) => prev.filter((client) => client.socketId !== socketId));
      });
    };

    init();

    return () => {
      if (socketInstance) {
        socketInstance.off(ACTIONS.JOINED);
        socketInstance.off(ACTIONS.DISCONNECTED);
        socketInstance.disconnect();
      }
    };
  }, [roomId, username, navigate]);

  // Defensive: if username is missing, redirect
  if (!username || typeof username !== "string" || !username.trim()) {
    return <Navigate to="/login" />;
  }

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success(`Room ID is copied`);
    } catch (error) {
      console.error(error);
      toast.error("Unable to copy the room ID");
    }
  };

  const leaveRoom = () => {
    navigate("/");
  };

  const runCode = async () => {
    setIsCompiling(true);
    try {
      const response = await axios.post("http://localhost:5000/compile", {
        code: codeRef.current,
        language: selectedLanguage,
      });
      setOutput(response.data.output || JSON.stringify(response.data));
    } catch (error) {
      console.error("Error compiling code:", error);
      setOutput(error.response?.data?.error || "An error occurred");
    } finally {
      setIsCompiling(false);
    }
  };

  const toggleCompileWindow = () => {
    setIsCompileWindowOpen((prev) => !prev);
  };

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-grow-1">
        {/* Client panel */}
        <div className="col-md-2 bg-dark text-light d-flex flex-column">
        <div className="d-flex align-items-center justify-content-center mt-3 mb-2">
    <img
      src="/images/mylogo.png"
      alt="CodeCollab Logo"
      className="img-fluid"
      style={{ maxWidth: "40px", marginRight: "10px" }}
    />
    <h3 className="text-primary m-0" style={{ fontWeight: "bold", letterSpacing: "1px" }}>
      CodeCollab
    </h3>
  </div>
  <hr style={{ marginTop: "rem" }} />

          {/* Client list container */}
          <div className="d-flex flex-column flex-grow-1 overflow-auto">
            <span className="mb-2">Members</span>
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
            {/* Room actions */}
            <div className="mt-3">
              <button className="btn btn-success w-100 mb-2" onClick={copyRoomId}>
                Copy Room ID
              </button>
              <button className="btn btn-danger w-100" onClick={leaveRoom}>
                Leave Room
              </button>
            </div>
          </div>
        </div>

        {/* Editor and Chat panel */}
        <div className="col-md-10 text-light d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
          {/* Language selector */}
          <div className="bg-dark p-2 d-flex justify-content-end">
            <select
              className="form-select w-auto"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
            <Editor
              socketRef={socketRef}
              roomId={roomId}
              onCodeChange={onCodeChange}
            />
            {/* Compiler toggle button */}
            <button
              className="btn btn-primary open-compiler-btn"
              onClick={toggleCompileWindow}
            >
              {isCompileWindowOpen ? "Close Compiler" : "Open Compiler"}
            </button>
          </div>
          <div className="mt-3" style={{ flexShrink: 0 }}>
            <Chat roomId={roomId} username={username} socket={socketRef.current}/>
          </div>
        </div>
      </div>

      {/* Compiler section */}
      <div
        className={`bg-dark text-light p-3 ${isCompileWindowOpen ? "d-block" : "d-none"}`}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: isCompileWindowOpen ? "30vh" : "0",
          transition: "height 0.3s ease-in-out",
          overflowY: "auto",
          zIndex: 1040,
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="m-0">Compiler Output ({selectedLanguage})</h5>
          <div>
            <button
              className="btn btn-success me-2"
              onClick={runCode}
              disabled={isCompiling}
            >
              {isCompiling ? "Compiling..." : "Run Code"}
            </button>
            <button className="btn btn-secondary" onClick={toggleCompileWindow}>
              Close
            </button>
          </div>
        </div>
        <pre className="bg-secondary p-3 rounded">
          {output || "Output will appear here after compilation"}
        </pre>
      </div>
    </div>
  );
}

export default EditorPage;
