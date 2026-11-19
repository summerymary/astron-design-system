import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Camera, CameraOff, RotateCcw, UserRound } from 'lucide-react';
import { Button } from './ui';
import { cameraError, createCameraSession, portraitDataUrl } from '../lib/client-photo';

export function ClientPhotoField({
  value,
  onChange,
  onBusyChange,
  fallback,
  hasExistingPhoto = false,
  showHeading = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onBusyChange?: (busy: boolean) => void;
  fallback?: ReactNode;
  hasExistingPhoto?: boolean;
  showHeading?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const session = useRef(createCameraSession());
  const mounted = useRef(true);
  const request = useRef(0);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    mounted.current = true;
    const camera = session.current;
    const stopWhenHidden = () => {
      if (!document.hidden) return;
      request.current++;
      camera.stop();
      if (video.current) video.current.srcObject = null;
      setActive(false);
      setReady(false);
      setLoading(false);
    };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      mounted.current = false;
      request.current++;
      camera.stop();
      document.removeEventListener('visibilitychange', stopWhenHidden);
    };
  }, []);
  useEffect(() => onBusyChange?.(active || loading), [active, loading, onBusyChange]);
  const stop = () => {
    request.current++;
    session.current.stop();
    if (video.current) video.current.srcObject = null;
    setActive(false);
    setReady(false);
    setLoading(false);
  };
  const start = async () => {
    const id = ++request.current;
    setError('');
    setReady(false);
    setLoading(true);
    try {
      const stream = await session.current.start(navigator.mediaDevices);
      if (!stream || !mounted.current || request.current !== id) return;
      const player = video.current;
      if (!player) {
        session.current.stop();
        return;
      }
      player.srcObject = stream;
      setActive(true);
      await player.play();
      if (mounted.current && request.current === id) setReady(player.videoWidth > 0);
    } catch (problem) {
      if (mounted.current && request.current === id) {
        stop();
        setError(cameraError(problem));
      }
    } finally {
      if (mounted.current && request.current === id) setLoading(false);
    }
  };
  const capture = () => {
    const player = video.current;
    if (!player || !ready) return;
    try {
      const image = portraitDataUrl(player, player.videoWidth, player.videoHeight);
      stop();
      onChange(image);
    } catch {
      setError('Дождитесь изображения с камеры и попробуйте снова.');
    }
  };
  return (
    <section className="client-photo-field" data-ui="client-photo" aria-label="Фото клиента">
      {showHeading && <h3>Фото клиента</h3>}
      <div className="client-photo-preview">
        <video
          ref={video}
          hidden={!active}
          muted
          playsInline
          autoPlay
          aria-label="Изображение с камеры"
          onCanPlay={() => setReady(!!video.current?.videoWidth)}
        />
        {!active &&
          (value ? (
            <img src={value} alt="Фото клиента" />
          ) : (
            fallback || <UserRound size={72} aria-hidden="true" />
          ))}
      </div>
      <div className="client-photo-controls">
        {active ? (
          <>
            <Button onClick={capture} disabled={!ready || loading}>
              <Camera size={20} /> Сделать снимок
            </Button>
            <Button variant="secondary" onClick={stop}>
              <CameraOff size={18} /> Выключить камеру
            </Button>
          </>
        ) : (
          <>
            <Button variant="accent" onClick={start} disabled={loading}>
              {value || hasExistingPhoto ? <RotateCcw size={18} /> : <Camera size={20} />}
              {loading
                ? 'Включаем камеру…'
                : value || hasExistingPhoto
                  ? 'Переснять'
                  : 'Сфотографировать'}
            </Button>
            {loading && (
              <Button variant="secondary" onClick={stop}>
                Отменить включение
              </Button>
            )}
          </>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="client-photo-hint">
        {active
          ? 'Сделайте снимок или выключите камеру, чтобы продолжить.'
          : 'Фото необязательно. Камера включается только по кнопке. После снимка можно переснять.'}
      </p>
    </section>
  );
}
