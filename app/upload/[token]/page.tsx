"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function PublicUploadPage({ params }: { params: { token: string } }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const supabase = createClient();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      // 1. Storageにアップロード
      const filePath = `answers/${params.token}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("images") // ※事前にimagesバケットをpublicで作成してください
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. DBの状態を更新
      await supabase
        .from("upload_requests")
        .update({ image_path: filePath, status: "uploaded" })
        .eq("token", params.token);

      setCompleted(true);
    } catch (e) {
      alert("アップロード失敗");
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-green-800">提出完了しました！</h1>
          <p className="text-gray-600 mt-2">画面を閉じてください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6 text-center">
          答案画像の提出 📸
        </h1>
        
        <input
          type="file"
          accept="image/*"
          capture="environment" // スマホでカメラを起動
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-500 mb-6 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow disabled:opacity-50"
        >
          {uploading ? "送信中..." : "アップロードする"}
        </button>
      </div>
    </div>
  );
}