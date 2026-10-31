import { CreateDemandPayload, CreateServicePackagePayload } from '../../model/ApiModels';
import { ProvinceCatalog } from './ProvinceCatalog';

/** Canonicalize at the transport boundary too, including old drafts and callers. */
export class ProvincePayload {
  static demand(p: CreateDemandPayload): CreateDemandPayload {
    return { scene: p.scene, cityCode: ProvinceCatalog.requireCode(p.cityCode), location: p.location,
      timeDescription: p.timeDescription, description: p.description, styleTags: p.styleTags,
      expectedDate: p.expectedDate, timeSlot: p.timeSlot, timeTags: p.timeTags,
      budgetMinCent: p.budgetMinCent, budgetMaxCent: p.budgetMaxCent, referenceFileIds: p.referenceFileIds };
  }
  static service(p: CreateServicePackagePayload): CreateServicePackagePayload {
    return { title: p.title, cityCode: ProvinceCatalog.requireCode(p.cityCode), serviceArea: p.serviceArea,
      scene: p.scene, styleTags: p.styleTags, images: p.images, basePriceCent: p.basePriceCent,
      priceRange: p.priceRange, durationMinutes: p.durationMinutes, originalCount: p.originalCount,
      refinedCount: p.refinedCount, deliveryDays: p.deliveryDays, availableDates: p.availableDates,
      portfolioIds: p.portfolioIds, description: p.description, timeDescription: p.timeDescription, timeTags: p.timeTags };
  }
}
