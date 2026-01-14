"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createUploadUrl } from "./actions";

export default function UploadQrPanel({ userId, studentName }: { userId: string, studentName: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setIsOpen(true); // パネルを開く
    try {
      const generatedUrl = await createUploadUrl(userId);
      setUrl(generatedUrl);
    } catch (e) {
      alert("発行に失敗しました");
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const closePanel = () => {
    setIsOpen(false);
    setUrl(null);
  };

  return (
    <>
      {/* 発行ボタン */}
      <button 
        onClick={handleGenerate}
        className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold shadow hover:bg-gray-700 transition flex items-center gap-2 text-sm"
      >
        📱 答案提出QRを発行
      </button>

      {/* モーダル表示 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full text-center relative animate-fade-in">
            
            {/* 閉じるボタン */}
            <button 
              onClick={closePanel}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold text-xl"
            >
              ×
            </button>

            <h3 className="text-lg font-bold text-gray-800 mb-2">答案アップロード</h3>
            <p className="text-sm text-gray-500 mb-6">
              生徒のスマホで以下のQRを読み取ってください。<br/>
              対象: <span className="font-bold">{studentName}</span>
            </p>

            <div className="flex justify-center mb-6 bg-white p-2 rounded">
              {loading ? (
                <div className="w-48 h-48 flex items-center justify-center text-gray-400">
                  発行中...
                </div>
              ) : url ? (
                <QRCodeSVG value={url} size={200} />
              ) : (
                <div className="w-48 h-48 bg-gray-100 rounded"></div>
              )}
            </div>

            {url && (
              <div className="text-left bg-gray-50 p-3 rounded text-xs break-all text-gray-500 mb-4">
                {url}
              </div>
            )}

            <p className="text-xs text-red-500">
              ※ このQRコードは24時間有効です。<br/>
              ※ ログイン不要で画像を送信できます。
            </p>
          </div>
        </div>
      )}
    </>
  );
}