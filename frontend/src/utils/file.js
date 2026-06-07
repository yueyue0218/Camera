export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('')
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('照片读取失败'))
    reader.readAsDataURL(file)
  })
}

export function compressImageToDataUrl(file, maxWidthOrHeight = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(''); return }
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width >= height) {
          height = Math.round(height * maxWidthOrHeight / width)
          width = maxWidthOrHeight
        } else {
          width = Math.round(width * maxWidthOrHeight / height)
          height = maxWidthOrHeight
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('照片读取失败')) }
    img.src = objectUrl
  })
}
