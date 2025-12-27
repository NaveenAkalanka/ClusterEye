import { useState, useEffect, useRef } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

/**
 * CustomSelect Component
 * 
 * @param {string} value - Current selected value
 * @param {function} onChange - Callback (value) => void
 * @param {Array} options - Array of { value, label, subLabel? } or strings
 * @param {string} placeholder - Placeholder text
 * @param {boolean} disabled - Disabled state
 * @param {string} className - Additional CSS classes
 */
export default function CustomSelect({
    value,
    onChange,
    options = [],
    placeholder = "Select...",
    disabled = false,
    className = "",
}) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Format options
    const formattedOptions = options.map((opt) => {
        if (typeof opt === "object") return opt;
        return { value: opt, label: opt };
    });

    const selectedOption = formattedOptions.find((o) => o.value === value);

    function handleSelect(val) {
        if (disabled) return;
        onChange(val); // Pass value directly
        setIsOpen(false);
    }

    return (
        <div
            ref={containerRef}
            className={`relative w-full ${className} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
            {/* Trigger */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`h-10 bg-[#161D22] border border-white/5 rounded-xl px-4 flex items-center justify-between text-sm transition-all hover:bg-[#1c252b] cursor-pointer ${isOpen ? "border-white/20 bg-[#1c252b]" : ""
                    }`}
            >
                <span className={selectedOption ? "text-white" : "text-white/40"}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <CaretDown
                    size={16}
                    weight="bold"
                    className={`text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0D100D] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 p-1">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {formattedOptions.length === 0 ? (
                            <div className="px-3 py-2 text-white/40 text-xs text-center">No options</div>
                        ) : (
                            formattedOptions.map((opt) => (
                                <div
                                    key={opt.value}
                                    onClick={() => handleSelect(opt.value)}
                                    className={`px-3 py-2 mx-1 my-0.5 rounded-lg flex items-center justify-between text-sm transition-all group cursor-pointer ${opt.value === value
                                        ? "bg-[#161D22] text-white"
                                        : "text-white/70 hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span>{opt.label}</span>
                                        {opt.subLabel && (
                                            <span className="text-xs text-white/40 group-hover:text-white/60">
                                                {opt.subLabel}
                                            </span>
                                        )}
                                    </div>
                                    {opt.value === value && <Check size={14} weight="bold" className="text-white" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
