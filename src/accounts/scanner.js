export async function startScanner(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {facingMode: {ideal: 'environment'}},
    audio: false,
  });
  let timer;
  let active = true;
  const stop = () => {
    active = false;
    clearTimeout(timer);
    stream.getTracks().forEach(track => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  try {
    video.srcObject = stream;
    await video.play();
    const {default: decode} = await import('jsqr');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) throw Error('Camera canvas unavailable');
    function scan() {
      if (!active || !video.isConnected) { stop(); return; }
      if (video.videoWidth && video.videoHeight) {
        const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = decode(frame.data, frame.width, frame.height, {inversionAttempts: 'dontInvert'});
        if (/^[a-f0-9]{64}$/.test(result?.data || '')) {
          stop();
          onCode(result.data);
          return;
        }
      }
      timer = setTimeout(scan, 170);
    }
    timer = setTimeout(scan, 170);
    return stop;
  } catch (error) {
    stop();
    throw error;
  }
}
