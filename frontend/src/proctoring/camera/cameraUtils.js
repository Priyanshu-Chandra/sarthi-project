export const requestCameraStream = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });

    return stream;
  } catch (error) {
    throw new Error("Camera access denied");
  }
};
