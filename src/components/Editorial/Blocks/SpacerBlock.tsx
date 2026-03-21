import React from 'react';
import type { SpacerPayload } from '@/types/editorial';

export const SpacerBlock: React.FC<{ payload: SpacerPayload }> = ({ payload }) => {
    const heights = {
        sm: 'h-8 md:h-12',
        md: 'h-16 md:h-24',
        lg: 'h-24 md:h-32',
        xl: 'h-32 md:h-48',
    };

    return <div className={heights[payload.height]} aria-hidden="true" />;
};
