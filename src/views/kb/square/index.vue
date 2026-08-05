<template>
  <ContentWrap title="知识库广场">
    <!-- 搜索工作栏 -->
    <el-form :inline="true" label-width="68px">
      <el-form-item label="知识库名称" prop="name">
        <el-input
          v-model="queryParams.name"
          placeholder="请输入知识库名称"
          clearable
          @keyup.enter="handleQuery"
          class="!w-240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button @click="handleQuery"><Icon icon="ep:search" class="mr-5px" /> 搜索</el-button>
        <el-button @click="resetQuery"><Icon icon="ep:refresh" class="mr-5px" /> 重置</el-button>
      </el-form-item>
    </el-form>
  </ContentWrap>

  <!-- Tab 切换 -->
  <ContentWrap>
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="全部公开" name="all" />
      <el-tab-pane label="我公开的" name="my" />
      <el-tab-pane label="我关注的" name="followed" />
    </el-tabs>

    <el-table v-loading="loading" :data="list" :stripe="true" :show-overflow-tooltip="true">
      <el-table-column label="知识库名称" align="center" prop="name" min-width="180" />
      <el-table-column label="描述" align="center" prop="description" min-width="200" show-overflow-tooltip />
      <el-table-column label="文档数" align="center" prop="docCount" width="80" />
      <el-table-column label="创建时间" align="center" prop="createTime" :formatter="dateFormatter" width="180" />
      <el-table-column label="操作" align="center" width="120">
        <template #default="scope">
          <el-button
            v-if="activeTab !== 'my'"
            link
            :type="scope.row.isFollowed ? 'danger' : 'primary'"
            @click="handleToggleFollow(scope.row)"
          >
            {{ scope.row.isFollowed ? '取消关注' : '关注' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <Pagination
      :total="total"
      v-model:page="queryParams.pageNo"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />
  </ContentWrap>
</template>

<script setup lang="ts">
import { dateFormatter } from '@/utils/formatTime'
import { LibraryApi, Library } from '@/api/kb/library'
import { FollowApi } from '@/api/kb/follow'

defineOptions({ name: 'KnowledgeSquare' })

const loading = ref(true)
const list = ref<(Library & { isFollowed?: boolean })[]>([])
const total = ref(0)
const activeTab = ref('all')
const queryParams = reactive({
  pageNo: 1,
  pageSize: 10,
  name: undefined
})

/** 查询列表 */
const getList = async () => {
  loading.value = true
  try {
    let data: any
    if (activeTab.value === 'all') {
      data = await LibraryApi.getPublicPage(queryParams)
    } else if (activeTab.value === 'my') {
      data = await LibraryApi.getMyPublicPage(queryParams)
    } else {
      // 我关注的：调用后端分页接口
      data = await FollowApi.getMyFollowedPage(queryParams)
    }
    list.value = (data.list || []).map((item: any) => ({ ...item, isFollowed: activeTab.value === 'followed' || item.isFollowed }))
    total.value = data.total
  } finally {
    loading.value = false
  }
}

/** Tab 切换 */
const handleTabChange = () => {
  queryParams.pageNo = 1
  getList()
}

/** 搜索 */
const handleQuery = () => {
  queryParams.pageNo = 1
  getList()
}

/** 重置 */
const resetQuery = () => {
  queryParams.name = undefined
  queryParams.pageNo = 1
  getList()
}

/** 关注/取消关注 */
const handleToggleFollow = async (row: Library & { isFollowed?: boolean }) => {
  try {
    if (row.isFollowed) {
      await FollowApi.unfollow(row.id)
    } else {
      await FollowApi.follow(row.id)
    }
    row.isFollowed = !row.isFollowed
    // 如果在我关注的tab取消关注，刷新列表
    if (activeTab.value === 'followed' && !row.isFollowed) {
      getList()
    }
  } catch {}
}

onMounted(() => {
  getList()
})
</script>
