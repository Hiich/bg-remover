import { useState, useCallback } from "react";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; original: string; result: string; filename: string }
  | { kind: "error"; message: string };

export default function App() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({ kind: "error", message: "Please upload an image file." });
      return;
    }

    const original = URL.createObjectURL(file);
    setState({ kind: "loading" });

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/remove-bg", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const blob = await res.blob();
      const result = URL.createObjectURL(blob);
      const filename = file.name.replace(/\.[^.]+$/, "") + "-nobg.png";

      setState({ kind: "done", original, result, filename });
    } catch (e: any) {
      setState({ kind: "error", message: e.message });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div className="app">
      <header>
        <h1>✂️ Background Remover</h1>
        <p>Drop an image, get it back transparent.</p>
      </header>

      <main>
        {state.kind !== "done" && (
          <label
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input type="file" accept="image/*" onChange={handleInput} hidden />
            {state.kind === "loading" ? (
              <div className="spinner">Processing...</div>
            ) : state.kind === "error" ? (
              <div className="error">⚠️ {state.message}<br /><span>Click to try again</span></div>
            ) : (
              <div className="prompt">
                <span className="icon">🖼️</span>
                <span>Drop image here or click to upload</span>
              </div>
            )}
          </label>
        )}

        {state.kind === "done" && (
          <div className="results">
            <div className="images">
              <div className="image-card">
                <span className="label">Original</span>
                <img src={state.original} alt="original" />
              </div>
              <div className="image-card checker">
                <span className="label">No background</span>
                <img src={state.result} alt="result" />
              </div>
            </div>
            <div className="actions">
              <a href={state.result} download={state.filename} className="btn-download">
                ⬇️ Download PNG
              </a>
              <button
                className="btn-reset"
                onClick={() => setState({ kind: "idle" })}
              >
                Upload another
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
