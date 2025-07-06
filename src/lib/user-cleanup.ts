import { supabase } from './supabase'

// 清理长时间离线的用户（超过30分钟）
export async function cleanupOfflineUsers() {
  try {
    console.log('🧹 [Cleanup] 开始清理长时间离线用户...')
    
    // 计算30分钟前的时间
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    
    // 查找长时间离线的用户
    const { data: offlineUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, nickname, updated_at')
      .eq('is_online', false)
      .lt('updated_at', thirtyMinutesAgo.toISOString())
    
    if (fetchError) {
      console.error('❌ [Cleanup] 查找离线用户失败:', fetchError)
      return
    }
    
    if (!offlineUsers || offlineUsers.length === 0) {
      console.log('✅ [Cleanup] 没有需要清理的离线用户')
      return
    }
    
    console.log(`🧹 [Cleanup] 找到 ${offlineUsers.length} 个长时间离线用户:`, offlineUsers.map(u => u.nickname))
    
    // 删除长时间离线的用户
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('is_online', false)
      .lt('updated_at', thirtyMinutesAgo.toISOString())
    
    if (deleteError) {
      console.error('❌ [Cleanup] 删除离线用户失败:', deleteError)
      return
    }
    
    console.log(`✅ [Cleanup] 成功清理了 ${offlineUsers.length} 个长时间离线用户`)
  } catch (error) {
    console.error('❌ [Cleanup] 清理离线用户异常:', error)
  }
}

// 标记长时间无活动的用户为离线（超过2分钟）
export async function markInactiveUsersOffline() {
  try {
    console.log('🔄 [Cleanup] 开始标记无活动用户为离线...')
    
    // 计算2分钟前的时间
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
    
    // 查找长时间无活动的在线用户
    const { data: inactiveUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, nickname, updated_at')
      .eq('is_online', true)
      .lt('updated_at', twoMinutesAgo.toISOString())
    
    if (fetchError) {
      console.error('❌ [Cleanup] 查找无活动用户失败:', fetchError)
      return
    }
    
    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('✅ [Cleanup] 没有需要标记为离线的用户')
      return
    }
    
    console.log(`🔄 [Cleanup] 找到 ${inactiveUsers.length} 个无活动用户:`, inactiveUsers.map(u => u.nickname))
    
    // 标记为离线
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_online: false,
        updated_at: new Date().toISOString()
      })
      .eq('is_online', true)
      .lt('updated_at', twoMinutesAgo.toISOString())
    
    if (updateError) {
      console.error('❌ [Cleanup] 标记用户离线失败:', updateError)
      return
    }
    
    console.log(`✅ [Cleanup] 成功标记了 ${inactiveUsers.length} 个用户为离线`)
  } catch (error) {
    console.error('❌ [Cleanup] 标记用户离线异常:', error)
  }
}

// 综合清理函数
export async function performUserCleanup() {
  console.log('🚀 [Cleanup] 开始执行用户清理任务...')
  
  // 先标记无活动用户为离线
  await markInactiveUsersOffline()
  
  // 再清理长时间离线用户
  await cleanupOfflineUsers()
  
  console.log('✅ [Cleanup] 用户清理任务完成')
} 