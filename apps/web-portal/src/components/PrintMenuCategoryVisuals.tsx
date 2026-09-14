import type { CSSProperties } from 'react';

export function getPrintMenuCategoryBlockStyle(bgImage?: string): CSSProperties | undefined {
    if (!bgImage) return undefined;

    return {
        backgroundImage: `url(${bgImage})`,
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain'
    };
}

export function PrintMenuCategoryTitle({ name, icon }: { name: string; icon?: string }) {
    return (
        <span className="pm-category-title-row">
            {icon ? <img className="pm-category-icon" src={icon} alt="" aria-hidden="true" /> : null}
            <span>{name}</span>
        </span>
    );
}
