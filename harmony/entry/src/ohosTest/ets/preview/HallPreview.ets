import { PortraBottomNav } from '../../../main/ets/common/components/PortraBottomNav';
import { HallView } from '../../../main/ets/features/hall/HallView';
import { HallChannel, HallContentState } from '../../../main/ets/features/hall/HallUiModels';
import { DemandSummary, ServicePackageSummary } from '../../../main/ets/model/ApiModels';

const PREVIEW_SERVICES: ServicePackageSummary[] = [
  {
    serviceId: 1,
    photographerNickname: '林屿',
    photographerAvatarUrl: '',
    title: '清透日系 · 校园写真',
    cityCode: '320100',
    coverImage: 'https://images.unsplash.com/photo-1746850726515-0d96cef963bf?auto=format&fit=crop&w=720&q=85',
    basePriceCent: 29900
  },
  {
    serviceId: 2,
    photographerNickname: '松野',
    photographerAvatarUrl: '',
    title: '自然纪实 · 情绪人像',
    cityCode: '320500',
    coverImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=85',
    basePriceCent: 36800
  },
  {
    serviceId: 3,
    photographerNickname: '纸鸢',
    photographerAvatarUrl: '',
    title: '复古港风 · 胶片写真',
    cityCode: '320100',
    coverImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=720&q=85',
    basePriceCent: 42800
  },
  {
    serviceId: 4,
    photographerNickname: '青禾',
    photographerAvatarUrl: '',
    title: '城市漫游 · 松弛感写真',
    cityCode: '320100',
    coverImage: 'https://images.unsplash.com/photo-1651613350851-70201a7f67fe?auto=format&fit=crop&w=720&q=85',
    basePriceCent: 32000
  }
];

const PREVIEW_DEMANDS: DemandSummary[] = [
  {
    demandId: 1,
    customerNickname: '今晚吃橘子',
    scene: '秋日校园写真',
    cityCode: '320100',
    description: '希望自然、轻松、不刻意摆拍，周末均可。',
    budgetMinCent: 30000,
    budgetMaxCent: 50000
  },
  {
    demandId: 2,
    customerNickname: '这是一个用于检查小屏幕省略效果的较长昵称',
    scene: '毕业季城市漫步纪实与夜景人像组合拍摄',
    cityCode: '330100',
    description: '希望白天记录自然互动，傍晚补拍城市夜景；没有参考图，摄影师可以提出自己的构图建议。',
    budgetMinCent: 123456700
  }
];

const EDGE_CASE_SERVICES: ServicePackageSummary[] = [
  {
    serviceId: 91,
    photographerNickname: '',
    photographerAvatarUrl: '',
    title: '这是一个用于验证双列卡片长中文换行和截断是否稳定的摄影服务标题',
    cityCode: '',
    coverImage: '',
    basePriceCent: 123456700
  },
  {
    serviceId: 92,
    photographerNickname: '很长很长的摄影师昵称用于检查窄屏布局',
    photographerAvatarUrl: '',
    title: '无头像但有封面的服务',
    cityCode: '310000',
    coverImage: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=720&q=85'
  }
];

@Component
export struct HallPreviewFrame {
  @Prop initialChannel: HallChannel = HallChannel.SHOWCASES;
  @Prop serviceState: HallContentState = HallContentState.CONTENT;
  @Prop demandState: HallContentState = HallContentState.CONTENT;
  @Prop serviceItems: ServicePackageSummary[] = PREVIEW_SERVICES;
  @Prop demandItems: DemandSummary[] = PREVIEW_DEMANDS;
  @Prop serviceError: string = '';
  @Prop demandError: string = '';

  build() {
    Column() {
      HallView({
        initialChannel: this.initialChannel,
        serviceState: this.serviceState,
        demandState: this.demandState,
        serviceItems: this.serviceItems,
        demandItems: this.demandItems,
        serviceError: this.serviceError,
        demandError: this.demandError
      })
        .layoutWeight(1)
      PortraBottomNav({ selectedIndex: 0 })
    }
    .width('100%')
    .height('100%')
  }
}

@Component
export struct HallDemandPreviewFrame {
  build() {
    HallPreviewFrame({ initialChannel: HallChannel.DEMANDS })
  }
}

@Component
export struct HallLoadingPreviewFrame {
  build() {
    HallPreviewFrame({
      serviceState: HallContentState.LOADING,
      demandState: HallContentState.LOADING,
      serviceItems: [],
      demandItems: []
    })
  }
}

@Component
export struct HallEmptyPreviewFrame {
  build() {
    HallPreviewFrame({
      initialChannel: HallChannel.DEMANDS,
      serviceState: HallContentState.EMPTY,
      demandState: HallContentState.EMPTY,
      serviceItems: [],
      demandItems: []
    })
  }
}

@Component
export struct HallErrorPreviewFrame {
  build() {
    HallPreviewFrame({
      serviceState: HallContentState.ERROR,
      demandState: HallContentState.ERROR,
      serviceItems: [],
      demandItems: [],
      serviceError: '暂时无法连接服务，请稍后重试。',
      demandError: '暂时无法连接服务，请稍后重试。'
    })
  }
}

@Component
export struct HallEdgeCasesPreviewFrame {
  build() {
    HallPreviewFrame({
      serviceItems: EDGE_CASE_SERVICES,
      demandItems: PREVIEW_DEMANDS
    })
  }
}
