
import React from 'react';

export const IntermediateLoadingCard: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 w-12 h-[152px] p-2 text-white/50 bg-primary/10 animate-pulse">
            <div className="w-6 h-6 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
};
