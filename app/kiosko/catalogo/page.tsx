"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createKioskRequest, getActiveAssignment, getPPECatalog } from "@/lib/kiosk-api";
import { KioskRequestItem, PPECatalogItem, ReplacementReason } from "@/lib/kiosk-types";
import { resolveEppImageUrl } from "@/lib/epp-images";
import {
  ALL_CATEGORIES,
  type EarlyReplacementNotice,
  buildCategoryTabs,
  categoryLabel,
  displayItemCode,
  formatDaysAgo,
  getEarlyReplacementNotice,
  getItemStatus,
  getStockLevel,
  isVariantAvailable,
  statusMessage,
  stockLevelLabel,
} from "@/lib/kiosk-catalog-view";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Footprints, Glasses, Hand, HardHat, Headphones, Loader2, Package, Search, Shirt, Wind, X } from "lucide-react";
import { setKioskSessionBusy } from "@/lib/kiosk-session";
import { getKioskSubmitState } from "@/lib/kiosk-submit-state";
import { useKioskSessionSnapshot } from "../use-kiosk-session-snapshot";

const CATEGORY_ICONS: Record<string, ReactNode> = {
  Guantes: <Hand className="h-10 w-10" />,
  Cascos: <HardHat className="h-10 w-10" />,
  Gafas: <Glasses className="h-10 w-10" />,
  Calzado: <Footprints className="h-10 w-10" />,
  "Proteccion Auditiva": <Headphones className="h-10 w-10" />,
  Ropa: <Shirt className="h-10 w-10" />,
  Respiradores: <Wind className="h-10 w-10" />,
};

/** Motivos en el orden del diseño. Las claves y el payload no cambian. */
const REQUEST_REASONS: { key: ReplacementReason; label: string; hint?: string }[] = [
  { key: "desgaste", label: "Uso normal" },
  { key: "vida_util", label: "Vida útil cumplida" },
  { key: "extravio", label: "Pérdida, robo o mal uso", hint: "Se cobra por nómina el costo aplicable" },
];

type SelectedVariant = {
  itemId: string;
  itemName: string;
  sku: string;
  size: string;
  replacementDays: number;
};

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const noticeKey = (variant: SelectedVariant) => `${variant.itemId}|${variant.size}`;

export default function KioskoCatalogoPage() {
  const router = useRouter();
  const { ready, employeeId, employeeName, employeePlant, pinVerified } = useKioskSessionSnapshot();
  const [items, setItems] = useState<PPECatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [submitError, setSubmitError] = useState("");
  const [requestReason, setRequestReason] = useState<ReplacementReason | null>(null);
  const [confirmLossOpen, setConfirmLossOpen] = useState(false);
  const reasonsRef = useRef<HTMLFieldSetElement>(null);
  const [selectedByItem, setSelectedByItem] = useState<Record<string, SelectedVariant>>({});
  const [noticeByKey, setNoticeByKey] = useState<Record<string, EarlyReplacementNotice | null>>({});
  const requestedNotices = useRef(new Set<string>());
  const selectedItems = useMemo(() => Object.values(selectedByItem), [selectedByItem]);
  const selectedCount = selectedItems.length;

  useEffect(() => {
    if (!ready) return;
    if (!employeeId || !employeePlant || !pinVerified) {
      router.replace("/kiosko");
      return;
    }

    let cancelled = false;

    void getPPECatalog(employeePlant).then((data) => {
      if (cancelled) return;
      setItems(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [employeeId, employeePlant, pinVerified, ready, router]);

  // Aviso informativo de reposición anticipada (el servidor decide la alerta real).
  useEffect(() => {
    if (!employeeId) return;
    for (const variant of selectedItems) {
      const key = noticeKey(variant);
      if (requestedNotices.current.has(key)) continue;
      requestedNotices.current.add(key);
      void getActiveAssignment(employeeId, variant.sku, variant.itemId, variant.size)
        .then((assignment) => getEarlyReplacementNotice(assignment, variant.replacementDays))
        .catch(() => null)
        .then((notice) => setNoticeByKey((prev) => ({ ...prev, [key]: notice })));
    }
  }, [employeeId, selectedItems]);

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const categoryTabs = useMemo(() => buildCategoryTabs(items), [items]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const matchCat = category === ALL_CATEGORIES || item.category === category;
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
        return matchCat && matchSearch;
      }),
    [items, category, search]
  );

  const notices = selectedItems
    .map((variant) => ({ variant, notice: noticeByKey[noticeKey(variant)] }))
    .filter((entry): entry is { variant: SelectedVariant; notice: EarlyReplacementNotice } => Boolean(entry.notice));

  const removeSelection = useCallback((itemId: string) => {
    setSelectedByItem((prev) => {
      const copy = { ...prev };
      delete copy[itemId];
      return copy;
    });
  }, []);

  if (!ready || !employeeId || !employeePlant || !pinVerified) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  /** EPP sin tallas: "Solicitar" agrega o quita el artículo. */
  const toggleSelection = (item: PPECatalogItem) => {
    const status = getItemStatus(item);
    if (status !== "ok") {
      setSubmitError(`${item.name}: ${statusMessage(status).toLowerCase()}.`);
      return;
    }
    if (item.hasSizes) {
      setSubmitError(`Selecciona una talla autorizada para ${item.name}.`);
      return;
    }

    const sku = item.sku;
    if (!sku) {
      setSubmitError(`${item.name}: sin SKU autorizado para solicitud.`);
      return;
    }

    setSubmitError("");
    setSelectedByItem((prev) => {
      if (prev[item.id]) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return {
        ...prev,
        [item.id]: { itemId: item.id, itemName: item.name, sku, size: "N/A", replacementDays: item.replacementDays },
      };
    });
  };

  /** EPP con tallas: tocar una talla selecciona el artículo con esa talla; tocarla de nuevo lo quita. */
  const chooseSize = (item: PPECatalogItem, size: string) => {
    const status = getItemStatus(item);
    if (status !== "ok") {
      setSubmitError(`${item.name}: ${statusMessage(status).toLowerCase()}.`);
      return;
    }
    const variant = item.sizes?.[size];
    if (!variant) return;
    if (!isVariantAvailable(variant)) {
      setSubmitError(`${item.name} talla ${size}: sin stock.`);
      return;
    }
    if (!variant.sku) {
      setSubmitError(`${item.name}: sin SKU autorizado para solicitud.`);
      return;
    }

    setSubmitError("");
    setSelectedByItem((prev) => {
      if (prev[item.id]?.size === size) {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      }
      return {
        ...prev,
        [item.id]: { itemId: item.id, itemName: item.name, sku: variant.sku, size, replacementDays: item.replacementDays },
      };
    });
  };

  const submitRequest = async (reasonToUse: ReplacementReason) => {
    if (!employeeId || selectedItems.length === 0) return;

    setSubmitting(true);
    setKioskSessionBusy(true);
    setSubmitError("");
    setConfirmLossOpen(false);
    try {
      const requestId = await createKioskRequest({
        employeeId,
        employeeName,
        items: selectedItems.map((item) => ({
          ...item,
          replacementReason: reasonToUse,
        })) as KioskRequestItem[],
      });
      sessionStorage.setItem("kiosk_request_id", requestId);
      router.push("/kiosko/espera");
    } catch {
      setSubmitError("No se pudo enviar la solicitud. Intenta nuevamente.");
    } finally {
      setKioskSessionBusy(false);
      setSubmitting(false);
    }
  };

  const submitState = getKioskSubmitState({ selectedCount, requestReason, submitting });

  const handleSubmit = () => {
    if (selectedCount === 0) {
      setSubmitError("Elige al menos un EPP del catálogo.");
      return;
    }
    if (!requestReason) {
      setSubmitError("Elige el motivo de la solicitud.");
      return;
    }
    // Pérdida, robo o mal uso implica cobro por nómina: pide una confirmación extra.
    if (requestReason === "extravio") {
      setConfirmLossOpen(true);
      return;
    }
    void submitRequest(requestReason);
  };

  return (
    <div className="flex flex-1 flex-col pb-32 lg:pb-0 lg:h-[calc(100dvh-72px)] lg:min-h-0 lg:flex-none lg:flex-row lg:overflow-hidden">
      {/* ── Catálogo ─────────────────────────────────────────────── */}
      <section aria-label="Catálogo" className="flex min-w-0 flex-1 flex-col gap-4 p-6 lg:min-h-0 lg:pl-8">
        <h1 className="m-0 text-2xl font-semibold text-foreground">Solicitar EPP</h1>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Categorías" className="scrollbar-hide flex min-w-0 flex-1 gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)] pr-8">
            {categoryTabs.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(cat)}
                  className={`flex h-11 flex-none items-center whitespace-nowrap rounded-full px-5 transition-colors ${FOCUS_RING} ${
                    active
                      ? "bg-foreground font-medium text-background"
                      : "border border-input text-foreground hover:bg-[var(--kiosk-selected)]"
                  }`}
                >
                  {categoryLabel(cat)}
                </button>
              );
            })}
          </div>
          <label className="relative hidden flex-none md:block">
            <span className="sr-only">Buscar EPP</span>
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Buscar EPP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-48 rounded-full border border-input bg-transparent pl-11 pr-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary xl:w-56"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 lg:overflow-y-auto lg:pr-1">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy="true" aria-label="Cargando catálogo">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-[196px] rounded-xl border border-border bg-card" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
              <Package size={48} aria-hidden="true" />
              <p className="text-lg">
                {search ? <>Sin resultados para &quot;{search}&quot;</> : "No hay EPP en esta categoría"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" style={{ gridAutoRows: "minmax(196px, auto)" }}>
              {filtered.map((item) => {
                const status = getItemStatus(item);
                const statusText = statusMessage(status);
                const selection = selectedByItem[item.id];
                const selected = Boolean(selection);
                const selectedSize = item.hasSizes ? selection?.size : undefined;
                const imageUrl = resolveEppImageUrl(item, selectedSize);
                const level = getStockLevel(item, selectedSize);
                const code = displayItemCode(item, selectedSize);
                const sizeHint = item.hasSizes ? (selectedSize ? `Talla ${selectedSize}` : "Elige tu talla") : "Talla única";
                const levelTone =
                  level === "ok" ? "text-primary" : level === "low" ? "text-[var(--warning)]" : "text-muted-foreground";
                const dotTone =
                  level === "ok" ? "bg-primary" : level === "low" ? "bg-[var(--warning)]" : "bg-muted-foreground";

                return (
                  <article
                    key={item.id}
                    aria-label={item.name}
                    className={`flex min-h-0 gap-4 rounded-xl transition-colors ${
                      selected
                        ? "border-2 border-primary bg-[var(--kiosk-selected)] p-[15px]"
                        : "border border-border bg-card p-4"
                    }`}
                  >
                    <div
                      className={`flex w-28 flex-none items-center justify-center self-stretch rounded-lg bg-[var(--kiosk-sunken)] ${
                        status !== "ok" ? "opacity-45" : ""
                      }`}
                    >
                      {imageUrl ? (
                        <div className="relative h-24 w-24">
                          <Image src={imageUrl} alt={item.name} fill sizes="96px" className="object-contain" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground" aria-hidden="true">
                          {CATEGORY_ICONS[item.category] ?? <Package className="h-10 w-10" />}
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`m-0 text-base font-medium leading-snug ${status !== "ok" ? "text-foreground/60" : "text-foreground"}`}>
                          {item.name}
                        </h3>
                        {selected && (
                          <span className="flex-none rounded bg-primary px-2 py-0.5 text-[11px] font-semibold tracking-[0.06em] text-primary-foreground">
                            SELECCIONADO
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 text-[13px] ${selected ? "text-foreground/75" : "text-muted-foreground"}`}>
                        {code ? <span className="font-mono">{code}</span> : categoryLabel(item.category)} · {sizeHint}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13px]">
                        <span className={`flex items-center gap-1.5 ${levelTone}`}>
                          <span aria-hidden="true" className={`h-[7px] w-[7px] rounded-full ${dotTone}`} />
                          {stockLevelLabel(level)}
                        </span>
                        <span className="text-muted-foreground">
                          · {item.requiredQuantity && item.requiredUnit
                            ? `${item.requiredQuantity} ${item.requiredUnit} cada ${item.replacementDays} días`
                            : `Vida útil ${item.replacementDays} días`}
                        </span>
                      </div>

                      <div className="mt-auto pt-3">
                        {status !== "ok" ? (
                          <button
                            type="button"
                            aria-disabled="true"
                            onClick={() => setSubmitError(`${item.name}: ${statusText.toLowerCase()}.`)}
                            className={`flex h-12 w-full cursor-not-allowed items-center justify-center rounded-lg border border-dashed border-input font-medium text-muted-foreground ${FOCUS_RING}`}
                          >
                            {statusText}
                          </button>
                        ) : item.hasSizes && item.sizes ? (
                          <div role="group" aria-label={`Tallas de ${item.name}`} className="flex flex-wrap gap-1.5">
                            {Object.entries(item.sizes).map(([size, variant]) => {
                              const variantOk = isVariantAvailable(variant);
                              const pressed = selectedSize === size;
                              return (
                                <button
                                  key={size}
                                  type="button"
                                  aria-pressed={pressed}
                                  aria-disabled={!variantOk || submitting}
                                  aria-label={`Talla ${size}${variantOk ? "" : ", sin stock"}`}
                                  onClick={() => !submitting && chooseSize(item, size)}
                                  className={`flex h-12 min-w-11 items-center justify-center rounded-lg px-2 font-mono text-[15px] transition-colors ${FOCUS_RING} ${
                                    pressed
                                      ? "bg-primary font-semibold text-primary-foreground"
                                      : variantOk
                                      ? "border border-[var(--kiosk-control)] text-foreground hover:border-primary"
                                      : "cursor-not-allowed border border-dashed border-input text-muted-foreground line-through"
                                  }`}
                                >
                                  {size}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-pressed={selected}
                            disabled={submitting}
                            onClick={() => toggleSelection(item)}
                            className={`flex h-12 w-full items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-40 ${FOCUS_RING} ${
                              selected
                                ? "border border-primary text-foreground hover:bg-[var(--kiosk-sunken)]"
                                : "border border-[var(--kiosk-control)] text-foreground hover:border-primary"
                            }`}
                          >
                            {selected ? (<><X size={16} aria-hidden="true" /> Quitar</>) : "Solicitar"}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Tu solicitud ─────────────────────────────────────────── */}
      <aside
        aria-label="Tu solicitud"
        className="flex flex-none flex-col gap-[18px] border-t border-border bg-[var(--kiosk-sunken)] px-7 py-6 lg:min-h-0 lg:w-[380px] lg:border-l lg:border-t-0"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="m-0 text-xl font-medium text-foreground">Tu solicitud</h2>
          {selectedCount > 0 && (
            <span className="font-mono text-[13px] text-muted-foreground">
              {selectedCount} {selectedCount === 1 ? "artículo" : "artículos"}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[18px] lg:overflow-y-auto">
          {selectedCount === 0 ? (
            <p className="m-0 rounded-[10px] border border-dashed border-input p-4 text-sm text-muted-foreground">
              Aún no eliges EPP. Toca <span className="font-medium text-foreground">Solicitar</span> o una talla en el catálogo.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {selectedItems.map((variant) => {
                const item = itemsById.get(variant.itemId);
                const thumb = item ? resolveEppImageUrl(item, variant.size === "N/A" ? undefined : variant.size) : undefined;
                const quantity = item?.requiredQuantity && item.requiredUnit ? ` · ${item.requiredQuantity} ${item.requiredUnit}` : "";
                return (
                  <li key={variant.itemId} className="flex items-center gap-3.5 rounded-[10px] border border-border bg-card py-2 pl-3 pr-1">
                    <div className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-[var(--kiosk-sunken)]">
                      {thumb ? (
                        <div className="relative h-11 w-11">
                          <Image src={thumb} alt="" fill sizes="44px" className="object-contain" />
                        </div>
                      ) : (
                        <Package className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{variant.itemName}</div>
                      <div className="text-[13px] text-muted-foreground">
                        {variant.size === "N/A" ? "Talla única" : `Talla ${variant.size}`}{quantity}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelection(variant.itemId)}
                      disabled={submitting}
                      aria-label={`Quitar ${variant.itemName} de la solicitud`}
                      className={`flex h-12 w-12 flex-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 ${FOCUS_RING}`}
                    >
                      <X size={18} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {notices.map(({ variant, notice }) => {
            const critical = notice.severity === "critical";
            const when = formatDaysAgo(notice.daysUsed);
            const lead = selectedCount > 1 ? `${variant.itemName}: entregado ${when}.` : `Entregado ${when}.`;
            return (
              <div
                key={noticeKey(variant)}
                role="alert"
                className={`flex gap-3 rounded-[10px] border px-4 py-3.5 ${
                  critical
                    ? "border-[var(--critical)] bg-[var(--kiosk-critical-bg)]"
                    : "border-[var(--warning)] bg-[var(--kiosk-warning-bg)]"
                }`}
              >
                <AlertTriangle
                  size={20}
                  aria-hidden="true"
                  className={`mt-0.5 flex-none ${critical ? "text-[var(--critical)]" : "text-[var(--warning)]"}`}
                />
                <p className="m-0 text-sm text-foreground">
                  <b className={`font-semibold ${critical ? "text-[var(--critical)]" : "text-[var(--warning)]"}`}>{lead}</b>{" "}
                  Su vida útil es de {notice.replacementDays} días. Esta solicitud requiere la aprobación de un responsable.
                </p>
              </div>
            );
          })}

          <fieldset ref={reasonsRef} className="m-0 flex scroll-mt-6 flex-col gap-2 border-0 p-0" disabled={submitting}>
            <legend className="mb-2 p-0 text-[13px] text-muted-foreground">Motivo de la solicitud</legend>
            {REQUEST_REASONS.map((option) => {
              const checked = requestReason === option.key;
              const loss = option.key === "extravio";
              return (
                <label
                  key={option.key}
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[10px] py-2 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    checked
                      ? loss
                        ? "border-2 border-[var(--critical)] bg-[var(--kiosk-critical-bg)] px-[13px]"
                        : "border-2 border-primary bg-[var(--kiosk-selected)] px-[13px]"
                      : "border border-input px-3.5 hover:border-[var(--kiosk-control)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="motivo"
                    value={option.key}
                    checked={checked}
                    onChange={() => {
                      setRequestReason(option.key);
                      setSubmitError("");
                    }}
                    className={`m-0 h-5 w-5 flex-none cursor-pointer appearance-none rounded-full border-2 border-[var(--kiosk-control)] bg-transparent outline-none transition-[border-width,border-color] ${loss ? "checked:border-[6px] checked:border-[var(--critical)]" : "checked:border-[6px] checked:border-primary"}`}
                  />
                  <span>
                    <span className="block font-medium text-foreground">{option.label}</span>
                    {option.hint && <span className="block text-[13px] text-muted-foreground">{option.hint}</span>}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </div>

        {/* Siempre visible: fijo abajo en pantallas chicas, al pie del panel en escritorio. */}
        <div className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-2 border-t border-border bg-[var(--kiosk-sunken)] px-6 py-4 lg:static lg:border-0 lg:bg-transparent lg:p-0">
          {submitError ? (
            <p role="alert" className="m-0 text-[13px] text-[var(--critical)]">{submitError}</p>
          ) : selectedCount > 0 && !requestReason ? (
            <button
              type="button"
              onClick={() => reasonsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="m-0 self-start text-left text-[13px] text-muted-foreground underline lg:no-underline"
            >
              {submitState.hint}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!submitState.enabled}
            className={`flex h-14 items-center justify-center gap-2 rounded-[10px] bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
          >
            {submitting && <Loader2 size={18} className="animate-spin" aria-hidden="true" />}
            {submitting ? "Enviando…" : selectedCount > 0 ? `Enviar a aprobación (${selectedCount})` : "Enviar a aprobación"}
          </button>
        </div>
      </aside>

      {/* Confirmación extra para pérdida, robo o mal uso (cobro por nómina) */}
      <Dialog open={confirmLossOpen} onOpenChange={(open) => !submitting && setConfirmLossOpen(open)}>
        <DialogContent showCloseButton={false} className="gap-5 rounded-xl border border-border bg-card p-6 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium text-foreground">¿Confirmas pérdida, robo o mal uso?</DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-muted-foreground">
              La reposición de {selectedCount === 1 ? "este EPP" : `estos ${selectedCount} EPP`} se cobrará por nómina conforme al costo aplicable.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setConfirmLossOpen(false)}
              disabled={submitting}
              className={`h-12 rounded-lg border border-input font-medium text-foreground transition-colors hover:bg-[var(--kiosk-sunken)] ${FOCUS_RING}`}
            >
              Volver
            </button>
            <button
              type="button"
              onClick={() => void submitRequest("extravio")}
              disabled={submitting}
              className={`h-12 rounded-lg bg-critical font-semibold text-white transition-opacity disabled:opacity-40 ${FOCUS_RING}`}
            >
              {submitting ? "Enviando…" : "Sí, enviar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
