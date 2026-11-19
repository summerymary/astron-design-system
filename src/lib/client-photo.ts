export function portraitCrop(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('Изображение пока не готово.');
  const side = Math.min(width, height);
  return { x: (width - side) / 2, y: (height - side) / 2, side };
}

export function portraitDataUrl(source: CanvasImageSource, width: number, height: number) {
  const crop = portraitCrop(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить фотографию.');
  context.drawImage(source, crop.x, crop.y, crop.side, crop.side, 0, 0, 512, 512);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export function createCameraSession() {
  let current: MediaStream | null = null;
  let generation = 0;
  const release = (stream: MediaStream | null) =>
    stream?.getTracks().forEach((track) => track.stop());
  const stop = () => {
    generation++;
    release(current);
    current = null;
  };
  return {
    stop,
    async start(devices: Pick<MediaDevices, 'getUserMedia'> | undefined) {
      stop();
      if (!devices)
        throw new Error(
          'Камера недоступна в этом браузере. Попробуйте браузер с поддержкой камеры.',
        );
      const request = generation;
      const stream = await devices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1024 }, height: { ideal: 1024 } },
        audio: false,
      });
      if (request !== generation) {
        release(stream);
        return null;
      }
      current = stream;
      return stream;
    },
  };
}

export function cameraError(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Доступ к камере не разрешён. Разрешите его в настройках браузера и попробуйте снова.';
  if (name === 'NotFoundError') return 'Камера не найдена. Подключите её и попробуйте снова.';
  if (name === 'NotReadableError')
    return 'Камера занята. Закройте использующее её приложение и попробуйте снова.';
  return 'Не удалось включить камеру. Проверьте её подключение и попробуйте снова.';
}
