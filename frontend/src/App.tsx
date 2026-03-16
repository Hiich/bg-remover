import { useState, useCallback, useRef } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type Stage =
  | { kind: "idle" }
  | { kind: "cropping"; src: string; file: File }
  | { kind: "loading" }
  | { kind: "done"; original: string; result: string; filename: string }
  | { kind: "error"; message: string };

function getCroppedBlob(image: HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas is empty"));
    }, "image/png");
  });
}

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);

  const startWithFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setStage({ kind: "error", message: "Please upload an image file." });
      return;
    }
    const src = URL.createObjectURL(file);
    setStage({ kind: "cropping", src, file });
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, []);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, width / height, width, height),
      width,
      height
    );
    setCrop(initial);
    setCompletedCrop(initial);
  }, []);

  const processImage = useCallback(async () => {
    if (stage.kind !== "cropping") return;

    setStage({ kind: "loading" });

    try {
      let fileToSend: File | Blob = stage.file;

      if (completedCrop && imgRef.current) {
        const blob = await getCroppedBlob(imgRef.current, completedCrop);
        fileToSend = blob;
      }

      const original = URL.createObjectURL(fileToSend);
      const form = new FormData();
      form.append("file", fileToSend, stage.file.name);

      const res = await fetch("/api/remove-bg", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const result = URL.createObjectURL(await res.blob());
      const filename = stage.file.name.replace(/\.[^.]+$/, "") + "-nobg.png";

      setStage({ kind: "done", original, result, filename });
    } catch (e: any) {
      setStage({ kind: "error", message: e.message });
    }
  }, [stage, completedCrop]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) startWithFile(file);
    },
    [startWithFile]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) startWithFile(file);
      e.target.value = "";
    },
    [startWithFile]
  );

  const reset = () => {
    setStage({ kind: "idle" });
    setCrop(undefined);
    setCompletedCrop(undefined);
  };

  return (
    <div className="app">
      <header>
        <h1>✂️ Background Remover</h1>
        <p>Drop an image, crop if needed, get it back transparent.</p>
      </header>

      <main>
        {(stage.kind === "idle" || stage.kind === "error") && (
          <label
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input type="file" accept="image/*" onChange={handleInput} hidden />
            {stage.kind === "error" ? (
              <div className="error">⚠️ {stage.message}<br /><span>Click to try again</span></div>
            ) : (
              <div className="prompt">
                <span className="icon">🖼️</span>
                <span>Drop image here or click to upload</span>
              </div>
            )}
          </label>
        )}

        {stage.kind === "loading" && (
          <div className="dropzone">
            <div className="spinner">Processing...</div>
          </div>
        )}

        {stage.kind === "cropping" && (
          <div className="crop-stage">
            <div className="crop-hint">Drag to adjust crop — or skip to use the full image</div>
            <div className="crop-wrapper">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                minWidth={10}
                minHeight={10}
              >
                <img
                  ref={imgRef}
                  src={stage.src}
                  onLoad={onImageLoad}
                  alt="crop preview"
                  className="crop-img"
                />
              </ReactCrop>
            </div>
            <div className="crop-actions">
              <button className="btn-primary" onClick={processImage}>
                Remove Background →
              </button>
              <button className="btn-reset" onClick={reset}>Cancel</button>
            </div>
          </div>
        )}

        {stage.kind === "done" && (
          <div className="results">
            <div className="images">
              <div className="image-card">
                <span className="label">Original</span>
                <img src={stage.original} alt="original" />
              </div>
              <div className="image-card checker">
                <span className="label">No background</span>
                <img src={stage.result} alt="result" />
              </div>
            </div>
            <div className="actions">
              <a href={stage.result} download={stage.filename} className="btn-download">
                ⬇️ Download PNG
              </a>
              <button className="btn-reset" onClick={reset}>
                Upload another
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
