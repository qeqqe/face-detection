const video = document.getElementById("video");
const loadingElement = document.getElementById("loading");
const debugElement = document.getElementById("debug");

function updateDebug(message) {
  debugElement.textContent = message;
  console.log(message);
}

async function loadModel(modelName, model) {
  updateDebug(`Loading ${modelName}...`);
  loadingElement.innerHTML = `Loading ${modelName}...<br><small>Please wait</small>`;
  await model.loadFromUri("./models");
  updateDebug(`${modelName} loaded successfully`);
}

async function setupFaceDetection() {
  try {
    // Load models one by one to better track progress
    await loadModel("Face Detector", faceapi.nets.tinyFaceDetector);
    await loadModel("Landmark Detection", faceapi.nets.faceLandmark68Net);
    await loadModel("Recognition Model", faceapi.nets.faceRecognitionNet);
    await loadModel("Expression Model", faceapi.nets.faceExpressionNet);

    updateDebug("All models loaded, starting video...");
    loadingElement.textContent = "Starting camera...";
    await startVideo();
    loadingElement.style.display = "none";
    updateDebug("System ready - if you don't see boxes, try moving your face");
  } catch (error) {
    const errorMessage = `Error: ${error.message}`;
    updateDebug(errorMessage);
    loadingElement.innerHTML = `${errorMessage}<br>
            Please check:<br>
            1. You have the /models folder in the same directory as your HTML file<br>
            2. Your browser supports WebGL<br>
            3. You're using HTTPS or localhost`;
    loadingElement.classList.add("error");
    throw error;
  }
}

function startVideo() {
  return new Promise((resolve, reject) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      reject(new Error("Camera API is not available"));
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 720 },
          height: { ideal: 560 },
          facingMode: "user",
        },
      })
      .then((stream) => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      })
      .catch((err) => {
        reject(new Error(`Camera access denied: ${err.message}`));
      });
  });
}

video.addEventListener("play", () => {
  const canvas = faceapi.createCanvasFromMedia(video);
  document.querySelector(".container").append(canvas);

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  let frameCount = 0;
  setInterval(async () => {
    try {
      frameCount++;
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      // Log every 100 frames if no face is detected
      if (detections.length === 0 && frameCount % 100 === 0) {
        updateDebug("No faces detected - try moving or adjusting lighting");
      } else if (detections.length > 0) {
        updateDebug(`Detected ${detections.length} face(s)`);
      }

      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Make detection boxes more visible
      faceapi.draw.drawDetections(canvas, resizedDetections, {
        boxColor: "#00ff00",
        lineWidth: 2,
      });
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetections, {
        drawLines: true,
        color: "#00ff00",
        lineWidth: 2,
      });
      faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
    } catch (error) {
      console.error("Detection error:", error);
      updateDebug(`Detection error: ${error.message}`);
    }
  }, 100);
});

setupFaceDetection().catch(console.error);
