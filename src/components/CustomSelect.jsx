import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretDown, Check } from "@phosphor-icons/react";

export default function CustomSelect({
    value,
    onChange,
    options = [],
    placeholder = "Select...",
    disabled = false,
    className = "",
    label,
    renderOption,
    size = "default",
}) {
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const listboxId = useId();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [menuStyle, setMenuStyle] = useState(null);

    const formattedOptions = useMemo(() => options.map((option, index) => {
        const formatted = typeof option === "object"
            ? option
            : { value: option, label: option };
        return {
            ...formatted,
            raw: option,
            key: `${String(formatted.value)}-${index}`,
        };
    }), [options]);

    const choices = useMemo(() => [
        { value: "", label: placeholder, raw: "", key: "__placeholder__", placeholder: true },
        ...formattedOptions.filter((option) => option.value !== ""),
    ], [formattedOptions, placeholder]);
    const preferredMenuWidth = useMemo(() => {
        const longestLabel = choices.reduce((length, option) => Math.max(length, String(option.label || "").length), 0);
        return Math.min(360, Math.max(180, longestLabel * 7.5 + 56));
    }, [choices]);

    const selectedIndex = choices.findIndex((option) => String(option.value) === String(value ?? ""));
    const selectedOption = selectedIndex >= 0 ? choices[selectedIndex] : choices[0];

    useEffect(() => {
        if (!open) return undefined;
        const handlePointerDown = (event) => {
            if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown);
        return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    useLayoutEffect(() => {
        if (!open) return undefined;

        const updatePosition = () => {
            const rect = buttonRef.current?.getBoundingClientRect();
            if (!rect) return;

            const viewportPadding = 8;
            const gap = 6;
            const width = Math.min(Math.max(rect.width, preferredMenuWidth), window.innerWidth - viewportPadding * 2);
            const left = Math.min(Math.max(rect.left, viewportPadding), window.innerWidth - width - viewportPadding);
            const below = window.innerHeight - rect.bottom - viewportPadding;
            const above = rect.top - viewportPadding;
            const opensUp = below < 220 && above > below;
            const available = opensUp ? above : below;

            setMenuStyle({
                left,
                width,
                maxHeight: Math.max(96, Math.min(280, available - gap)),
                ...(opensUp
                    ? { bottom: window.innerHeight - rect.top + gap }
                    : { top: rect.bottom + gap }),
            });
        };

        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, choices.length, preferredMenuWidth]);

    useEffect(() => {
        if (disabled && open) setOpen(false);
    }, [disabled, open]);

    useEffect(() => {
        if (!open) return;
        document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, listboxId, open]);

    const openMenu = (direction = 1) => {
        if (disabled) return;
        const fallback = direction > 0 ? 0 : choices.length - 1;
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : fallback);
        setOpen(true);
    };

    const selectOption = (option) => {
        onChange(option.value);
        setOpen(false);
        buttonRef.current?.focus();
    };

    const handleKeyDown = (event) => {
        if (disabled) return;

        if (!open) {
            if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
                event.preventDefault();
                openMenu(event.key === "ArrowUp" ? -1 : 1);
            }
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % choices.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + choices.length) % choices.length);
        } else if (event.key === "Home") {
            event.preventDefault();
            setActiveIndex(0);
        } else if (event.key === "End") {
            event.preventDefault();
            setActiveIndex(choices.length - 1);
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectOption(choices[activeIndex]);
        } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        } else if (event.key === "Tab") {
            setOpen(false);
        }
    };

    const renderContent = (option) => {
        if (option.placeholder) return <span className="text-white/55">{option.label}</span>;
        if (renderOption) return renderOption(option.raw);
        return (
            <span className="min-w-0">
                <span className="block truncate text-white">{option.label}</span>
                {option.subLabel && <span className="block truncate text-[11px] text-white/50 mt-0.5">{option.subLabel}</span>}
            </span>
        );
    };

    return (
        <div className={`relative min-w-0 w-full ${size === "compact" ? "h-8 text-xs" : "h-10 text-sm"} ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                role="combobox"
                disabled={disabled}
                aria-label={label || placeholder}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listboxId : undefined}
                aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
                title={String(selectedOption.label || "")}
                onClick={() => open ? setOpen(false) : openMenu()}
                onKeyDown={handleKeyDown}
                className={`flex h-full min-h-8 min-w-0 w-full items-center justify-between gap-2 rounded-xl border px-3 text-left [font-size:inherit] transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A8C9AD] ${open
                    ? "border-[#A8C9AD]/50 bg-[#1c252b] shadow-[0_0_0_3px_rgba(168,201,173,0.08)]"
                    : "border-white/15 bg-[#161D22] hover:border-white/25 hover:bg-[#1c252b]"
                    } disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-[#121712] disabled:text-white/60 disabled:opacity-80`}
            >
                <div className="min-w-0 flex-1 truncate">{renderContent(selectedOption)}</div>
                <CaretDown
                    size={15}
                    weight="bold"
                    aria-hidden="true"
                    className={`shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-180 text-[#A8C9AD]" : ""}`}
                />
            </button>

            {open && menuStyle && createPortal(
                <div
                    ref={menuRef}
                    id={listboxId}
                    role="listbox"
                    aria-label={label || placeholder}
                    style={menuStyle}
                    className="fixed z-[200] overflow-y-auto overscroll-contain rounded-xl border border-white/15 bg-[#111611] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl custom-scrollbar animate-scaleIn"
                >
                    {choices.map((option, index) => {
                        const selected = String(option.value) === String(value ?? "");
                        const active = index === activeIndex;
                        return (
                            <button
                                key={option.key}
                                id={`${listboxId}-${index}`}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                tabIndex={-1}
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => selectOption(option)}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${active ? "bg-white/10" : "hover:bg-white/[0.06]"} ${option.placeholder ? "text-white/55" : "text-white"}`}
                            >
                                <div className="min-w-0 flex-1">{renderContent(option)}</div>
                                {selected && <Check size={15} weight="bold" className="shrink-0 text-[#A8C9AD]" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>,
                document.body
            )}
        </div>
    );
}
