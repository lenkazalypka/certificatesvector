"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

const SOURCE_WIDTH = 2480;
const SOURCE_HEIGHT = 3508;
const CERTIFICATE_WIDTH = 794;
const CERTIFICATE_HEIGHT = 1123;

const FIO_FIELD = {
  sourceLeft: 478,
  sourceTop: 1656,
  sourceWidth: 1525,
  sourceFontSize: 76,
};

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

function fromSource(value: number) {
  return (value / SOURCE_WIDTH) * CERTIFICATE_WIDTH;
}

function fromSourceY(value: number) {
  return (value / SOURCE_HEIGHT) * CERTIFICATE_HEIGHT;
}

function fioStyle(): CSSProperties {
  return {
    top: fromSourceY(FIO_FIELD.sourceTop),
    left: fromSource(FIO_FIELD.sourceLeft),
    width: fromSource(FIO_FIELD.sourceWidth),
    fontSize: fromSource(FIO_FIELD.sourceFontSize),
    lineHeight: 1.08,
    fontWeight: 700,
    color: "#071d49",
    textAlign: "center",
    letterSpacing: "0",
  };
}

function isAppleMobile() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function openMobileDownloadWindow() {
  if (!isAppleMobile()) return null;

  const fileWindow = window.open("", "_blank");
  if (!fileWindow) return null;

  fileWindow.document.title = "Файл готовится";
  fileWindow.document.body.innerHTML =
    '<div style="font-family:Arial,sans-serif;padding:24px;line-height:1.5;color:#111">Готовим файл...</div>';

  return fileWindow;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Canvas export failed"));
    }, type);
  });
}

async function createCertificateCanvas(fio: string) {
  const canvas = document.createElement("canvas");
  canvas.width = SOURCE_WIDTH;
  canvas.height = SOURCE_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const background = await loadImage("/certificates/participant.png");
  ctx.drawImage(background, 0, 0, SOURCE_WIDTH, SOURCE_HEIGHT);

  const name = fio.trim();
  if (name) {
    let fontSize = FIO_FIELD.sourceFontSize;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#071d49";

    do {
      ctx.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
      if (ctx.measureText(name).width <= FIO_FIELD.sourceWidth - 48 || fontSize <= 48) break;
      fontSize -= 2;
    } while (fontSize > 48);

    ctx.fillText(
      name,
      FIO_FIELD.sourceLeft + FIO_FIELD.sourceWidth / 2,
      FIO_FIELD.sourceTop,
      FIO_FIELD.sourceWidth,
    );
  }

  return canvas;
}

async function deliverFile(blob: Blob, fileName: string, mobileWindow: Window | null) {
  const file =
    typeof File === "undefined" ? null : new File([blob], fileName, { type: blob.type });
  const shareNavigator = navigator as ShareNavigator;
  const canShareFile = (() => {
    if (!isAppleMobile() || !file || !navigator.share) return false;
    if (!shareNavigator.canShare) return true;

    try {
      return shareNavigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  })();

  if (file && canShareFile) {
    try {
      await navigator.share({ files: [file], title: fileName });
      mobileWindow?.close();
      return;
    } catch {
      // iOS can reject share after async rendering; fall back to opening the file.
    }
  }

  const url = URL.createObjectURL(blob);

  if (mobileWindow && !mobileWindow.closed) {
    mobileWindow.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function CertificateGenerator() {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [fio, setFio] = useState("Иванова Мария Сергеевна");
  const [previewScale, setPreviewScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  const safeName = useMemo(
    () => fio.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "certificate",
    [fio],
  );

  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;

    const updateScale = () => {
      const availableWidth = container.clientWidth;
      setPreviewScale(Math.min(1, availableWidth / CERTIFICATE_WIDTH));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const handlePngExport = async () => {
    const mobileWindow = openMobileDownloadWindow();

    setError("");
    setIsExporting(true);

    try {
      const canvas = await createCertificateCanvas(fio);
      const blob = await canvasToBlob(canvas, "image/png");
      await deliverFile(blob, `${safeName}.png`, mobileWindow);
    } catch {
      mobileWindow?.close();
      setError("Не удалось подготовить PNG. Проверьте, что шаблон загрузился.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfExport = async () => {
    const mobileWindow = openMobileDownloadWindow();

    setError("");
    setIsExporting(true);

    try {
      const canvas = await createCertificateCanvas(fio);
      const dataUrl = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297);
      const blob = pdf.output("blob");
      await deliverFile(blob, `${safeName}.pdf`, mobileWindow);
    } catch {
      mobileWindow?.close();
      setError("Не удалось подготовить PDF. Попробуйте повторить экспорт.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-lg border border-stone-300/70 bg-white/85 p-5 shadow-sheet backdrop-blur sm:p-6 lg:sticky lg:top-6 lg:self-start">
          <div className="mb-6 border-b border-stone-200 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              Вектор будущего
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Сертификат участника
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Введите ФИО участника и скачайте готовый сертификат. Остальной текст уже находится в
              шаблоне.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-800">ФИО</span>
              <input
                value={fio}
                onChange={(event) => setFio(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/10"
                placeholder="Иванова Мария Сергеевна"
              />
            </label>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handlePngExport}
                disabled={isExporting}
                className="h-11 rounded-md bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
              >
                Скачать PNG
              </button>
              <button
                type="button"
                onClick={handlePdfExport}
                disabled={isExporting}
                className="h-11 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 active:translate-y-px disabled:cursor-wait disabled:opacity-60"
              >
                Скачать PDF
              </button>
            </div>
          </div>
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
                Live preview
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ink">Один шаблон для участников</h2>
            </div>
            <p className="hidden text-sm text-stone-600 sm:block">A4, 300 DPI</p>
          </div>

          <div
            ref={previewContainerRef}
            className="overflow-auto rounded-lg border border-stone-300/70 bg-stone-100/80 p-3 shadow-sheet sm:p-5"
          >
            <div
              className="certificate-scale mx-auto"
              style={{
                width: CERTIFICATE_WIDTH * previewScale,
                height: CERTIFICATE_HEIGHT * previewScale,
              }}
            >
              <div
                style={{
                  width: CERTIFICATE_WIDTH,
                  height: CERTIFICATE_HEIGHT,
                  transform: `scale(${previewScale})`,
                  transformOrigin: "top left",
                }}
              >
                <div
                  className="certificate-stage relative overflow-hidden bg-white font-certificate shadow-[0_18px_60px_-30px_rgba(38,33,27,0.7)]"
                  style={{
                    width: CERTIFICATE_WIDTH,
                    height: CERTIFICATE_HEIGHT,
                  }}
                >
                  <img
                    src="/certificates/participant.png"
                    className="absolute inset-0 h-full w-full object-cover"
                    alt=""
                    draggable={false}
                  />

                  <div
                    data-testid="fio-layer"
                    className="absolute whitespace-pre-line break-words"
                    style={fioStyle()}
                  >
                    {fio}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
