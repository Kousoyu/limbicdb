#!/usr/bin/env node
/**
 * LimbicDB 核心功能验证脚本
 * 
 * 运行: node scripts/verify.js
 */

import { open } from '../src/index.js'

async function runTest(name, testFn) {
  try {
    await testFn()
    console.log(`✅ ${name}`)
    return true
  } catch (error) {
    console.log(`❌ ${name}:`, error.message)
    return false
  }
}

async function main() {
  console.log('🧠 LimbicDB 核心功能验证\n')
  
  const db = open(':memory:')
  let allPassed = true
  
  // 测试 1: 基本记忆操作
  allPassed &= await runTest('remember() 基础功能', async () => {
    const memory = await db.remember('测试记忆内容')
    if (!memory.id) throw new Error('记忆缺少ID')
    if (memory.content !== '测试记忆内容') throw new Error('记忆内容不匹配')
    if (!memory.kind) throw new Error('记忆缺少类型')
  })
  
  // 测试 2: 记忆分类
  allPassed &= await runTest('自动记忆分类', async () => {
    const tests = [
      { content: '用户喜欢React', expectedKind: 'preference' },
      { content: 'API运行在3000端口', expectedKind: 'fact' },
      { content: '昨天开了会议', expectedKind: 'episode' },
      { content: '先npm install再npm start', expectedKind: 'procedure' },
      { content: '周五前完成', expectedKind: 'goal' },
    ]
    
    for (const test of tests) {
      const mem = await db.remember(test.content)
      if (mem.kind !== test.expectedKind) {
        console.log(`  分类不匹配: "${test.content}" -> ${mem.kind} (期望: ${test.expectedKind})`)
      }
    }
  })
  
  // 测试 3: 记忆检索
  allPassed &= await runTest('recall() 检索功能', async () => {
    await db.remember('项目使用TypeScript开发')
    await db.remember('用户偏好Python')
    
    const results = await db.recall('TypeScript')
    if (results.length === 0) throw new Error('未检索到相关记忆')
    
    const hasMatch = results.some(mem => mem.content.includes('TypeScript'))
    if (!hasMatch) throw new Error('检索结果不包含关键词')
  })
  
  // 测试 4: 状态存储
  allPassed &= await runTest('状态存储 get/set', async () => {
    const testData = { count: 42, name: '测试' }
    await db.set('testKey', testData)
    
    const retrieved = await db.get('testKey')
    if (!retrieved) throw new Error('获取状态失败')
    if (retrieved.count !== 42) throw new Error('状态数据损坏')
  })
  
  // 测试 5: 时间线记录
  allPassed &= await runTest('时间线记录', async () => {
    await db.remember('时间线测试记忆')
    await db.set('timelineTest', { value: 1 })
    
    const events = await db.history({ limit: 2 })
    if (events.length < 2) throw new Error('时间线记录不足')
    
    const hasMemoryEvent = events.some(e => e.type === 'memory')
    const hasStateEvent = events.some(e => e.type === 'state')
    
    if (!hasMemoryEvent || !hasStateEvent) {
      throw new Error('时间线事件类型不完整')
    }
  })
  
  // 测试 6: 统计信息
  allPassed &= await runTest('统计信息', async () => {
    const stats = db.stats
    if (typeof stats.memoryCount !== 'number') throw new Error('记忆计数无效')
    if (typeof stats.stateKeyCount !== 'number') throw new Error('状态键计数无效')
  })
  
  // 清理
  await db.close()
  
  console.log('\n' + '='.repeat(40))
  if (allPassed) {
    console.log('🎉 所有核心功能验证通过!')
    console.log('📦 项目可以安全发布')
  } else {
    console.log('⚠️  部分测试未通过，请检查实现')
    process.exit(1)
  }
  
  console.log('\n💡 下一步:')
  console.log('1. git init && git add . && git commit -m "initial commit"')
  console.log('2. 创建 GitHub 仓库: github.com/new')
  console.log('3. git remote add origin && git push')
  console.log('4. npm run build')
  console.log('5. npm publish --tag alpha (需要登录)')
}

main().catch(error => {
  console.error('验证脚本出错:', error)
  process.exit(1)
})