import { Minus, Plus } from "@phosphor-icons/react";

export default function NumberStepper({ value, onChange, min = 0, max, step = 1, className = "", placeholder = "", label = "Amount", readOnly = false, unit = "" }) {
    if (readOnly) {
        return <div className={`flex h-10 items-center text-sm font-medium text-white ${className}`}>{value}{unit && ` ${unit}`}</div>;
    }

    const handleDecrement = () => {
        const newVal = Number(value || 0) - step;
        if (newVal >= min) onChange(newVal);
    };

    const handleIncrement = () => {
        const newVal = Number(value || 0) + step;
        if (max === undefined || newVal <= max) onChange(newVal);
    };

    return (
        <div className={`flex h-10 items-center rounded-xl border border-field-line bg-field transition-colors focus-within:border-accent ${className}`}>
            <button
                type="button"
                onClick={handleDecrement}
                aria-label={`Decrease ${label}`}
                className="flex h-full w-10 shrink-0 items-center justify-center rounded-l-xl text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
                <Minus size={14} weight="bold" />
            </button>

            <input
                type="number"
                inputMode="numeric"
                aria-label={label}
                value={value}
                onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder={placeholder}
                className="w-full min-w-0 bg-transparent text-center text-sm font-semibold text-white outline-none placeholder:text-white/50"
                min={min}
                max={max}
            />

            <button
                type="button"
                onClick={handleIncrement}
                aria-label={`Increase ${label}`}
                className="flex h-full w-10 shrink-0 items-center justify-center rounded-r-xl text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
                <Plus size={14} weight="bold" />
            </button>
        </div>
    );
}
