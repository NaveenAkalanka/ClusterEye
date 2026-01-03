import { Minus, Plus } from "@phosphor-icons/react";

export default function NumberStepper({ value, onChange, min = 0, max, step = 1, className = "", placeholder = "" }) {
    const handleDecrement = () => {
        const newVal = Number(value) - step;
        if (newVal >= min) onChange(newVal);
    };

    const handleIncrement = () => {
        const newVal = Number(value) + step;
        if (max === undefined || newVal <= max) onChange(newVal);
    };

    return (
        <div className={`flex items-center bg-[#161D22] border border-white/5 rounded-xl ${className}`}>
            <button
                type="button"
                onClick={handleDecrement}
                className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors rounded-l-xl active:scale-95 cursor-pointer"
            >
                <Minus size={14} weight="bold" />
            </button>

            <input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                placeholder={placeholder}
                className="w-full bg-transparent text-center text-sm font-semibold outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/20"
                min={min}
                max={max}
            />

            <button
                type="button"
                onClick={handleIncrement}
                className="px-3 py-2 text-white/50 hover:text-white hover:bg-white/5 transition-colors rounded-r-xl active:scale-95 cursor-pointer"
            >
                <Plus size={14} weight="bold" />
            </button>
        </div>
    );
}
