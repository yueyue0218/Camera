import { useState } from 'react'

export function useOrderDialogs() {
  const [reworkDialogOpen, setReworkDialogOpen] = useState(false)
  const [deliveryUploadDialogOpen, setDeliveryUploadDialogOpen] = useState(false)
  const [photoAuthorizationDialogOpen, setPhotoAuthorizationDialogOpen] = useState(false)
  const [authorizationRecordsDialogOpen, setAuthorizationRecordsDialogOpen] = useState(false)
  const [reviewRecordsDialogOpen, setReviewRecordsDialogOpen] = useState(false)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [previewDelivery, setPreviewDelivery] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showArbitrationForm, setShowArbitrationForm] = useState(false)
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false)
  const [followUpReview, setFollowUpReview] = useState(null)
  const [followUpContent, setFollowUpContent] = useState('')

  return {
    reworkDialogOpen,
    setReworkDialogOpen,
    deliveryUploadDialogOpen,
    setDeliveryUploadDialogOpen,
    photoAuthorizationDialogOpen,
    setPhotoAuthorizationDialogOpen,
    authorizationRecordsDialogOpen,
    setAuthorizationRecordsDialogOpen,
    reviewRecordsDialogOpen,
    setReviewRecordsDialogOpen,
    completionDialogOpen,
    setCompletionDialogOpen,
    previewDelivery,
    setPreviewDelivery,
    previewUrl,
    setPreviewUrl,
    previewLoading,
    setPreviewLoading,
    previewError,
    setPreviewError,
    showReviewForm,
    setShowReviewForm,
    showArbitrationForm,
    setShowArbitrationForm,
    followUpDialogOpen,
    setFollowUpDialogOpen,
    followUpReview,
    setFollowUpReview,
    followUpContent,
    setFollowUpContent
  }
}
