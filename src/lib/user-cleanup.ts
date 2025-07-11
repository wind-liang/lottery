import { supabase } from './supabase'

// 清理长时间离线的用户（超过30分钟）
export async function cleanupOfflineUsers() {
  try {
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
      return
    }
    
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
  } catch (error) {
    console.error('❌ [Cleanup] 清理离线用户异常:', error)
  }
}

// 标记长时间无活动的用户为离线（超过2分钟）
export async function markInactiveUsersOffline() {
  try {
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
      return
    }
    
    // 标记为离线
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_online: false
      })
      .eq('is_online', true)
      .lt('updated_at', twoMinutesAgo.toISOString())
    
    if (updateError) {
      console.error('❌ [Cleanup] 标记用户离线失败:', updateError)
      return
    }
  } catch (error) {
    console.error('❌ [Cleanup] 标记用户离线异常:', error)
  }
}

// 综合清理函数
export async function performUserCleanup() {
  // 先标记无活动用户为离线
  await markInactiveUsersOffline()
  
  // 再清理长时间离线用户
  await cleanupOfflineUsers()
} 