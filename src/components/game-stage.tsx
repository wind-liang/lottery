import type { Database } from '@/lib/supabase'

type Room = Database['public']['Tables']['rooms']['Row']

interface GameStageProps {
  stage: Room['stage']
}

const stageNames = {
  waiting: '等待开始',
  lottery: '抽奖阶段',
  reward_selection: '奖励选择',
  final_lottery: '绝地翻盘',
  finished: '游戏结束'
}

const stageColors = {
  waiting: 'bg-blue-500',
  lottery: 'bg-yellow-500',
  reward_selection: 'bg-green-500',
  final_lottery: 'bg-red-500',
  finished: 'bg-purple-500'
}

export function GameStage({ stage }: GameStageProps) {
  return (
    <div className="sticky top-0 z-50 bg-white/20 backdrop-blur-sm border-b border-gray-300/50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${stageColors[stage]} animate-pulse`}></div>
            <span className="text-gray-800 font-medium text-sm">
              {stageNames[stage]}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
} 