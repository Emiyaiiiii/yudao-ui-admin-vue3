<template>
  <div class="change-avatar">
    <CropperAvatar
      ref="cropperRef"
      :btnProps="{ preIcon: 'ant-design:cloud-upload-outlined' }"
      :showBtn="false"
      :value="img"
      width="120px"
      @change="handelUpload"
    />
  </div>
</template>
<script lang="ts" setup>
import { propTypes } from '@/utils/propTypes'
import { getUserProfile, updateUserProfile } from '@/api/system/user/profile'
import { CropperAvatar } from '@/components/Cropper'
import { useUserStore } from '@/store/modules/user'
import { useUpload } from '@/components/UploadFile/src/useUpload'
import { UploadRequestOptions } from 'element-plus/es/components/upload/src/upload'

defineOptions({ name: 'UserAvatar' })

defineProps({
  img: propTypes.string.def('')
})

const userStore = useUserStore()

const cropperRef = ref()
const handelUpload = async ({ data }) => {
  const { httpRequest } = useUpload()
  const avatar = (
    (await httpRequest({
      file: data,
      filename: 'avatar.png'
    } as UploadRequestOptions)) as unknown as { data: string }
  ).data
  await updateUserProfile({ avatar })

  // 关闭弹窗，并更新 userStore
  // 注意：私有桶返回的是预签名 URL，需要回查接口拿到刷新后的地址再做缓存
  cropperRef.value.close()
  const profile = await getUserProfile()
  await userStore.setUserAvatarAction(profile.avatar)
}
</script>

<style lang="scss" scoped>
.change-avatar {
  img {
    display: block;
    margin-bottom: 15px;
    border-radius: 50%;
  }
}
</style>
