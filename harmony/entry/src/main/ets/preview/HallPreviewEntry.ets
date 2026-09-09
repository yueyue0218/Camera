// DevEco Previewer only accepts entries under src/main/ets. This file contains
// no fixture data and is not listed in main_pages.json, so the production app
// cannot navigate to it. Preview fixtures remain under ohosTest/preview.
import {
  HallDemandPreviewFrame,
  HallEdgeCasesPreviewFrame,
  HallEmptyPreviewFrame,
  HallErrorPreviewFrame,
  HallLoadingPreviewFrame,
  HallPreviewFrame
} from '../../../ohosTest/ets/preview/HallPreview';

// Page preview is interactive (tap, switch tabs, and scroll). The component
// previews below remain the fixed-size visual regression views.
@Entry
@Component
struct HallPreviewInteractive {
  build() {
    Column() {
      HallPreviewFrame()
    }
    .width('100%')
    .height('100%')
  }
}

@Preview({
  title: 'Portra Hall · 360vp',
  width: 1080,
  height: 2400,
  dpi: 480,
  locale: 'zh_CN'
})
@Component
struct HallPreview360 {
  build() {
    HallPreviewFrame()
  }
}

@Preview({
  title: 'Portra Hall · 390vp',
  width: 1170,
  height: 2532,
  dpi: 480,
  locale: 'zh_CN'
})
@Component
struct HallPreview390 {
  build() {
    HallPreviewFrame()
  }
}

@Preview({
  title: 'Portra Hall · 430vp',
  width: 1290,
  height: 2796,
  dpi: 480,
  locale: 'zh_CN'
})
@Component
struct HallPreview430 {
  build() {
    HallPreviewFrame()
  }
}

@Preview({
  title: 'Portra Demands · 360vp',
  width: 1080,
  height: 2400,
  dpi: 480,
  locale: 'zh_CN'
})
@Component
struct HallDemandPreview360 {
  build() {
    HallDemandPreviewFrame()
  }
}

@Preview({
  title: 'Portra Demands · 390vp',
  width: 1170,
  height: 2532,
  dpi: 480,
  locale: 'zh_CN'
})
@Component
struct HallDemandPreview390 {
  build() {
    HallDemandPreviewFrame()
  }
}

@Preview({
  title: 'Portra Demands · 430vp',
  width: 1290,
  height: 2796,
  dpi: 480,
  locale: 'zh_CN'
})
@Component
struct HallDemandPreview430 {
  build() {
    HallDemandPreviewFrame()
  }
}

@Preview({ title: 'Portra Hall · Loading', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct HallLoadingPreview {
  build() {
    HallLoadingPreviewFrame()
  }
}

@Preview({ title: 'Portra Hall · Empty', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct HallEmptyPreview {
  build() {
    HallEmptyPreviewFrame()
  }
}

@Preview({ title: 'Portra Hall · Error', width: 1170, height: 2532, dpi: 480, locale: 'zh_CN' })
@Component
struct HallErrorPreview {
  build() {
    HallErrorPreviewFrame()
  }
}

@Preview({ title: 'Portra Hall · Edge cases', width: 1080, height: 2400, dpi: 480, locale: 'zh_CN' })
@Component
struct HallEdgeCasesPreview {
  build() {
    HallEdgeCasesPreviewFrame()
  }
}
