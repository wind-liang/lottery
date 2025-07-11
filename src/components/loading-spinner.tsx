export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 to-rose-200 flex items-center justify-center">
      <div className="text-gray-800 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-pink-500 mx-auto mb-4"></div>
        <p className="text-lg font-medium">正在加载...</p>
      </div>
    </div>
  )
} 