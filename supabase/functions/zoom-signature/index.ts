// supabase/functions/zoom-signature/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { KJUR } from "https://deno.land/x/jsrsasign@1.0.5/jsrsasign.js"

console.log("Zoom Signature Function Up!")

// CORS設定（Next.jsからのアクセスを許可するため）
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. CORS対応 (ブラウザからのプリフライトリクエスト用)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. リクエストボディの解析
    const { meetingNumber, role } = await req.json()

    // 3. 環境変数の取得 (Zoom Client ID / Secret)
    const CLIENT_ID = Deno.env.get('ZOOM_CLIENT_ID')
    const CLIENT_SECRET = Deno.env.get('ZOOM_CLIENT_SECRET')

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Server configuration error: Missing Zoom credentials')
    }
    if (!meetingNumber) {
      throw new Error('Missing meetingNumber')
    }

    // 4. 署名(Signature)の生成ロジック
    // ※時刻は「現在時刻 - 30秒」にしてサーバー間の時刻ズレを防ぐのが定石
    const iat = Math.round(new Date().getTime() / 1000) - 30
    const exp = iat + 60 * 60 * 2 // 有効期限: 2時間

    const header = { alg: 'HS256', typ: 'JWT' }
    const payload = {
      sdkKey: CLIENT_ID,
      mn: meetingNumber,
      role: role || 0, // 指定がなければ 0 (参加者)
      iat: iat,
      exp: exp,
      appKey: CLIENT_ID,
      tokenExp: exp
    }

    const sHeader = JSON.stringify(header)
    const sPayload = JSON.stringify(payload)
    
    // HS256アルゴリズムで署名を作成
    const signature = KJUR.jws.JWS.sign('HS256', sHeader, sPayload, CLIENT_SECRET)

    // 5. 結果を返す
    return new Response(
      JSON.stringify({ signature, sdkKey: CLIENT_ID }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})