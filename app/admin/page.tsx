export default function AdminDashboard() {
    return (
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-8">ダッシュボード</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ステータスカード1 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-bold mb-2">システム状態</h3>
            <p className="text-2xl font-bold text-green-600">正常稼働中 ✅</p>
          </div>
  
          {/* ステータスカード2 */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-bold mb-2">管理者権限</h3>
            <p className="text-2xl font-bold text-blue-600">Active</p>
          </div>
        </div>
  
        <div className="mt-12 bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center">
          <p className="text-gray-600 mb-4">
            左のメニューから管理したい項目を選んでください。
          </p>
        </div>
      </div>
    );
  }