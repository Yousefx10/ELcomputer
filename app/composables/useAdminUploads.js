export const useAdminUploads = () => {
  const { getAdminAuthHeaders } = useAdminLogs()

  const uploadImage = async (file, section) => {
    if (!file) {
      throw new Error('Choose an image file first.')
    }

    const formData = new FormData()
    formData.append('section', section)
    formData.append('file', file)

    return await $fetch('/api/admin-uploads', {
      method: 'POST',
      headers: await getAdminAuthHeaders(),
      body: formData
    })
  }

  const fetchGalleryImages = async (query = {}) => {
    return await $fetch('/api/admin-gallery', {
      query,
      headers: await getAdminAuthHeaders()
    })
  }

  const deleteGalleryImage = async (path) => {
    return await $fetch('/api/admin-gallery', {
      method: 'DELETE',
      headers: await getAdminAuthHeaders(),
      body: {
        path
      }
    })
  }

  return {
    uploadImage,
    fetchGalleryImages,
    deleteGalleryImage
  }
}
