export default {
  mounted(el) {
    const scrollWrap = el.querySelector('.el-scrollbar__wrap')

    if (!scrollWrap) return

    scrollWrap.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
        scrollWrap.scrollLeft += e.deltaY
      }
    })
  }
}
