import React from 'react';
import { MinusIcon, PlusIcon } from '../Icons';

export const FONT_SIZE_CLASSES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
export const FONT_SIZE_CLASSES_LARGE = ['text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];


export const FontSizeControl: React.FC<{
    fontSize: number;
    setFontSize: (setter: (s: number) => number) => void;
    maxSize?: number;
    className?: string;
}> = ({ fontSize, setFontSize, maxSize = 4, className = '' }) => (
    <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-sm font-semibold text-foreground-light dark:text-foreground-dark whitespace-nowrap">Fonte:</span>
        <button
            onClick={() => setFontSize(s => Math.max(0, s - 1))}
            disabled={fontSize === 0}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Diminuir"
        >
            <MinusIcon className="w-5 h-5" />
        </button>
        <button
            onClick={() => setFontSize(s => Math.min(maxSize, s + 1))}
            disabled={fontSize === maxSize}
            className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
            title="Aumentar"
        >
            <PlusIcon className="w-5 h-5" />
        </button>
    </div>
);