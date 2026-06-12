"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";

const CERTIFICATE_WIDTH = 794;
const CERTIFICATE_HEIGHT = 1123;
const FIO_NUDGE_STORAGE_KEY = "certificate-fio-nudges-v1";

type FioField = {
  sourceLeft: number;
  sourceTop: number;
  sourceWidth: number;
  sourceFontSize: number;
};

type CertificateTemplate = {
  id: string;
  title: string;
  group: "participant" | "camp";
  background: string;
  sourceWidth: number;
  sourceHeight: number;
  fio: FioField;
};

type ShareNavigator = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

type PreparedFile = {
  blob: Blob;
  fileName: string;
  label: string;
  url: string;
};

const PARTICIPANT_FIO: FioField = {
  sourceLeft: 478,
  sourceTop: 1656,
  sourceWidth: 1525,
  sourceFontSize: 72,
};

const CAMP_FIO: FioField = {
  sourceLeft: 422,
  sourceTop: 1644,
  sourceWidth: 1640,
  sourceFontSize: 72,
};

const makeCampFio = (sourceTop: number): FioField => ({
  ...CAMP_FIO,
  sourceTop,
});

const CAMP_TEMPLATES: Array<{ id: string; title: string; file: string; fio?: FioField }> = [
  { id: "vnimatelnyy", title: "Самый внимательный", file: "vnimatelnyy.png", fio: makeCampFio(1608) },
  { id: "komandnyy", title: "Самый дружный", file: "druzhnyy.png", fio: makeCampFio(1608) },
  { id: "tvorcheskiy", title: "Самый творческий", file: "tvorcheskiy.png", fio: makeCampFio(1608) },
  { id: "druzhelyubnyy", title: "Самый дружелюбный", file: "druzhelyubnyy.png", fio: makeCampFio(1589) },
  { id: "aktivnyy", title: "Самый активный", file: "aktivnyy.png", fio: makeCampFio(1589) },
  { id: "zabavnyy", title: "Самый забавный", file: "zabavnyy.png", fio: makeCampFio(1589) },
  { id: "skromnyy", title: "Самый скромный", file: "skromnyy.png", fio: makeCampFio(1564) },
  { id: "kreativnyy", title: "Самый креативный", file: "kreativnyy.png", fio: makeCampFio(1599) },
  { id: "talantlivyy", title: "Самый талантливый", file: "talantlivyy.png", fio: makeCampFio(1614) },
  { id: "otvetstvennyy", title: "Самый ответственный", file: "otvetstvennyy.png", fio: makeCampFio(1599) },
  { id: "dobryy", title: "Самый добрый", file: "dobryy.png" },
  { id: "veselyy", title: "Самый веселый", file: "veselyy.png", fio: makeCampFio(1674) },
  { id: "lovkiy", title: "Самый ловкий", file: "lovkiy.png" },
  { id: "otzyvchivyy", title: "Самый отзывчивый", file: "otzyvchivyy.png", fio: makeCampFio(1614) },
  { id: "sportivnyy", title: "Самый спортивный", file: "sportivnyy.png", fio: makeCampFio(1689) },
  { id: "vezhlivyy", title: "Самый вежливый", file: "vezhlivyy.png" },
  { id: "lyuboznatelnyy", title: "Самый любознательный", file: "lyuboznatelnyy.png", fio: makeCampFio(1689) },
  { id: "obshchitelnyy", title: "Самый общительный", file: "obshchitelnyy.png", fio: makeCampFio(1660) },
  { id: "prikolnyy", title: "Самый прикольный", file: "prikolnyy.png" },
  { id: "muzykalnyy", title: "Самый музыкальный", file: "muzykalnyy.png", fio: makeCampFio(1660) },
];

const CERTIFICATES: CertificateTemplate[] = [
  {
    id: "participant",
    title: "Сертификат участника",
    group: "participant",
    background: "/certificates/participant.png",
    sourceWidth: 2480,
    sourceHeight: 3508,
    fio: PARTICIPANT_FIO,
  },
  ...CAMP_TEMPLATES.map((template) => ({
    id: `camp-${template.id}`,
    title: template.title,
    group: "camp" as const,
    background: `/certificates/camp/${template.file}`,
    sourceWidth: 2482,
    sourceHeight: 3508,
    fio: template.fio ?? CAMP_FIO,
  })),
];

function withNudge(template: CertificateTemplate, nudge: number): CertificateTemplate {
  return {
    ...template,
    fio: {
      ...template.fio,
      sourceTop: template.fio.sourceTop + nudge,
    },
  };
}

function fromSourceX(value: number, template: CertificateTemplate) {
  return (value / template.sourceWidth) * CERTIFICATE_WIDTH;
}

function fromSourceY(value: number, template: CertificateTemplate) {
  return (value / template.sourceHeight) * CERTIFICATE_HEIGHT;
}

function fioStyle(template: CertificateTemplate): CSSProperties {
  return {
    top: fromSourceY(template.fio.sourceTop, template),
    left: fromSourceX(template.fio.sourceLeft, template),
    width: fromSourceX(template.fio.sourceWidth, template),
    fontSize: fromSourceX(template.fio.sourceFontSize, template),
    lineHeight: 1.08,
    fontWeight: 700,
    color: "#071d49",
    textAlign: "center",
    letterSpacing: "0",
    whiteSpace: "nowrap",
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  };
}

function isAppleMobile() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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

async function createCertificateCanvas(fio: string, template: CertificateTemplate) {
  const canvas = document.createElement("canvas");
  canvas.width = template.sourceWidth;
  canvas.height = template.sourceHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const background = await loadImage(template.background);
  ctx.drawImage(background, 0, 0, template.sourceWidth, template.sourceHeight);

  const name = fio.trim();
  if (name) {
    let fontSize = template.fio.sourceFontSize;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#071d49";

    do {
      ctx.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
      if (ctx.measureText(name).width <= template.fio.sourceWidth - 48 || fontSize <= 44) break;
      fontSize -= 2;
    } while (fontSize > 44);

    ctx.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
    ctx.fillText(
      name,
      template.fio.sourceLeft + template.fio.sourceWidth / 2,
      template.fio.sourceTop,
      template.fio.sourceWidth,
    );
  }

  return canvas;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function shareBlob(blob: Blob, fileName: string) {
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

  if (!file || !canShareFile) throw new Error("Sharing is unavailable");

  await navigator.share({ files: [file], title: fileName });
}

function FioPreview({ fio, template }: { fio: string; template: CertificateTemplate }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    const containerWidth = container.offsetWidth;
    const textWidth = text.scrollWidth;
    setScale(textWidth > containerWidth ? containerWidth / textWidth : 1);
  }, [fio, template]);

  const style = fioStyle(template);

  return (
    <div
      ref={containerRef}
      data-testid="fio-layer"
      className="absolute overflow-hidden"
      style={{
        top: style.top,
        left: style.left,
        width: style.width,
        height: (style.fontSize as number) * 1.2,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <span
        ref={textRef}
        style={{
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          color: style.color,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
          whiteSpace: "nowrap",
          transformOrigin: "center top",
          transform: `scaleX(${scale})`,
          display: "inline-block",
        }}
      >
        {fio}
      </span>
    </div>
  );
}

export default function CertificateGenerator() {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(CERTIFICATES[0].id);
  const [fio, setFio] = useState("Иванова Мария Сергеевна");
  const [previewScale, setPreviewScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");
  const [preparedFile, setPreparedFile] = useState<PreparedFile | null>(null);
  const [fioNudges, setFioNudges] = useState<Record<string, number>>({});

  const baseTemplate = CERTIFICATES.find((template) => template.id === selectedId) ?? CERTIFICATES[0];
  const selectedNudge = fioNudges[selectedId] ?? 0;
  const selectedTemplate = useMemo(
    () => withNudge(baseTemplate, selectedNudge),
    [baseTemplate, selectedNudge],
  );

  const safeName = useMemo(
    () =>
      [selectedTemplate.id, fio.trim()]
        .join("-")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "") || "certificate",
    [fio, selectedTemplate.id],
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(FIO_NUDGE_STORAGE_KEY);
      if (saved) setFioNudges(JSON.parse(saved) as Record<string, number>);
    } catch {
      setFioNudges({});
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FIO_NUDGE_STORAGE_KEY, JSON.stringify(fioNudges));
    } catch {
      // Local storage can be blocked in private mode. Preview and export still work.
    }
  }, [fioNudges]);

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

  useEffect(() => {
    return () => {
      if (preparedFile) URL.revokeObjectURL(preparedFile.url);
    };
  }, [preparedFile]);

  const clearPreparedFile = () => {
    setPreparedFile((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  };

  const updateFioNudge = (delta: number) => {
    setFioNudges((current) => ({
      ...current,
      [selectedId]: Math.max(-160, Math.min(160, (current[selectedId] ?? 0) + delta)),
    }));
    clearPreparedFile();
    setError("");
  };

  const resetFioNudge = () => {
    setFioNudges((current) => {
      const next = { ...current };
      delete next[selectedId];
      return next;
    });
    clearPreparedFile();
    setError("");
  };

  const deliverGeneratedFile = (blob: Blob, fileName: string, label: string) => {
    clearPreparedFile();

    if (!isAppleMobile()) {
      downloadBlob(blob, fileName);
      return;
    }

    setPreparedFile({
      blob,
      fileName,
      label,
      url: URL.createObjectURL(blob),
    });
  };

  const handlePngExport = async () => {
    setError("");
    setIsExporting(true);

    try {
      const canvas = await createCertificateCanvas(fio, selectedTemplate);
      const blob = await canvasToBlob(canvas, "image/png");
      deliverGeneratedFile(blob, `${safeName}.png`, "PNG готов");
    } catch {
      setError("Не удалось подготовить PNG. Проверьте, что шаблон загрузился.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfExport = async () => {
    setError("");
    setIsExporting(true);

    try {
      const canvas = await createCertificateCanvas(fio, selectedTemplate);
      const dataUrl = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297);
      const blob = pdf.output("blob");
      deliverGeneratedFile(blob, `${safeName}.pdf`, "PDF готов");
    } catch {
      setError("Не удалось подготовить PDF. Попробуйте повторить экспорт.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreparedShare = async () => {
    if (!preparedFile) return;

    setError("");

    try {
      await shareBlob(preparedFile.blob, preparedFile.fileName);
    } catch {
      setError("Не удалось открыть меню «Поделиться». Нажмите «Открыть файл».");
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
              Генератор сертификатов
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Выберите шаблон, введите ФИО участника, подгоните строку при необходимости и скачайте готовый файл.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-800">Шаблон</span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  clearPreparedFile();
                  setError("");
                }}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/10"
              >
                <option value="participant">Сертификат участника</option>
                <optgroup label="Future Leaders Camp">
                  {CERTIFICATES.filter((template) => template.group === "camp").map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-800">ФИО</span>
              <input
                value={fio}
                onChange={(event) => setFio(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/10"
                placeholder="Иванова Мария Сергеевна"
              />
            </label>

            <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-stone-900">Подгонка ФИО</span>
                <span className="text-xs text-stone-500">{selectedNudge > 0 ? `+${selectedNudge}` : selectedNudge}px</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => updateFioNudge(-4)}
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 transition active:translate-y-px"
                >
                  выше
                </button>
                <button
                  type="button"
                  onClick={() => updateFioNudge(4)}
                  className="h-10 rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 transition active:translate-y-px"
                >
                  ниже
                </button>
                <button
                  type="button"
                  onClick={() => updateFioNudge(-1)}
                  className="h-9 rounded-md border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition active:translate-y-px"
                >
                  выше на 1px
                </button>
                <button
                  type="button"
                  onClick={() => updateFioNudge(1)}
                  className="h-9 rounded-md border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-700 transition active:translate-y-px"
                >
                  ниже на 1px
                </button>
              </div>
              <button
                type="button"
                onClick={resetFioNudge}
                className="mt-2 h-9 w-full rounded-md bg-stone-200 px-3 text-xs font-semibold text-stone-700 transition active:translate-y-px"
              >
                сбросить для этого шаблона
              </button>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                Настройка сохраняется на этом устройстве и попадает в PNG/PDF.
              </p>
            </div>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            {preparedFile && (
              <div className="rounded-md border border-brass/30 bg-amber-50 px-3 py-3">
                <p className="mb-3 text-sm font-semibold text-stone-900">{preparedFile.label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={preparedFile.url}
                    download={preparedFile.fileName}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 items-center justify-center rounded-md bg-stone-900 px-4 text-center text-sm font-semibold text-white transition hover:bg-stone-800 active:translate-y-px"
                  >
                    Открыть файл
                  </a>
                  <button
                    type="button"
                    onClick={handlePreparedShare}
                    className="h-11 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 active:translate-y-px"
                  >
                    Поделиться
                  </button>
                </div>
              </div>
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
              <h2 className="mt-1 text-lg font-semibold text-ink">{selectedTemplate.title}</h2>
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
                    src={selectedTemplate.background}
                    className="absolute inset-0 h-full w-full object-cover"
                    alt=""
                    draggable={false}
                  />

                  <FioPreview fio={fio} template={selectedTemplate} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
