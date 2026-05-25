"use client";

import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";

const CERTIFICATE_WIDTH = 794;
const CERTIFICATE_HEIGHT = 1123;

type CertificateKey =
  | "parents"
  | "teacher"
  | "participant"
  | "diploma_1"
  | "diploma_2"
  | "diploma_3";

type TextFieldConfig = {
  top: number;
  left: number;
  width: number;
  fontSize: number;
  lineHeight?: number;
  fontWeight?: number;
  color?: string;
  textAlign?: CSSProperties["textAlign"];
};

type DateFieldConfig = {
  top: number;
  dayLeft: number;
  dayWidth: number;
  monthLeft: number;
  monthWidth: number;
  yearLeft: number;
  yearWidth: number;
  fontSize: number;
};

type CertificateConfig = {
  label: string;
  background: string;
  hideSchool?: boolean;
  fields: {
    fio: TextFieldConfig;
    school: TextFieldConfig;
    date: DateFieldConfig;
  };
};

const CERTIFICATES: Record<CertificateKey, CertificateConfig> = {
  parents: {
    label: "Благодарность родителям",
    background: "/certificates/parents.png",
    hideSchool: true,
    fields: {
      fio: { top: 555, left: 321, width: 377, fontSize: 22, fontWeight: 700, textAlign: "center" },
      school: { top: 0, left: 0, width: 0, fontSize: 0 },
      date: { top: 886, dayLeft: 367, dayWidth: 31, monthLeft: 409, monthWidth: 73, yearLeft: 501, yearWidth: 26, fontSize: 14 },
    },
  },
  teacher: {
    label: "Благодарность педагогу",
    background: "/certificates/teacher.png",
    hideSchool: true,
    fields: {
      fio: { top: 551, left: 337, width: 438, fontSize: 22, fontWeight: 700, textAlign: "center" },
      school: { top: 0, left: 0, width: 0, fontSize: 0 },
      date: { top: 876, dayLeft: 378, dayWidth: 29, monthLeft: 418, monthWidth: 76, yearLeft: 512, yearWidth: 27, fontSize: 14 },
    },
  },
  participant: {
    label: "Диплом участника",
    background: "/certificates/participant.png",
    fields: {
      fio: { top: 511, left: 316, width: 390, fontSize: 22, fontWeight: 700, textAlign: "center" },
      school: { top: 602, left: 128, width: 652, fontSize: 15, lineHeight: 1.15, textAlign: "center" },
      date: { top: 930, dayLeft: 375, dayWidth: 28, monthLeft: 414, monthWidth: 71, yearLeft: 503, yearWidth: 25, fontSize: 14 },
    },
  },
  diploma_1: {
    label: "Диплом I степени",
    background: "/certificates/diploma_1.png",
    fields: {
      fio: { top: 509, left: 385, width: 318, fontSize: 22, fontWeight: 700, textAlign: "center" },
      school: { top: 607, left: 127, width: 569, fontSize: 15, lineHeight: 1.15, textAlign: "center" },
      date: { top: 941, dayLeft: 362, dayWidth: 29, monthLeft: 404, monthWidth: 84, yearLeft: 506, yearWidth: 24, fontSize: 14 },
    },
  },
  diploma_2: {
    label: "Диплом II степени",
    background: "/certificates/diploma_2.png",
    fields: {
      fio: { top: 521, left: 305, width: 415, fontSize: 22, fontWeight: 700, textAlign: "center" },
      school: { top: 614, left: 128, width: 587, fontSize: 15, lineHeight: 1.15, textAlign: "center" },
      date: { top: 903, dayLeft: 377, dayWidth: 27, monthLeft: 416, monthWidth: 68, yearLeft: 503, yearWidth: 25, fontSize: 14 },
    },
  },
  diploma_3: {
    label: "Диплом III степени",
    background: "/certificates/diploma_3.png",
    fields: {
      fio: { top: 511, left: 308, width: 421, fontSize: 22, fontWeight: 700, textAlign: "center" },
      school: { top: 610, left: 308, width: 421, fontSize: 15, lineHeight: 1.15, textAlign: "center" },
      date: { top: 924, dayLeft: 369, dayWidth: 32, monthLeft: 413, monthWidth: 79, yearLeft: 512, yearWidth: 26, fontSize: 14 },
    },
  },
};

const SELECT_OPTIONS = Object.entries(CERTIFICATES).map(([value, item]) => ({
  value: value as CertificateKey,
  label: item.label,
}));

function textStyle(config: TextFieldConfig): CSSProperties {
  return {
    top: config.top,
    left: config.left,
    width: config.width,
    fontSize: config.fontSize,
    lineHeight: config.lineHeight ?? 1.18,
    fontWeight: config.fontWeight ?? 500,
    color: config.color ?? "#24201b",
    textAlign: config.textAlign ?? "center",
  };
}

function datePartStyle(
  config: DateFieldConfig,
  part: "day" | "month" | "year",
): CSSProperties {
  const leftByPart = {
    day: config.dayLeft,
    month: config.monthLeft,
    year: config.yearLeft,
  };
  const widthByPart = {
    day: config.dayWidth,
    month: config.monthWidth,
    year: config.yearWidth,
  };

  return {
    top: config.top - config.fontSize - 2,
    left: leftByPart[part],
    width: widthByPart[part],
    fontSize: config.fontSize,
    lineHeight: 1,
    color: "#24201b",
    textAlign: "center",
  };
}

function parseDateParts(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/(\d{1,2})\s+([А-Яа-яЁё]+)\s+(\d{4})/);

  if (!match) {
    return { day: "", month: trimmed, year: "" };
  }

  return {
    day: match[1],
    month: match[2],
    year: match[3].slice(-2),
  };
}

export default function CertificateGenerator() {
  const certificateRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<CertificateKey>("diploma_1");
  const [fio, setFio] = useState("Иванова Мария Сергеевна");
  const [school, setSchool] = useState("МБОУ СОШ N 7, 4 класс");
  const [date, setDate] = useState("24 мая 2026 г.");
  const [previewScale, setPreviewScale] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  const config = CERTIFICATES[selected];
  const dateParts = useMemo(() => parseDateParts(date), [date]);
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
    if (!certificateRef.current) return;
    setError("");
    setIsExporting(true);

    try {
      const dataUrl = await toPng(certificateRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: CERTIFICATE_WIDTH,
        height: CERTIFICATE_HEIGHT,
      });
      const link = document.createElement("a");
      link.download = `${safeName}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Не удалось подготовить PNG. Проверьте, что фон и изображения загрузились.");
    } finally {
      setIsExporting(false);
    }
  };

  const handlePdfExport = async () => {
    if (!certificateRef.current) return;
    setError("");
    setIsExporting(true);

    try {
      const dataUrl = await toPng(certificateRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: CERTIFICATE_WIDTH,
        height: CERTIFICATE_HEIGHT,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      pdf.addImage(dataUrl, "PNG", 0, 0, 210, 297);
      pdf.save(`${safeName}.pdf`);
    } catch {
      setError("Не удалось подготовить PDF. Попробуйте повторить экспорт.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1500px] gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <section className="rounded-lg border border-stone-300/70 bg-white/82 p-5 shadow-sheet backdrop-blur sm:p-6 lg:sticky lg:top-6 lg:self-start">
          <div className="mb-6 border-b border-stone-200 pb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-brass">
              Вектор будущего
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Генератор сертификатов
            </h1>
            <p className="mt-2 max-w-[34rem] text-sm leading-6 text-stone-600">
              Выберите шаблон, заполните данные и скачайте готовый файл без отдельного backend.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-800">Тип сертификата</span>
              <select
                value={selected}
                onChange={(event) => setSelected(event.target.value as CertificateKey)}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/10"
              >
                {SELECT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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

            {!config.hideSchool && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-800">
                  Учреждение и класс
                </span>
                <textarea
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/10"
                  placeholder="МБОУ СОШ N 7, 4 класс"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-800">Дата</span>
              <input
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-brass focus:ring-4 focus:ring-brass/10"
                placeholder="24 мая 2026 г."
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
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Live preview</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{config.label}</h2>
            </div>
            <p className="hidden text-sm text-stone-600 sm:block">794 x 1123 px</p>
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
                  ref={certificateRef}
                  className="certificate-stage relative overflow-hidden bg-white font-certificate shadow-[0_18px_60px_-30px_rgba(38,33,27,0.7)]"
                  style={{
                    width: CERTIFICATE_WIDTH,
                    height: CERTIFICATE_HEIGHT,
                  }}
                >
                  <img
                    src={config.background}
                    className="absolute inset-0 h-full w-full object-cover"
                    alt=""
                    draggable={false}
                  />

                  <div
                    className="absolute whitespace-pre-line break-words"
                    style={textStyle(config.fields.fio)}
                  >
                    {fio}
                  </div>

                  {!config.hideSchool && (
                    <div
                      className="absolute whitespace-pre-line break-words"
                      style={textStyle(config.fields.school)}
                    >
                      {school}
                    </div>
                  )}

                  <div
                    className="absolute text-center"
                    style={datePartStyle(config.fields.date, "day")}
                  >
                    {dateParts.day}
                  </div>
                  <div
                    className="absolute text-center"
                    style={datePartStyle(config.fields.date, "month")}
                  >
                    {dateParts.month}
                  </div>
                  <div
                    className="absolute text-center"
                    style={datePartStyle(config.fields.date, "year")}
                  >
                    {dateParts.year}
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
