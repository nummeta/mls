'use client';

import { useState } from 'react';

interface DialoguePromptModalProps {
    isOpen: boolean;
    pendingUnitNames: string[];
    onAccept: () => void;
    onSkip: () => void;
    isLoading?: boolean;
}

/**
 * 対話誘導モーダル
 * 
 * 単元完了時に表示され、講師との対話を促すポジティブなUI。
 * - 「挑戦する」→ チケット作成 → 待機画面へ
 * - 「後でやる」→ 次の単元へ
 */
export default function DialoguePromptModal({
    isOpen,
    pendingUnitNames,
    onAccept,
    onSkip,
    isLoading = false,
}: DialoguePromptModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* オーバーレイ - クリックしても閉じない（「後でやる」ボタンのみで閉じる） */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* モーダル本体 */}
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
                {/* ヘッダー装飾 */}
                <div className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 p-6 text-center">
                    <div className="text-6xl mb-2">🎓</div>
                    <h2 className="text-2xl font-bold text-white drop-shadow-md">
                        先生に説明しよう！
                    </h2>
                </div>

                {/* コンテンツ */}
                <div className="p-6">
                    <p className="text-gray-700 text-center mb-4 leading-relaxed">
                        学んだことを先生に説明すると、
                        <br />
                        <span className="font-bold text-orange-600">理解がグッと深まります！</span>
                    </p>

                    {/* 対象単元リスト */}
                    {pendingUnitNames.length > 0 && (
                        <div className="bg-amber-50 rounded-lg p-4 mb-6">
                            <p className="text-sm text-amber-800 font-bold mb-2">
                                📚 説明できる単元：
                            </p>
                            <ul className="space-y-1">
                                {pendingUnitNames.map((name, index) => (
                                    <li
                                        key={index}
                                        className="text-sm text-amber-700 flex items-center gap-2"
                                    >
                                        <span className="w-5 h-5 bg-amber-200 rounded-full flex items-center justify-center text-xs font-bold">
                                            {index + 1}
                                        </span>
                                        {name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* ボタン */}
                    <div className="space-y-3">
                        <button
                            onClick={onAccept}
                            disabled={isLoading}
                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold text-lg rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    準備中...
                                </span>
                            ) : (
                                "🙋 挑戦する！"
                            )}
                        </button>

                        <button
                            onClick={onSkip}
                            disabled={isLoading}
                            className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            後でやる
                        </button>
                    </div>

                    {/* 補足テキスト */}
                    <p className="text-xs text-gray-400 text-center mt-4">
                        ※ 講師が空いている時に呼び出されます
                    </p>
                </div>
            </div>
        </div>
    );
}
