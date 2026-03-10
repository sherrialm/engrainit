'use client';

import { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { ShareData, generateShareText } from '@/services/ShareService';
import { Modal } from '@/components/Modal';

// ── Props ─────────────────────────────────────────────────────

interface ShareProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: ShareData | null;
}

// ── Component ─────────────────────────────────────────────────

export default function ShareProgressModal({
    isOpen,
    onClose,
    data,
}: ShareProgressModalProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState<'image' | 'text' | null>(null);

    if (!data) return null;

    const handleCopyImage = async () => {
        if (!cardRef.current) return;
        try {
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 2,
                backgroundColor: '#2d5016',
            });

            // Convert to blob for clipboard
            const res = await fetch(dataUrl);
            const blob = await res.blob();

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
            ]);

            setCopied('image');
            setTimeout(() => setCopied(null), 2000);
        } catch (err) {
            console.warn('[Share] Image copy failed, falling back to text:', err);
            handleCopyText();
        }
    };

    const handleCopyText = async () => {
        const text = generateShareText(data);
        try {
            await navigator.clipboard.writeText(text);
            setCopied('text');
            setTimeout(() => setCopied(null), 2000);
        } catch {
            // Last resort: prompt-based copy
            prompt('Copy this text:', text);
        }
    };

    const handleDownloadImage = async () => {
        if (!cardRef.current) return;
        try {
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 2,
                backgroundColor: '#2d5016',
            });
            const link = document.createElement('a');
            link.download = `engrainit-progress-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.warn('[Share] Download failed:', err);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Share Your Progress">
            <div className="space-y-4">
                {/* Share Card (this gets exported as PNG) */}
                <div
                    ref={cardRef}
                    className="rounded-xl p-6 text-center"
                    style={{
                        background: 'linear-gradient(135deg, #2d5016 0%, #1a3a0a 100%)',
                        color: '#f5f0e8',
                    }}
                >
                    <p className="text-xs font-medium tracking-widest uppercase opacity-70 mb-4">
                        Identity Reinforcement
                    </p>

                    <div className="space-y-3 mb-5">
                        {data.streak > 0 && (
                            <div>
                                <p className="text-4xl font-bold">🔥 {data.streak}</p>
                                <p className="text-sm opacity-80 mt-0.5">Reinforcement Days</p>
                            </div>
                        )}

                        {data.minutesEngrained > 0 && (
                            <div>
                                <p className="text-2xl font-bold">🧠 {data.minutesEngrained}m</p>
                                <p className="text-sm opacity-80 mt-0.5">Minutes Engrained</p>
                            </div>
                        )}

                        {data.favoriteModeName && (
                            <div>
                                <p className="text-lg font-semibold">⭐ {data.favoriteModeName}</p>
                                <p className="text-sm opacity-80 mt-0.5">Favorite Mode</p>
                            </div>
                        )}

                        {data.routineActive && (
                            <p className="text-sm font-medium opacity-80">
                                🗓 Guided Routine Active
                            </p>
                        )}
                    </div>

                    <div className="pt-3 border-t border-white/20">
                        <p className="text-xs opacity-60">Built with EngrainIt</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={handleCopyImage}
                        className="w-full py-2.5 bg-forest-600 text-parchment-100 rounded-xl font-bold hover:bg-forest-700 transition-colors"
                    >
                        {copied === 'image' ? '✅ Image Copied!' : '📋 Copy Image'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDownloadImage}
                        className="w-full py-2 text-sm font-medium text-forest-600 bg-parchment-300 hover:bg-parchment-400 rounded-xl transition-colors"
                    >
                        💾 Download PNG
                    </button>
                    <button
                        type="button"
                        onClick={handleCopyText}
                        className="w-full py-2 text-sm font-medium text-forest-600 bg-parchment-300 hover:bg-parchment-400 rounded-xl transition-colors"
                    >
                        {copied === 'text' ? '✅ Text Copied!' : '📝 Copy as Text'}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2 text-sm text-forest-500 hover:text-forest-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </Modal>
    );
}
