'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { cancelTicket } from '@/app/units/[id]/dialogue-actions';

interface TicketWaitingViewProps {
    ticketId: string;
    onAssigned: (roomName: string) => void;
    onCancelled: () => void;
    onNavigateToZoom?: () => void; // Zoom画面に移動時のコールバック
}

interface TicketData {
    id: string;
    status: string;
    instructors: {
        assigned_room_name: string;
    } | null;
}

/**
 * チケット待機UI
 * 
 * チケット作成後に表示され、講師が対応するまで待機。
 * Supabase Realtimeで status を監視し、assigned になったらZoom案内を表示。
 */
export default function TicketWaitingView({
    ticketId,
    onAssigned,
    onCancelled,
    onNavigateToZoom,
}: TicketWaitingViewProps) {
    const router = useRouter();
    const [status, setStatus] = useState<'waiting' | 'assigned' | 'cancelled'>('waiting');
    const [roomName, setRoomName] = useState<string | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);
    const [waitSeconds, setWaitSeconds] = useState(0);

    const supabase = createClient();

    // 待ち時間カウンター
    useEffect(() => {
        const interval = setInterval(() => {
            setWaitSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Realtime購読
    useEffect(() => {
        // 初回フェッチ
        const fetchTicket = async () => {
            const { data } = await supabase
                .from('support_tickets')
                .select(`
          id,
          status,
          instructors (
            assigned_room_name
          )
        `)
                .eq('id', ticketId)
                .single();

            if (data) {
                handleTicketUpdate(data as unknown as TicketData);
            }
        };

        fetchTicket();

        // Realtime購読
        const channel = supabase
            .channel(`ticket-${ticketId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'support_tickets',
                    filter: `id=eq.${ticketId}`,
                },
                async (payload) => {
                    // 更新後のデータを再フェッチ（instructor情報を含むため）
                    const { data } = await supabase
                        .from('support_tickets')
                        .select(`
              id,
              status,
              instructors (
                assigned_room_name
              )
            `)
                        .eq('id', ticketId)
                        .single();

                    if (data) {
                        handleTicketUpdate(data as unknown as TicketData);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [ticketId]);

    const handleTicketUpdate = (ticket: TicketData) => {
        if (ticket.status === 'assigned') {
            setStatus('assigned');
            const room = ticket.instructors?.assigned_room_name || '講師ルーム';
            setRoomName(room);
            onAssigned(room);
        } else if (ticket.status === 'cancelled') {
            setStatus('cancelled');
            onCancelled();
        }
    };

    const handleCancel = async () => {
        setIsCancelling(true);
        try {
            await cancelTicket(ticketId);
            setStatus('cancelled');
            onCancelled();
        } catch (e) {
            console.error('Cancel failed:', e);
            setIsCancelling(false);
        }
    };

    const formatWaitTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 講師が割り当てられた場合
    if (status === 'assigned' && roomName) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
                    {/* ヘッダー */}
                    <div className="bg-gradient-to-r from-green-400 to-emerald-500 p-6 text-center">
                        <div className="text-6xl mb-2">🎉</div>
                        <h2 className="text-2xl font-bold text-white drop-shadow-md">
                            先生が見つかりました！
                        </h2>
                    </div>

                    {/* コンテンツ */}
                    <div className="p-6">
                        <div className="bg-emerald-50 rounded-xl p-6 text-center mb-6">
                            <p className="text-sm text-emerald-700 font-medium mb-2">
                                以下のルームに入室してください：
                            </p>
                            <div className="bg-white rounded-lg p-4 border-2 border-emerald-300">
                                <p className="text-2xl font-bold text-emerald-600">
                                    「{roomName}」
                                </p>
                            </div>
                        </div>

                        <div className="bg-amber-50 rounded-lg p-4 mb-6">
                            <p className="text-sm text-amber-800">
                                <span className="font-bold">📌 手順：</span>
                                <br />
                                1. Zoomに入室
                                <br />
                                2. ブレイクアウトルーム一覧を開く
                                <br />
                                3. <span className="font-bold">「{roomName}」</span>を選択
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                onNavigateToZoom?.();
                                router.push('/zoom');
                            }}
                            className="block w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-lg rounded-xl text-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                        >
                            🚀 Zoomを開く
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 待機中
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                {/* ヘッダー */}
                <div className="bg-gradient-to-r from-blue-400 to-indigo-500 p-6 text-center">
                    <div className="text-6xl mb-2 animate-bounce">⏳</div>
                    <h2 className="text-2xl font-bold text-white drop-shadow-md">
                        先生を探しています...
                    </h2>
                </div>

                {/* コンテンツ */}
                <div className="p-6">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full px-6 py-3">
                            <div className="flex gap-1">
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                            </div>
                            <span className="text-gray-600 font-medium">
                                待ち時間: {formatWaitTime(waitSeconds)}
                            </span>
                        </div>
                    </div>

                    <p className="text-gray-600 text-center mb-6 leading-relaxed">
                        講師が対応可能になり次第、
                        <br />
                        自動的にお知らせします。
                    </p>

                    <button
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="w-full py-3 text-gray-500 font-medium hover:text-red-500 transition-colors border border-gray-200 rounded-lg hover:border-red-200 disabled:opacity-50"
                    >
                        {isCancelling ? 'キャンセル中...' : 'キャンセルする'}
                    </button>
                </div>
            </div>
        </div>
    );
}
