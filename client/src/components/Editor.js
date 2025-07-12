import React, { useEffect, useRef } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import { ACTIONS } from "../Actions";

function Editor({ socketRef, roomId, onCodeChange }) {
  const editorRef = useRef(null);

  // Initialize CodeMirror editor
  useEffect(() => {
    const editor = CodeMirror.fromTextArea(
      document.getElementById("realtimeEditor"),
      {
        mode: { name: "javascript", json: true },
        theme: "dracula",
        autoCloseTags: true,
        autoCloseBrackets: true,
        lineNumbers: true,
      }
    );
    editorRef.current = editor;
    editor.setSize(null, "100%");

    // Handle local changes and emit to server
    const handleChange = (instance, changes) => {
      const { origin } = changes;
      const code = instance.getValue();
      onCodeChange(code);
      if (origin !== "setValue" && socketRef.current) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code,
        });
      }
    };

    editor.on("change", handleChange);

    // Cleanup on unmount
    return () => {
      editor.off("change", handleChange);
      editor.toTextArea();
    };
  }, [onCodeChange, roomId, socketRef]);

  // Listen for code changes from server
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleRemoteCodeChange = ({ code }) => {
      if (code !== null && editorRef.current) {
        // Prevent infinite loop by only setting if different
        if (editorRef.current.getValue() !== code) {
          editorRef.current.setValue(code);
        }
      }
    };

    socket.on(ACTIONS.CODE_CHANGE, handleRemoteCodeChange);

    return () => {
      socket.off(ACTIONS.CODE_CHANGE, handleRemoteCodeChange);
    };
  }, [socketRef]);

  return (
    <div style={{ height: "600px" }}>
      <textarea id="realtimeEditor"></textarea>
    </div>
  );
}

export default Editor;
