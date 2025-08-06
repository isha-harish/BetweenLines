import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { FaMicrophone, FaCircle } from "react-icons/fa";

function App() {
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [label, setLabel] = useState("");
  const [transcription, setTranscription] = useState("");
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  const startRecording = async () => {
    setLabel("");
    setTranscription("");
    setRecording(true);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    setMediaRecorder(recorder);
    audioChunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");

      try {
        const res = await axios.post("http://localhost:8000/predict", formData);
        setLabel(res.data.label);
        setTranscription(res.data.transcription);
      } catch (err) {
        console.error("Prediction failed", err);
      }
    };

    recorder.start();

    // Visualizer
    audioContextRef.current = new (window.AudioContext ||
      window.webkitAudioContext)();
    analyserRef.current = audioContextRef.current.createAnalyser();
    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current);
    drawWaveform();
  };

  const stopRecording = () => {
    setRecording(false);
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    analyserRef.current.fftSize = 2048;
    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#FF4081"; // Pink background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000"; // Black waveform
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>☘️ BetweenLines </h2>

      <div style={styles.controls}>
        <button
          onClick={startRecording}
          disabled={recording}
          style={{ ...styles.iconButton, opacity: recording ? 0.5 : 1 }}
        >
          <FaMicrophone size={32} />
        </button>

        <button
          onClick={stopRecording}
          disabled={!recording}
          style={{ ...styles.iconButton, opacity: recording ? 1 : 0.5 }}
        >
          <FaCircle size={32} color="red" />
        </button>
      </div>

      <canvas ref={canvasRef} width={600} height={100} style={styles.canvas} />

      {label && (
        <div style={styles.result}>
          <h3>Emotion detected: {label}</h3>
          <p>
            <strong>Transcription:</strong> {transcription}
          </p>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 20,
    fontFamily: "sans-serif",
    textAlign: "center",
  },
  title: {
    marginBottom: 30,
  },
  controls: {
    display: "flex",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  iconButton: {
    border: "none",
    background: "none",
    padding: 10,
    borderRadius: "50%",
    cursor: "pointer",
  },
  canvas: {
    backgroundColor: "#FF4081",
    borderRadius: 8,
    margin: "0 auto",
    display: "block",
  },
  result: {
    marginTop: 30,
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 10,
  },
};

export default App;
