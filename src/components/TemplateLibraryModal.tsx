'use client';

import { useState, useMemo } from 'react';
import { TEMPLATES, Template, TemplateCategory } from '@/config/templates';
import { IDENTITY_MODES } from '@/config/identityModes';
import { Modal } from '@/components/Modal';

// ── Filter categories ─────────────────────────────────────────

const CATEGORY_FILTERS: { id: TemplateCategory | 'All'; label: string; icon: string }[] = [
    { id: 'All', label: 'All', icon: '📚' },
    { id: 'Faith', label: 'Faith', icon: '🙏' },
    { id: 'Study', label: 'Study', icon: '📖' },
    { id: 'Vision', label: 'Vision', icon: '🎯' },
    { id: 'Habits', label: 'Habits', icon: '⚡' },
];

// ── Props ─────────────────────────────────────────────────────

interface TemplateLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTemplate: (template: Template) => void;
}

// ── Component ─────────────────────────────────────────────────

export default function TemplateLibraryModal({
    isOpen,
    onClose,
    onSelectTemplate,
}: TemplateLibraryModalProps) {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'All'>('All');
    const [modeFilter, setModeFilter] = useState('all');
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return TEMPLATES.filter((t) => {
            // Category
            if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
            // Mode
            if (modeFilter !== 'all' && t.modeId !== modeFilter) return false;
            // Search
            if (q) {
                const haystack = `${t.title} ${t.tags.join(' ')}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [search, categoryFilter, modeFilter]);

    const handleSelect = (template: Template) => {
        onSelectTemplate(template);
        setPreviewTemplate(null);
        setSearch('');
        setCategoryFilter('All');
        setModeFilter('all');
        onClose();
    };

    // Preview view
    if (previewTemplate) {
        const mode = IDENTITY_MODES.find((m) => m.id === previewTemplate.modeId);

        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Template Preview">
                <div className="space-y-4">
                    <div>
                        <h3 className="font-serif text-lg font-semibold text-forest-700">
                            {previewTemplate.title}
                        </h3>
                        <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-xs bg-forest-100 text-forest-600 px-2 py-0.5 rounded-full">
                                {previewTemplate.category}
                            </span>
                            {mode && (
                                <span className="text-xs bg-forest-100 text-forest-600 px-2 py-0.5 rounded-full">
                                    {mode.icon} {mode.label}
                                </span>
                            )}
                            {previewTemplate.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="text-xs bg-parchment-300 text-forest-500 px-2 py-0.5 rounded-full"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="bg-parchment-100 rounded-lg p-4 border border-forest-100">
                        <p className="text-sm text-forest-700 leading-relaxed whitespace-pre-wrap">
                            {previewTemplate.text}
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setPreviewTemplate(null)}
                            className="flex-1 py-2 text-forest-500 hover:text-forest-700 font-medium transition-colors"
                        >
                            ← Back
                        </button>
                        <button
                            onClick={() => handleSelect(previewTemplate)}
                            className="flex-[2] py-2 bg-forest-600 text-parchment-100 rounded-xl font-bold hover:bg-forest-700 transition-colors shadow-lg shadow-forest-200"
                        >
                            Use This Template
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }

    // List view
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📚 Template Library">
            <div className="space-y-4">
                {/* Search */}
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="input-field py-2 text-sm"
                />

                {/* Category pills */}
                <div className="flex flex-wrap gap-1.5">
                    {CATEGORY_FILTERS.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => setCategoryFilter(c.id)}
                            className={`px-3 py-1 text-xs rounded-full transition-colors ${categoryFilter === c.id
                                    ? 'bg-forest-700 text-parchment-100'
                                    : 'bg-parchment-300 text-forest-600 hover:bg-parchment-400'
                                }`}
                        >
                            {c.icon} {c.label}
                        </button>
                    ))}
                </div>

                {/* Mode filter */}
                <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    className="input-field text-sm py-1.5"
                >
                    <option value="all">All Modes</option>
                    {IDENTITY_MODES.map((m) => (
                        <option key={m.id} value={m.id}>
                            {m.icon} {m.label}
                        </option>
                    ))}
                </select>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto space-y-2 -mx-1 px-1">
                    {filtered.length === 0 && (
                        <p className="text-sm text-forest-400 text-center py-8">
                            No templates match your search.
                        </p>
                    )}
                    {filtered.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setPreviewTemplate(t)}
                            className="w-full text-left p-3 bg-parchment-100 rounded-lg border border-forest-100 hover:border-forest-300 hover:shadow-sm transition-all"
                        >
                            <p className="font-medium text-sm text-forest-700">{t.title}</p>
                            <p className="text-xs text-forest-500 mt-0.5 line-clamp-1">
                                {t.text}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {t.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag}
                                        className="text-[10px] bg-parchment-300 text-forest-500 px-1.5 py-0.5 rounded-full"
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
}
